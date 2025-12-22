import { AppDataSource } from '../config/database';
import { MediaItem, MediaType } from '../entities/MediaItem';
import { generateEmbedding, prepareTextForEmbedding } from '../utils/embeddings';
import { Repository } from 'typeorm';

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

  async searchMedia(query: string, limit: number = 10, maxDistance: number = 0.5): Promise<MediaItem[]> {
    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query);
    const queryVector = `[${queryEmbedding.join(',')}]`;

    // Use raw SQL query for pgvector similarity search
    // Cosine distance (<=>): 0 = identical, 1 = orthogonal, 2 = opposite
    // Lower distance = more similar, so we order by ASC
    // maxDistance threshold filters out completely unrelated results (0.8 = fairly permissive)
    let results;
    try {
      results = await this.mediaRepository.query(
        `
        SELECT 
          id, title, type, content, description, "filePath", url, "mimeType", 
          embedding, "createdAt", "updatedAt",
          (embedding::vector <=> $1::vector) as distance
        FROM media_items
        WHERE embedding IS NOT NULL
          AND embedding::vector <=> $1::vector <= $3
        ORDER BY embedding::vector <=> $1::vector ASC
        LIMIT $2
        `,
        [queryVector, limit, maxDistance]
      );
    } catch (error) {
      console.error('Error in vector search query:', error);
      // Fallback: return empty array if query fails
      return [];
    }

    // Convert results to MediaItem entities (exclude distance from the entity)
    return results.map((row: MediaItem & { distance?: number }) => {
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
      return item;
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
}

