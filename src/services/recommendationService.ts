import { AppDataSource } from '../config/database';
import { MediaItem } from '../entities/MediaItem';
import { MediaService, SimilaritySearchResult } from './mediaService';
import { generateEmbedding } from '../utils/embeddings';
import { Repository, In } from 'typeorm';

/**
 * Recommendation strategies
 */
export type RecommendationStrategy = 
  | 'item-based'      // Recommend based on a single item
  | 'multi-item'      // Recommend based on multiple items (user preferences)
  | 'content-based'   // Recommend based on text query/description
  | 'hybrid';         // Combine multiple strategies

/**
 * Recommendation result with metadata
 */
export interface RecommendationResult {
  item: MediaItem;
  similarity: number;
  distance: number;
  recommendationScore: number; // Weighted score for recommendations
  reason?: string; // Why this item was recommended
}

/**
 * Recommendation response
 */
export interface RecommendationResponse {
  strategy: RecommendationStrategy;
  sourceItems?: string[]; // IDs of source items used for recommendation
  sourceQuery?: string; // Query used for content-based recommendations
  recommendations: RecommendationResult[];
  metadata: {
    totalCandidates: number;
    filteredResults: number;
    averageSimilarity: number;
    minSimilarity: number;
    maxSimilarity: number;
  };
}

/**
 * Recommendation Service
 * Provides various recommendation strategies using vector similarity
 */
export class RecommendationService {
  private mediaRepository: Repository<MediaItem>;
  private mediaService: MediaService;

  constructor() {
    this.mediaRepository = AppDataSource.getRepository(MediaItem);
    this.mediaService = new MediaService();
  }

  /**
   * Item-based recommendations
   * Find items similar to a given item
   * 
   * @param itemId - ID of the source item
   * @param limit - Maximum number of recommendations
   * @param minSimilarity - Minimum similarity threshold (0-1)
   * @param excludeIds - Item IDs to exclude from results
   */
  async getItemBasedRecommendations(
    itemId: string,
    limit: number = 10,
    minSimilarity: number = 0.3,
    excludeIds: string[] = []
  ): Promise<RecommendationResponse> {
    // Get the source item
    const sourceItem = await this.mediaRepository.findOne({ where: { id: itemId } });
    
    if (!sourceItem) {
      throw new Error('Source item not found');
    }

    if (!sourceItem.embedding) {
      throw new Error('Source item does not have an embedding');
    }

    // Use existing findSimilarMedia method
    const excludeList = [itemId, ...excludeIds];
    const allResults = await this.findSimilarItems(
      sourceItem.embedding,
      limit * 2, // Get more candidates for filtering
      excludeList
    );

    // Filter by similarity threshold
    let filteredResults = allResults.filter(r => r.similarity >= minSimilarity);

    // If not enough results, lower threshold progressively
    if (filteredResults.length < limit && allResults.length > 0) {
      const thresholds = [0.2, 0.1, 0.05, 0.0];
      for (const threshold of thresholds) {
        filteredResults = allResults.filter(r => r.similarity >= threshold);
        if (filteredResults.length >= limit) break;
      }
    }

    // Limit results
    filteredResults = filteredResults.slice(0, limit);

    // Calculate metadata
    const similarities = filteredResults.map(r => r.similarity);
    const metadata = {
      totalCandidates: allResults.length,
      filteredResults: filteredResults.length,
      averageSimilarity: similarities.length > 0 
        ? similarities.reduce((a, b) => a + b, 0) / similarities.length 
        : 0,
      minSimilarity: similarities.length > 0 ? Math.min(...similarities) : 0,
      maxSimilarity: similarities.length > 0 ? Math.max(...similarities) : 0,
    };

    return {
      strategy: 'item-based',
      sourceItems: [itemId],
      recommendations: filteredResults.map(r => ({
        ...r,
        recommendationScore: r.similarity,
        reason: `Similar to "${sourceItem.title}"`,
      })),
      metadata,
    };
  }

