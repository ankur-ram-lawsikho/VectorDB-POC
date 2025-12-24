import { AppDataSource } from '../config/database';
import { MediaItem, MediaType } from '../entities/MediaItem';
import { generateEmbedding, prepareTextForEmbedding } from '../utils/embeddings';
import { Repository } from 'typeorm';

/**
 * Distance metric types for similarity search
 */
export type DistanceMetric = 'cosine' | 'l2' | 'inner_product';

/**
 * Search result with similarity score
 */
export interface SimilaritySearchResult {
  item: MediaItem;
  similarity: number; // Similarity score (0-1, higher = more similar for cosine/L2)
  distance: number; // Distance metric value
}

export class MediaService {
  private mediaRepository: Repository<MediaItem>;

  constructor() {
    this.mediaRepository = AppDataSource.getRepository(MediaItem);
  }

  async createMediaItem(
    title: string,
    type: MediaType,
    content?: string,
    description?: string,
    filePath?: string,
    url?: string,
    mimeType?: string
  ): Promise<MediaItem> {
    const mediaItem = new MediaItem();
    mediaItem.title = title;
    mediaItem.type = type;
    mediaItem.content = content;
    mediaItem.description = description;
    mediaItem.filePath = filePath;
    mediaItem.url = url;
    mediaItem.mimeType = mimeType;

    // Generate embedding for search using only title, description, and content
    const textForEmbedding = prepareTextForEmbedding(
      title,
      description,
      content
    );
    
    // Save the media item first (without embedding)
    const savedItem = await this.mediaRepository.save(mediaItem);
    
    // Only generate embedding if there's text to embed
    if (!textForEmbedding || textForEmbedding.trim() === '') {
      // If no relevant field, return item without embedding
      return savedItem;
    }
    
    const embeddingArray = await generateEmbedding(textForEmbedding);
    
    // Update the embedding using raw SQL to ensure proper vector casting
    // Convert array to PostgreSQL vector format: [1,2,3,...]
    const embeddingString = `[${embeddingArray.join(',')}]`;
    
    try {
      await this.mediaRepository.query(
        `UPDATE media_items SET embedding = $1::vector(768) WHERE id = $2`,
        [embeddingString, savedItem.id]
      );
    } catch (error) {
      console.error('Error saving embedding:', error);
      // If embedding save fails, still return the item (embedding will be null)
    }
    
    // Reload to get the updated embedding
    return await this.mediaRepository.findOne({ where: { id: savedItem.id } }) || savedItem;
  }

  /**
   * Search media items by text query using vector similarity
   * @param query - Text query to search for
   * @param limit - Maximum number of results to return
   * @param maxDistance - Maximum distance threshold (default: 0.5 for cosine, 1.0 for L2)
   * @param metric - Distance metric to use (default: 'cosine')
   * @returns Array of search results with similarity scores
   */
  async searchMedia(
    query: string,
    limit: number = 10,
    maxDistance?: number,
    metric: DistanceMetric = 'cosine'
  ): Promise<SimilaritySearchResult[]> {
    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query);
    const queryVector = `[${queryEmbedding.join(',')}]`;

    // Set default maxDistance based on metric
    // For inner product: <#> returns negative inner product, lower = more similar
    // For normalized embeddings, values typically range from -1 to 1
    // So we use a threshold around 0.0 to 0.5 (more permissive than cosine)
    const defaultMaxDistance = metric === 'cosine' ? 0.5 : metric === 'l2' ? 1.0 : 0.5;
    const distanceThreshold = maxDistance ?? defaultMaxDistance;

    // Choose distance expression based on metric
    let distanceExpression: string;
    
