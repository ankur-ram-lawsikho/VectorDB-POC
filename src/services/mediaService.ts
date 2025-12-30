import { AppDataSource } from '../config/database';
import { MediaItem, MediaType } from '../entities/MediaItem';
import { generateEmbedding, prepareTextForEmbedding } from '../utils/embeddings';
import { Repository } from 'typeorm';
import { 
  LimitSettings, 
  DistanceSettings, 
  SimilaritySettings, 
  SemanticSearchSettings,
  getMaxDistance,
  validateLimit
} from '../config/vectordb.settings';

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
    limit: number = LimitSettings.DEFAULT_SEARCH_LIMIT,
    maxDistance?: number,
    metric: DistanceMetric = 'cosine'
  ): Promise<SimilaritySearchResult[]> {
    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query);
    const queryVector = `[${queryEmbedding.join(',')}]`;

    // Validate and set limit
    const validatedLimit = validateLimit(limit);

    // Set default maxDistance based on metric using settings
    const defaultMaxDistance = getMaxDistance(metric);
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
        [queryVector, validatedLimit * LimitSettings.CANDIDATE_MULTIPLIER, metric] // Get more results to check distances
      );

      console.log(`Found ${allResults.length} items (before distance filter)`);
      if (allResults.length > 0) {
        console.log(`Closest match distance: ${allResults[0].distance}, threshold: ${distanceThreshold}`);
      }

      // Now filter by distance threshold
      results = allResults.filter((row: { distance: number }) => row.distance <= distanceThreshold);
      
      // Limit to requested number
      results = results.slice(0, validatedLimit);

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
    limit: number = LimitSettings.DEFAULT_SIMILAR_ITEMS_LIMIT,
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

    // Validate and set limit
    const validatedLimit = validateLimit(limit);

    // Set default maxDistance based on metric using settings
    const defaultMaxDistance = getMaxDistance(metric);
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

  /**
   * Semantic search with enhanced understanding and context awareness
   * This method provides true semantic search that understands meaning, context, and relationships
   * 
   * @param query - Natural language query
   * @param limit - Maximum number of results
   * @param options - Additional semantic search options
   * @returns Enhanced search results with semantic understanding
   */
  async semanticSearch(
    query: string,
    limit: number = LimitSettings.DEFAULT_SEARCH_LIMIT,
    options: {
      minSimilarity?: number;
      includeRelated?: boolean;
      contextBoost?: boolean;
    } = {}
  ): Promise<{
    query: string;
    results: Array<SimilaritySearchResult & { relevanceScore?: number; semanticMatch?: boolean }>;
    relatedConcepts?: string[];
    helpfulMessage?: string;
    searchMetadata: {
      totalCandidates: number;
      filteredResults: number;
      averageSimilarity: number;
      searchType: 'semantic';
      effectiveMinSimilarity?: number;
    };
  }> {
    const { 
      minSimilarity = SemanticSearchSettings.DEFAULT_MIN_SIMILARITY, 
      includeRelated = SemanticSearchSettings.DEFAULT_INCLUDE_RELATED, 
      contextBoost = SemanticSearchSettings.DEFAULT_CONTEXT_BOOST 
    } = options;

    // Validate limit
    const validatedLimit = validateLimit(limit);

    // Enhanced query processing for better semantic understanding
    const enhancedQuery = this.enhanceQueryForSemanticSearch(query);
    
    // Generate embedding for the enhanced query
    const queryEmbedding = await generateEmbedding(enhancedQuery);
    const queryVector = `[${queryEmbedding.join(',')}]`;

    // Use cosine distance for semantic search (best for text)
    const distanceExpression = 'embedding::vector <=> $1::vector';
    
    // Check how many items have embeddings
    const itemsWithEmbeddings = await this.mediaRepository.query(
      `SELECT COUNT(*) as count FROM media_items WHERE embedding IS NOT NULL`
    );
    const embeddingCount = parseInt(itemsWithEmbeddings[0]?.count || '0');
    
    if (embeddingCount === 0) {
      return {
        query,
        results: [],
        searchMetadata: {
          totalCandidates: 0,
          filteredResults: 0,
          averageSimilarity: 0,
          searchType: 'semantic',
        },
      };
    }

    // Semantic search with adaptive threshold from settings
    const adaptiveThreshold = DistanceSettings.SEMANTIC_SEARCH_ADAPTIVE_THRESHOLD;

    let allResults;
    try {
      // First, get ALL results without threshold to see what's available
      // Note: $1 is the query vector, $2 is the limit
      const allCandidates = await this.mediaRepository.query(
        `
        SELECT 
          id, title, type, content, description, "filePath", url, "mimeType", 
          embedding, "createdAt", "updatedAt",
          (${distanceExpression}) as distance,
          (1 - (${distanceExpression})) as similarity
        FROM media_items
        WHERE embedding IS NOT NULL
        ORDER BY (${distanceExpression}) ASC
        LIMIT $2
        `,
        [queryVector, validatedLimit * LimitSettings.SEMANTIC_CANDIDATE_MULTIPLIER] // Get more candidates for semantic analysis
      );

      console.log(`Semantic search: Found ${allCandidates.length} total candidates for query "${query}"`);
      
      if (allCandidates.length > 0) {
        const closestDistance = allCandidates[0].distance;
        const closestSimilarity = allCandidates[0].similarity;
        console.log(`Closest match: distance=${closestDistance.toFixed(3)}, similarity=${closestSimilarity.toFixed(3)}`);
      }

      // Filter by adaptive threshold first
      allResults = allCandidates.filter((row: { distance: number }) => row.distance <= adaptiveThreshold);

      console.log(`After threshold filter (${adaptiveThreshold}): ${allResults.length} candidates`);

      // If no results with default minSimilarity, progressively lower the threshold
      let effectiveMinSimilarity = minSimilarity;
      let filteredResults = allResults.filter((row: { similarity: number }) => row.similarity >= effectiveMinSimilarity);
      
      if (filteredResults.length === 0 && allResults.length > 0) {
        // Try progressively lower thresholds from settings
        const thresholds = SimilaritySettings.PROGRESSIVE_THRESHOLDS;
        for (const threshold of thresholds) {
          effectiveMinSimilarity = threshold;
          filteredResults = allResults.filter((row: { similarity: number }) => row.similarity >= effectiveMinSimilarity);
          if (filteredResults.length > 0) {
            console.log(`Lowered minSimilarity to ${effectiveMinSimilarity}, found ${filteredResults.length} results`);
            break;
          }
        }
        
        // If still no results, return top candidates anyway (even with very low similarity)
        if (filteredResults.length === 0 && allCandidates.length > 0) {
          console.log(`No results after filtering, returning top ${Math.min(validatedLimit, allCandidates.length)} candidates anyway`);
          filteredResults = allCandidates.slice(0, validatedLimit);
          effectiveMinSimilarity = 0; // Mark that we're showing all results
        }
      }

      // Limit results
      filteredResults = filteredResults.slice(0, validatedLimit)
        .map((row: MediaItem & { distance?: number; similarity?: number }) => {
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
          
          // Calculate relevance score (enhanced similarity with context)
          const baseSimilarity = row.similarity ?? (1 - (row.distance ?? 0));
          const relevanceScore = contextBoost 
            ? this.calculateRelevanceScore(item, query, baseSimilarity)
            : baseSimilarity;

          // Determine if it's a strong semantic match using settings
          const semanticMatch = baseSimilarity >= SimilaritySettings.STRONG_MATCH_THRESHOLD;

          return {
            item,
            similarity: baseSimilarity,
            distance: row.distance ?? 0,
            relevanceScore,
            semanticMatch,
          };
        })
        .sort((a, b) => (b.relevanceScore ?? b.similarity) - (a.relevanceScore ?? a.similarity));

      // Calculate average similarity
      const averageSimilarity = filteredResults.length > 0
        ? filteredResults.reduce((sum, r) => sum + r.similarity, 0) / filteredResults.length
        : 0;

      // Extract related concepts from top results (if enabled)
      const relatedConcepts = includeRelated && filteredResults.length > 0
        ? this.extractRelatedConcepts(filteredResults, query)
        : undefined;

      // Add helpful message if no results
      let helpfulMessage: string | undefined;
      if (filteredResults.length === 0) {
        if (embeddingCount === 0) {
          helpfulMessage = 'No items have embeddings. Please create items or run the backfill script to generate embeddings.';
        } else if (allCandidates && allCandidates.length > 0) {
          const closest = allCandidates[0];
          helpfulMessage = `No results found. Closest match has ${(closest.similarity * 100).toFixed(1)}% similarity (distance: ${closest.distance.toFixed(3)}). The search is working, but your database may not have content related to "${query}". Try: 1) Add items about this topic, 2) Use Keyword search instead, or 3) Try broader search terms.`;
        } else {
          helpfulMessage = 'No items found in database. Please add some media items first.';
        }
      } else if (effectiveMinSimilarity === 0 && filteredResults.length > 0) {
        // If we're showing results with 0 similarity threshold, warn the user
        const avgSim = filteredResults.reduce((sum, r) => sum + r.similarity, 0) / filteredResults.length;
        if (avgSim < 0.2) {
          helpfulMessage = `Found ${filteredResults.length} results, but they have low similarity (avg: ${(avgSim * 100).toFixed(1)}%). These may not be very relevant to your query. Consider adding more related content to your database.`;
        }
      }

      return {
        query,
        results: filteredResults,
        relatedConcepts,
        helpfulMessage,
        searchMetadata: {
          totalCandidates: allCandidates.length,
          filteredResults: filteredResults.length,
          averageSimilarity: Math.round(averageSimilarity * 1000) / 1000,
          searchType: 'semantic',
          effectiveMinSimilarity: effectiveMinSimilarity,
        },
      };
    } catch (error) {
      console.error('Error in semantic search:', error);
      return {
        query,
        results: [],
        searchMetadata: {
          totalCandidates: 0,
          filteredResults: 0,
          averageSimilarity: 0,
          searchType: 'semantic',
        },
      };
    }
  }

  /**
   * Enhance query for better semantic understanding
   * Expands query with context and related terms
   */
  private enhanceQueryForSemanticSearch(query: string): string {
    // Remove extra whitespace
    query = query.trim().replace(/\s+/g, ' ');
    
    // For short queries, add context hints
    if (query.split(' ').length <= 2) {
      // Don't modify too much, but ensure it's a complete thought
      return query;
    }
    
    // Return enhanced query (can be expanded with synonyms, context, etc.)
    return query;
  }

  /**
   * Calculate relevance score with context boosting
   * Considers title matches, description relevance, and content context
   */
  private calculateRelevanceScore(
    item: MediaItem,
    query: string,
    baseSimilarity: number
  ): number {
    let score = baseSimilarity;
    const queryLower = query.toLowerCase();
    
    // Boost if query terms appear in title (exact match bonus)
    if (item.title) {
      const titleLower = item.title.toLowerCase();
      if (titleLower.includes(queryLower)) {
        score += SemanticSearchSettings.TITLE_MATCH_BOOST;
      }
      // Partial word matches
      const queryWords = queryLower.split(' ');
      const titleWords = titleLower.split(' ');
      const matchingWords = queryWords.filter(qw => 
        titleWords.some(tw => tw.includes(qw) || qw.includes(tw))
      );
      if (matchingWords.length > 0) {
        score += (matchingWords.length / queryWords.length) * SemanticSearchSettings.PARTIAL_WORD_MATCH_BOOST;
      }
    }
    
    // Boost if query terms appear in description
    if (item.description) {
      const descLower = item.description.toLowerCase();
      if (descLower.includes(queryLower)) {
        score += SemanticSearchSettings.DESCRIPTION_MATCH_BOOST;
      }
    }
    
    // Normalize score to 0-1 range
    return Math.min(1.0, score);
  }

  /**
   * Extract related concepts from search results
   * Identifies common themes and related topics
   */
  private extractRelatedConcepts(
    results: Array<SimilaritySearchResult & { relevanceScore?: number; semanticMatch?: boolean }>,
    originalQuery: string
  ): string[] {
    const concepts = new Set<string>();
    
    // Extract key terms from top results
    results.slice(0, 5).forEach(result => {
      // Extract from title
      if (result.item.title) {
        const titleWords = result.item.title
          .toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > 3 && !this.isStopWord(word));
        titleWords.forEach(word => concepts.add(word));
      }
      
      // Extract from description
      if (result.item.description) {
        const descWords = result.item.description
          .toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > 3 && !this.isStopWord(word));
        descWords.slice(0, 3).forEach(word => concepts.add(word));
      }
    });
    
    // Remove query terms and return top related concepts
    const queryWords = originalQuery.toLowerCase().split(/\s+/);
    return Array.from(concepts)
      .filter(concept => !queryWords.some(qw => concept.includes(qw) || qw.includes(concept)))
      .slice(0, 5);
  }

  /**
   * Check if a word is a common stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those', 'what', 'which', 'who', 'whom', 'whose', 'where',
      'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
      'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
      'same', 'so', 'than', 'too', 'very', 'just', 'about', 'into', 'through',
      'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out',
      'off', 'over', 'under', 'again', 'further', 'then', 'once'
    ]);
    return stopWords.has(word.toLowerCase());
  }
}