  /**
   * Multi-item based recommendations
   * Find items similar to multiple source items (user preferences)
   * 
   * @param itemIds - Array of source item IDs
   * @param limit - Maximum number of recommendations
   * @param minSimilarity - Minimum similarity threshold (0-1)
   * @param excludeIds - Item IDs to exclude from results
   */
  async getMultiItemRecommendations(
    itemIds: string[],
    limit: number = 10,
    minSimilarity: number = 0.3,
    excludeIds: string[] = []
  ): Promise<RecommendationResponse> {
    if (itemIds.length === 0) {
      throw new Error('At least one source item ID is required');
    }

    // Get all source items
    const sourceItems = await this.mediaRepository.find({
      where: { id: In(itemIds) },
    });
    
    if (sourceItems.length === 0) {
      throw new Error('No source items found');
    }

    // Filter items with embeddings
    const itemsWithEmbeddings = sourceItems.filter(item => item.embedding);
    
    if (itemsWithEmbeddings.length === 0) {
      throw new Error('None of the source items have embeddings');
    }

    // Calculate average embedding from all source items
    const avgEmbedding = this.calculateAverageEmbedding(itemsWithEmbeddings);

    // Find similar items
    const excludeList = [...itemIds, ...excludeIds];
    const allResults = await this.findSimilarItems(
      avgEmbedding,
      limit * 2,
      excludeList
    );

    // Filter by similarity threshold
    let filteredResults = allResults.filter(r => r.similarity >= minSimilarity);

    // If not enough results, lower threshold progressively
    if (filteredResults.length < limit && allResults.length > 0) {
      const thresholds = [0.2, 0.1, 0.05, 0.0];
      for (const threshold of thresholds) {
        filteredResults = allResults.filter(r => r.similarity >= threshold);
        if (filteredResults.length >= limit) break;
      }
    }

    // Limit results
    filteredResults = filteredResults.slice(0, limit);

    // Calculate metadata
    const similarities = filteredResults.map(r => r.similarity);
    const metadata = {
      totalCandidates: allResults.length,
      filteredResults: filteredResults.length,
      averageSimilarity: similarities.length > 0 
        ? similarities.reduce((a, b) => a + b, 0) / similarities.length 
        : 0,
      minSimilarity: similarities.length > 0 ? Math.min(...similarities) : 0,
      maxSimilarity: similarities.length > 0 ? Math.max(...similarities) : 0,
    };

    // Create reason text
    const sourceTitles = itemsWithEmbeddings.map(item => item.title).slice(0, 3);
    const reason = sourceTitles.length === 1 
      ? `Similar to "${sourceTitles[0]}"`
      : `Similar to your preferences (${sourceTitles.join(', ')})`;

    return {
      strategy: 'multi-item',
      sourceItems: itemIds,
      recommendations: filteredResults.map(r => ({
        ...r,
        recommendationScore: r.similarity,
        reason,
      })),
      metadata,
    };
  }

  /**
   * Content-based recommendations
   * Find items similar to a text query/description
   * 
   * @param query - Text query or description
   * @param limit - Maximum number of recommendations
   * @param minSimilarity - Minimum similarity threshold (0-1)
   * @param excludeIds - Item IDs to exclude from results
   */
  async getContentBasedRecommendations(
    query: string,
    limit: number = 10,
    minSimilarity: number = 0.3,
    excludeIds: string[] = []
  ): Promise<RecommendationResponse> {
    if (!query || query.trim() === '') {
      throw new Error('Query is required for content-based recommendations');
    }

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    const queryVector = `[${queryEmbedding.join(',')}]`;

    // Find similar items
    const allResults = await this.findSimilarItems(
      queryVector,
      limit * 2,
      excludeIds
    );

    // Filter by similarity threshold
    let filteredResults = allResults.filter(r => r.similarity >= minSimilarity);

    // If not enough results, lower threshold progressively
    if (filteredResults.length < limit && allResults.length > 0) {
      const thresholds = [0.2, 0.1, 0.05, 0.0];
      for (const threshold of thresholds) {
        filteredResults = allResults.filter(r => r.similarity >= threshold);
        if (filteredResults.length >= limit) break;
      }
    }

    // Limit results
    filteredResults = filteredResults.slice(0, limit);

    // Calculate metadata
    const similarities = filteredResults.map(r => r.similarity);
    const metadata = {
      totalCandidates: allResults.length,
      filteredResults: filteredResults.length,
      averageSimilarity: similarities.length > 0 
        ? similarities.reduce((a, b) => a + b, 0) / similarities.length 
        : 0,
      minSimilarity: similarities.length > 0 ? Math.min(...similarities) : 0,
      maxSimilarity: similarities.length > 0 ? Math.max(...similarities) : 0,
    };

    return {
      strategy: 'content-based',
      sourceQuery: query,
      recommendations: filteredResults.map(r => ({
        ...r,
        recommendationScore: r.similarity,
        reason: `Matches your interest: "${query}"`,
      })),
      metadata,
    };
  }