    switch (metric) {
      case 'cosine':
        // Cosine distance (<=>): 0 = identical, 1 = orthogonal, 2 = opposite
        distanceExpression = 'embedding::vector <=> $1::vector';
        break;
      case 'l2':
        // L2 distance (<->): Euclidean distance, 0 = identical
        distanceExpression = 'embedding::vector <-> $1::vector';
        break;
      case 'inner_product':
        // Inner product (<#>): Negative inner product, lower = more similar
        distanceExpression = 'embedding::vector <#> $1::vector';
        break;
      default:
        distanceExpression = 'embedding::vector <=> $1::vector';
    }

    // First, check how many items have embeddings
    const itemsWithEmbeddings = await this.mediaRepository.query(
      `SELECT COUNT(*) as count FROM media_items WHERE embedding IS NOT NULL`
    );
    const embeddingCount = parseInt(itemsWithEmbeddings[0]?.count || '0');
    
    if (embeddingCount === 0) {
      console.warn('No items with embeddings found in database');
      return [];
    }

    console.log(`Searching ${embeddingCount} items with embeddings using ${metric} metric (maxDistance: ${distanceThreshold})`);

    let results;
    try {
      // First, get results without distance filter to see all matches
      const allResults = await this.mediaRepository.query(
        `
        SELECT 
          id, title, type, content, description, "filePath", url, "mimeType", 
          embedding, "createdAt", "updatedAt",
          (${distanceExpression}) as distance,
          CASE 
            WHEN $3 = 'cosine' THEN 1 - (embedding::vector <=> $1::vector)
            WHEN $3 = 'l2' THEN 1 / (1 + (embedding::vector <-> $1::vector))
            WHEN $3 = 'inner_product' THEN -1 * (embedding::vector <#> $1::vector)
            ELSE 1 - (embedding::vector <=> $1::vector)
          END as similarity
        FROM media_items
        WHERE embedding IS NOT NULL
        ORDER BY (${distanceExpression}) ASC
        LIMIT $2
        `,
        [queryVector, limit * 2, metric] // Get more results to check distances
      );

      console.log(`Found ${allResults.length} items (before distance filter)`);
      if (allResults.length > 0) {
        console.log(`Closest match distance: ${allResults[0].distance}, threshold: ${distanceThreshold}`);
      }

      // Now filter by distance threshold
      results = allResults.filter((row: { distance: number }) => row.distance <= distanceThreshold);
      
      // Limit to requested number
      results = results.slice(0, limit);

      console.log(`Returning ${results.length} items (after distance filter)`);
    } catch (error) {
      console.error('Error in vector search query:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
      // Fallback: return empty array if query fails
      return [];
    }

    // Convert results to SimilaritySearchResult format
    return results.map((row: MediaItem & { distance?: number; similarity?: number }) => {
      const item = new MediaItem();
      item.id = row.id;
      item.title = row.title;
      item.type = row.type;
      item.content = row.content;
      item.description = row.description;
      item.filePath = row.filePath;
      item.url = row.url;
      item.mimeType = row.mimeType;
      item.embedding = row.embedding;
      item.createdAt = row.createdAt;
      item.updatedAt = row.updatedAt;
      
      return {
        item,
        similarity: row.similarity ?? (1 - (row.distance ?? 0)),
        distance: row.distance ?? 0,
      };
    });
  }

  /**
   * Find similar media items to a given media item by ID
   * @param mediaItemId - ID of the media item to find similar items for
   * @param limit - Maximum number of results to return
   * @param maxDistance - Maximum distance threshold
   * @param metric - Distance metric to use
   * @returns Array of similar items with similarity scores
   */
  async findSimilarMedia(
    mediaItemId: string,
    limit: number = 10,
    maxDistance?: number,
    metric: DistanceMetric = 'cosine'
  ): Promise<SimilaritySearchResult[]> {
    // Get the media item
    const sourceItem = await this.mediaRepository.findOne({ where: { id: mediaItemId } });
    
    if (!sourceItem) {
      throw new Error('Media item not found');
    }

    if (!sourceItem.embedding) {
      throw new Error('Source media item does not have an embedding');
    }

    // Set default maxDistance based on metric
    // For inner product: <#> returns negative inner product, lower = more similar
    // For normalized embeddings, values typically range from -1 to 1
    // So we use a threshold around 0.0 to 0.5 (more permissive than cosine)
    const defaultMaxDistance = metric === 'cosine' ? 0.5 : metric === 'l2' ? 1.0 : 0.5;
    const distanceThreshold = maxDistance ?? defaultMaxDistance;

    // Choose distance operator based on metric
    let distanceExpression: string;
    
    switch (metric) {
      case 'cosine':
        distanceExpression = 'embedding::vector <=> $1::vector';
        break;
      case 'l2':
        distanceExpression = 'embedding::vector <-> $1::vector';
        break;
      case 'inner_product':
        distanceExpression = 'embedding::vector <#> $1::vector';
        break;
      default:
        distanceExpression = 'embedding::vector <=> $1::vector';
    }

    // Use the source item's embedding for comparison
    const sourceVector = sourceItem.embedding;

    let results;
    try {
      results = await this.mediaRepository.query(
        `
        SELECT 
          id, title, type, content, description, "filePath", url, "mimeType", 
          embedding, "createdAt", "updatedAt",
          (${distanceExpression}) as distance,
          CASE 
            WHEN $4 = 'cosine' THEN 1 - (embedding::vector <=> $1::vector)
            WHEN $4 = 'l2' THEN 1 / (1 + (embedding::vector <-> $1::vector))
            WHEN $4 = 'inner_product' THEN -1 * (embedding::vector <#> $1::vector)
            ELSE 1 - (embedding::vector <=> $1::vector)
          END as similarity
        FROM media_items
        WHERE embedding IS NOT NULL
          AND id != $5
          AND (${distanceExpression}) <= $3
        ORDER BY (${distanceExpression}) ASC
        LIMIT $2
        `,
        [sourceVector, limit, distanceThreshold, metric, mediaItemId]
      );
    } catch (error) {
      console.error('Error in similarity search query:', error);
      return [];
    }

    // Convert results to SimilaritySearchResult format
    return results.map((row: MediaItem & { distance?: number; similarity?: number }) => {
      const item = new MediaItem();
      item.id = row.id;
      item.title = row.title;
      item.type = row.type;
      item.content = row.content;
      item.description = row.description;
      item.filePath = row.filePath;
      item.url = row.url;
      item.mimeType = row.mimeType;
      item.embedding = row.embedding;
      item.createdAt = row.createdAt;
      item.updatedAt = row.updatedAt;
      
      return {
        item,
        similarity: row.similarity ?? (1 - (row.distance ?? 0)),
        distance: row.distance ?? 0,
      };
    });
  }

  async getAllMedia(): Promise<MediaItem[]> {
    return await this.mediaRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getMediaById(id: string): Promise<MediaItem | null> {
    return await this.mediaRepository.findOne({ where: { id } });
  }

  async deleteMedia(id: string): Promise<boolean> {
    const result = await this.mediaRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Get statistics about embeddings in the database
   */
  async getEmbeddingStats(): Promise<{
    totalItems: number;
    itemsWithEmbeddings: number;
    itemsWithoutEmbeddings: number;
    percentageWithEmbeddings: number;
  }> {
    const totalItems = await this.mediaRepository.count();
    
    const itemsWithEmbeddingsResult = await this.mediaRepository.query(
      `SELECT COUNT(*) as count FROM media_items WHERE embedding IS NOT NULL`
    );
    const itemsWithEmbeddings = parseInt(itemsWithEmbeddingsResult[0]?.count || '0');
    const itemsWithoutEmbeddings = totalItems - itemsWithEmbeddings;
    const percentageWithEmbeddings = totalItems > 0 ? (itemsWithEmbeddings / totalItems) * 100 : 0;

    return {
      totalItems,
      itemsWithEmbeddings,
      itemsWithoutEmbeddings,
      percentageWithEmbeddings: Math.round(percentageWithEmbeddings * 100) / 100,
    };
  }
}