  /**
   * Hybrid recommendations
   * Combine multiple recommendation strategies
   * 
   * @param options - Hybrid recommendation options
   */
  async getHybridRecommendations(options: {
    itemIds?: string[];
    query?: string;
    limit?: number;
    minSimilarity?: number;
    excludeIds?: string[];
    weights?: {
      itemBased?: number;
      contentBased?: number;
    };
  }): Promise<RecommendationResponse> {
    const {
      itemIds = [],
      query,
      limit = 10,
      minSimilarity = 0.3,
      excludeIds = [],
      weights = { itemBased: 0.5, contentBased: 0.5 },
    } = options;

    if (itemIds.length === 0 && !query) {
      throw new Error('Either itemIds or query must be provided for hybrid recommendations');
    }

    const allRecommendations: Map<string, RecommendationResult> = new Map();

    // Get item-based recommendations if itemIds provided
    if (itemIds.length > 0) {
      try {
        const itemBased = itemIds.length === 1
          ? await this.getItemBasedRecommendations(itemIds[0], limit * 2, minSimilarity, excludeIds)
          : await this.getMultiItemRecommendations(itemIds, limit * 2, minSimilarity, excludeIds);

        itemBased.recommendations.forEach(rec => {
          const existing = allRecommendations.get(rec.item.id);
          if (existing) {
            // Combine scores
            existing.recommendationScore = 
              existing.recommendationScore * weights.itemBased! + 
              rec.recommendationScore * weights.itemBased!;
            existing.reason = `${existing.reason}; ${rec.reason}`;
          } else {
            allRecommendations.set(rec.item.id, {
              ...rec,
              recommendationScore: rec.recommendationScore * weights.itemBased!,
            });
          }
        });
      } catch (error) {
        console.warn('Error getting item-based recommendations:', error);
      }
    }

    // Get content-based recommendations if query provided
    if (query) {
      try {
        const contentBased = await this.getContentBasedRecommendations(
          query,
          limit * 2,
          minSimilarity,
          excludeIds
        );

        contentBased.recommendations.forEach(rec => {
          const existing = allRecommendations.get(rec.item.id);
          if (existing) {
            // Combine scores
            existing.recommendationScore = 
              existing.recommendationScore + 
              rec.recommendationScore * weights.contentBased!;
            existing.reason = `${existing.reason}; ${rec.reason}`;
          } else {
            allRecommendations.set(rec.item.id, {
              ...rec,
              recommendationScore: rec.recommendationScore * weights.contentBased!,
            });
          }
        });
      } catch (error) {
        console.warn('Error getting content-based recommendations:', error);
      }
    }

    // Sort by recommendation score and limit
    const recommendations = Array.from(allRecommendations.values())
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, limit);

    // Calculate metadata
    const similarities = recommendations.map(r => r.similarity);
    const metadata = {
      totalCandidates: allRecommendations.size,
      filteredResults: recommendations.length,
      averageSimilarity: similarities.length > 0 
        ? similarities.reduce((a, b) => a + b, 0) / similarities.length 
        : 0,
      minSimilarity: similarities.length > 0 ? Math.min(...similarities) : 0,
      maxSimilarity: similarities.length > 0 ? Math.max(...similarities) : 0,
    };

    return {
      strategy: 'hybrid',
      sourceItems: itemIds.length > 0 ? itemIds : undefined,
      sourceQuery: query,
      recommendations,
      metadata,
    };
  }

  /**
   * Find similar items using a vector embedding
   * @private
   */
  private async findSimilarItems(
    sourceVector: string,
    limit: number,
    excludeIds: string[] = []
  ): Promise<RecommendationResult[]> {
    const distanceExpression = 'embedding::vector <=> $1::vector';
    const excludeCondition = excludeIds.length > 0
      ? `AND id NOT IN (${excludeIds.map((_, i) => `$${i + 3}`).join(', ')})`
      : '';

    const params: any[] = [sourceVector, limit];
    if (excludeIds.length > 0) {
      params.push(...excludeIds);
    }

    let results;
    try {
      results = await this.mediaRepository.query(
        `
        SELECT 
          id, title, type, content, description, "filePath", url, "mimeType", 
          embedding, "createdAt", "updatedAt",
          (${distanceExpression}) as distance,
          (1 - (${distanceExpression})) as similarity
        FROM media_items
        WHERE embedding IS NOT NULL
          ${excludeCondition}
        ORDER BY (${distanceExpression}) ASC
        LIMIT $2
        `,
        params
      );
    } catch (error) {
      console.error('Error in similarity search query:', error);
      return [];
    }

    // Convert results to RecommendationResult format
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
        recommendationScore: row.similarity ?? (1 - (row.distance ?? 0)),
      };
    });
  }

  /**
   * Calculate average embedding from multiple items
   * @private
   */
  private calculateAverageEmbedding(items: MediaItem[]): string {
    if (items.length === 0) {
      throw new Error('Cannot calculate average embedding from empty array');
    }

    // Parse embeddings and calculate average
    const embeddings = items
      .map(item => {
        if (!item.embedding) return null;
        // Parse the embedding string (format: "[1,2,3,...]")
        try {
          return JSON.parse(item.embedding);
        } catch {
          // If it's already an array or different format, try to handle it
          if (typeof item.embedding === 'string' && item.embedding.startsWith('[')) {
            return JSON.parse(item.embedding);
          }
          return null;
        }
      })
      .filter((emb): emb is number[] => emb !== null);

    if (embeddings.length === 0) {
      throw new Error('No valid embeddings found in items');
    }

    // Calculate average for each dimension
    const dimension = embeddings[0].length;
    const avgEmbedding = new Array(dimension).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        avgEmbedding[i] += embedding[i];
      }
    }

    // Normalize
    for (let i = 0; i < dimension; i++) {
      avgEmbedding[i] /= embeddings.length;
    }

    return `[${avgEmbedding.join(',')}]`;
  }
}

