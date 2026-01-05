import { AppDataSource } from '../config/database';
import { MediaItem, MediaType } from '../entities/MediaItem';
import { generateEmbedding, prepareTextForEmbedding } from '../utils/embeddings';
import { fuzzyMatch, fuzzySimilarity } from '../utils/fuzzySearch';
import { Repository } from 'typeorm';
import { 
  LimitSettings, 
  DistanceSettings, 
  SimilaritySettings, 
  SemanticSearchSettings,
  FuzzySearchSettings,
  MediaMatchingSettings,
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

    // Save the media item first (without embedding)
    const savedItem = await this.mediaRepository.save(mediaItem);
    
    // Generate embedding with enhanced support for audio/video
    const textForEmbedding = await prepareTextForEmbedding(
      title,
      description,
      content,
      savedItem // Pass the saved item for enhanced processing
    );
    
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

    // Convert results to SimilaritySearchResult format with type-aware boosting
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
      
      let similarity = row.similarity ?? (1 - (row.distance ?? 0));
      
      // Apply type-aware boosting for audio/video (no query in this context)
      similarity = this.applyTypeAwareBoosting(item, '', similarity);
      
      return {
        item,
        similarity,
        distance: row.distance ?? 0,
      };
    });
  }

  /**
   * Apply type-aware boosting for audio/video items
   * Enhanced boosting system with multiple factors:
   * - Type matching (audio/video)
   * - Platform matching (YouTube, Vimeo, etc.)
   * - Field-specific matching (title, description)
   * - Query intent detection
   * - Transcription matching (phrase and word-level)
   * - Format/codec matching
   * - Recency boosting
   */
  private applyTypeAwareBoosting(
    item: MediaItem,
    query: string,
    baseSimilarity: number
  ): number {
    // Skip boosting if similarity is too low
    if (baseSimilarity < MediaMatchingSettings.MIN_SIMILARITY_FOR_BOOST) {
      return baseSimilarity;
    }

    let boostedSimilarity = baseSimilarity;
    const queryLower = query.toLowerCase();
    const queryWords = this.extractQueryWords(queryLower);
    
    // Track total boost multiplier to cap it
    let totalBoostMultiplier = 1.0;
    const boostFactors: Array<{ name: string; boost: number }> = [];

    // Only apply boosting for audio/video items
    if (item.type === MediaType.AUDIO || item.type === MediaType.VIDEO) {
      
      // 1. Type-specific boosting (exact match)
      const typeMatch = this.checkTypeMatch(item.type, queryLower);
      if (typeMatch.matched) {
        const boost = MediaMatchingSettings.TYPE_MATCH_BOOST;
        totalBoostMultiplier *= boost;
        boostFactors.push({ name: `Type match (${typeMatch.matchType})`, boost });
      }

      // 2. Platform-specific boosting (YouTube, Vimeo, etc.)
      const platformMatch = this.checkPlatformMatch(item.url, queryLower);
      if (platformMatch.matched) {
        const boost = MediaMatchingSettings.PLATFORM_MATCH_BOOST;
        totalBoostMultiplier *= boost;
        boostFactors.push({ name: `Platform match (${platformMatch.platform})`, boost });
      }

      // 3. Title field matching (stronger boost)
      if (item.title) {
        const titleMatch = this.checkFieldMatch(item.title, queryLower, queryWords);
        if (titleMatch.matched) {
          const boost = titleMatch.exactMatch 
            ? MediaMatchingSettings.TITLE_MATCH_BOOST 
            : MediaMatchingSettings.TITLE_MATCH_BOOST * 0.9; // Slightly less for partial
          totalBoostMultiplier *= boost;
          boostFactors.push({ 
            name: `Title match (${titleMatch.matchType})`, 
            boost 
          });
        }
      }

      // 4. Description field matching
      if (item.description) {
        const descMatch = this.checkFieldMatch(item.description, queryLower, queryWords);
        if (descMatch.matched) {
          const boost = descMatch.exactMatch 
            ? MediaMatchingSettings.DESCRIPTION_MATCH_BOOST 
            : MediaMatchingSettings.DESCRIPTION_MATCH_BOOST * 0.9;
          totalBoostMultiplier *= boost;
          boostFactors.push({ 
            name: `Description match (${descMatch.matchType})`, 
            boost 
          });
        }
      }

      // 5. Format/codec matching (improved)
      const formatMatch = this.checkFormatMatch(item.mimeType, item.url, queryLower);
      if (formatMatch.matched) {
        const boost = MediaMatchingSettings.METADATA_MATCH_BOOST;
        totalBoostMultiplier *= boost;
        boostFactors.push({ 
          name: `Format match (${formatMatch.format})`, 
          boost 
        });
      }

      // 6. Media-specific keywords (expanded list with fuzzy matching)
      const keywordMatch = this.checkMediaKeywords(item.type, queryLower);
      if (keywordMatch.matched) {
        const boost = MediaMatchingSettings.KEYWORDS_BOOST * keywordMatch.matchStrength;
        totalBoostMultiplier *= boost;
        boostFactors.push({ 
          name: `Keyword match (${keywordMatch.keywords.join(', ')})`, 
          boost 
        });
      }

      // 7. Query intent detection (tutorial, review, music, etc.)
      const intentMatch = this.checkQueryIntent(queryLower, item.type);
      if (intentMatch.matched) {
        const boost = MediaMatchingSettings.INTENT_MATCH_BOOST;
        totalBoostMultiplier *= boost;
        boostFactors.push({ 
          name: `Intent match (${intentMatch.intent})`, 
          boost 
        });
      }

      // 8. Transcription matching (improved with phrase and word matching)
      const transcriptionMatch = this.checkTranscriptionMatch(item.content, queryLower, queryWords);
      if (transcriptionMatch.matched) {
        let boost = MediaMatchingSettings.TRANSCRIPTION_MATCH_BOOST;
        
        // Higher boost for phrase matches
        if (transcriptionMatch.hasPhraseMatch) {
          boost = MediaMatchingSettings.PHRASE_MATCH_BOOST;
        }
        
        // Scale boost based on match quality
        boost *= transcriptionMatch.matchStrength;
        totalBoostMultiplier *= boost;
        boostFactors.push({ 
          name: `Transcription match (${transcriptionMatch.matchType})`, 
          boost 
        });
      }

      // 9. Recency boosting (newer content gets slight boost)
      if (MediaMatchingSettings.RECENCY_BOOST_ENABLED && item.createdAt) {
        const recencyBoost = this.calculateRecencyBoost(item.createdAt);
        if (recencyBoost > 1.0) {
          totalBoostMultiplier *= recencyBoost;
          boostFactors.push({ 
            name: 'Recency boost', 
            boost: recencyBoost 
          });
        }
      }
    }

    // Apply total boost (multiplicative or additive based on settings)
    if (MediaMatchingSettings.USE_ADDITIVE_BOOSTS) {
      // Additive: add boost amount instead of multiplying
      const boostAmount = (totalBoostMultiplier - 1.0) * baseSimilarity;
      boostedSimilarity = baseSimilarity + boostAmount;
    } else {
      // Multiplicative: multiply similarity by boost
      boostedSimilarity = baseSimilarity * totalBoostMultiplier;
    }

    // Cap at maximum boost
    const maxBoosted = baseSimilarity * MediaMatchingSettings.MAX_TOTAL_BOOST;
    boostedSimilarity = Math.min(boostedSimilarity, maxBoosted);

    // Cap at 1.0 (similarity can't exceed 1.0)
    boostedSimilarity = Math.min(1.0, boostedSimilarity);

    // Log boost factors in development (optional)
    if (process.env.NODE_ENV === 'development' && boostFactors.length > 0) {
      console.log(`[Type-Aware Boosting] Item: ${item.title || item.id}`);
      console.log(`  Base similarity: ${baseSimilarity.toFixed(3)}`);
      boostFactors.forEach(factor => {
        console.log(`  + ${factor.name}: ${factor.boost.toFixed(3)}x`);
      });
      console.log(`  Final similarity: ${boostedSimilarity.toFixed(3)}`);
    }

    return boostedSimilarity;
  }

  /**
   * Extract meaningful words from query (removes stop words, short words)
   */
  private extractQueryWords(query: string): string[] {
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

    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Check if query matches media type
   */
  private checkTypeMatch(
    itemType: MediaType,
    query: string
  ): { matched: boolean; matchType: string } {
    const typeLower = itemType.toLowerCase();
    
    // Exact type match
    if (query.includes(typeLower)) {
      return { matched: true, matchType: 'exact' };
    }

    // Audio-specific variations
    if (itemType === MediaType.AUDIO) {
      const audioTerms = ['audio', 'sound', 'podcast', 'music', 'song', 'track', 'recording'];
      if (audioTerms.some(term => query.includes(term))) {
        return { matched: true, matchType: 'synonym' };
      }
    }

    // Video-specific variations
    if (itemType === MediaType.VIDEO) {
      const videoTerms = ['video', 'movie', 'clip', 'film', 'recording', 'stream', 'playback'];
      if (videoTerms.some(term => query.includes(term))) {
        return { matched: true, matchType: 'synonym' };
      }
    }

    return { matched: false, matchType: 'none' };
  }

  /**
   * Check if query matches platform (YouTube, Vimeo, etc.)
   */
  private checkPlatformMatch(
    url: string | undefined,
    query: string
  ): { matched: boolean; platform?: string } {
    if (!url) return { matched: false };

    const platforms = [
      { name: 'youtube', patterns: ['youtube', 'yt', 'youtu.be'], urlPattern: /youtube|youtu\.be/i },
      { name: 'vimeo', patterns: ['vimeo'], urlPattern: /vimeo/i },
      { name: 'dailymotion', patterns: ['dailymotion', 'dailymo'], urlPattern: /dailymotion/i },
      { name: 'tiktok', patterns: ['tiktok', 'tik tok'], urlPattern: /tiktok/i },
      { name: 'instagram', patterns: ['instagram', 'ig'], urlPattern: /instagram/i },
    ];

    for (const platform of platforms) {
      // Check if URL matches platform
      const urlMatches = platform.urlPattern.test(url);
      
      // Check if query mentions platform
      const queryMatches = platform.patterns.some(pattern => query.includes(pattern));

      if (urlMatches && queryMatches) {
        return { matched: true, platform: platform.name };
      }
    }

    return { matched: false };
  }

  /**
   * Check if query matches field (title or description)
   */
  private checkFieldMatch(
    fieldText: string,
    query: string,
    queryWords: string[]
  ): { matched: boolean; matchType: string; exactMatch: boolean } {
    const fieldLower = fieldText.toLowerCase();

    // Exact phrase match (strongest)
    if (fieldLower.includes(query)) {
      return { matched: true, matchType: 'exact phrase', exactMatch: true };
    }

    // All query words present (strong)
    const allWordsMatch = queryWords.every(word => fieldLower.includes(word));
    if (allWordsMatch && queryWords.length > 0) {
      return { matched: true, matchType: 'all words', exactMatch: true };
    }

    // Most query words present (medium)
    const matchingWords = queryWords.filter(word => fieldLower.includes(word));
    const matchRatio = matchingWords.length / queryWords.length;
    if (matchRatio >= 0.6 && queryWords.length > 1) {
      return { matched: true, matchType: 'most words', exactMatch: false };
    }

    // Some query words present (weak)
    if (matchingWords.length > 0) {
      return { matched: true, matchType: 'some words', exactMatch: false };
    }

    return { matched: false, matchType: 'none', exactMatch: false };
  }

  /**
   * Check if query matches format/codec
   */
  private checkFormatMatch(
    mimeType: string | undefined,
    url: string | undefined,
    query: string
  ): { matched: boolean; format?: string } {
    const formats = [
      { names: ['mp3', 'mpeg'], mime: /audio\/mpeg|audio\/mp3/i },
      { names: ['mp4', 'mpeg4'], mime: /video\/mp4/i },
      { names: ['wav', 'wave'], mime: /audio\/wav|audio\/wave/i },
      { names: ['webm'], mime: /video\/webm|audio\/webm/i },
      { names: ['ogg', 'ogv'], mime: /audio\/ogg|video\/ogg/i },
      { names: ['flac'], mime: /audio\/flac/i },
      { names: ['aac'], mime: /audio\/aac/i },
      { names: ['mov', 'quicktime'], mime: /video\/quicktime|video\/mov/i },
      { names: ['avi'], mime: /video\/x-msvideo|video\/avi/i },
    ];

    for (const format of formats) {
      // Check MIME type
      if (mimeType && format.mime.test(mimeType)) {
        // Check if query mentions format
        if (format.names.some(name => query.includes(name))) {
          return { matched: true, format: format.names[0] };
        }
      }

      // Check URL extension
      if (url) {
        const urlLower = url.toLowerCase();
        if (format.names.some(name => urlLower.includes(`.${name}`))) {
          if (format.names.some(name => query.includes(name))) {
            return { matched: true, format: format.names[0] };
          }
        }
      }
    }

    return { matched: false };
  }

  /**
   * Check if query contains media-specific keywords (expanded list)
   */
  private checkMediaKeywords(
    itemType: MediaType,
    query: string
  ): { matched: boolean; keywords: string[]; matchStrength: number } {
    const audioKeywords = [
      'audio', 'sound', 'recording', 'podcast', 'music', 'song', 'track',
      'audio file', 'sound file', 'audio recording', 'music track',
      'podcast episode', 'audio clip', 'sound clip', 'audio stream',
      'mp3', 'wav', 'flac', 'aac', 'ogg'
    ];

    const videoKeywords = [
      'video', 'movie', 'clip', 'film', 'recording', 'stream', 'playback',
      'video file', 'video clip', 'video recording', 'movie clip',
      'film clip', 'video stream', 'online video', 'video link',
      'mp4', 'webm', 'mov', 'avi', 'youtube', 'vimeo'
    ];

    const keywords = itemType === MediaType.AUDIO ? audioKeywords : videoKeywords;
    const matchedKeywords = keywords.filter(keyword => query.includes(keyword));

    if (matchedKeywords.length > 0) {
      // Calculate match strength based on number of matches
      const matchStrength = Math.min(1.0, 0.8 + (matchedKeywords.length * 0.05));
      return { matched: true, keywords: matchedKeywords, matchStrength };
    }

    return { matched: false, keywords: [], matchStrength: 1.0 };
  }

  /**
   * Detect query intent (tutorial, review, music, etc.)
   */
  private checkQueryIntent(
    query: string,
    itemType: MediaType
  ): { matched: boolean; intent?: string } {
    const intents = [
      {
        name: 'tutorial',
        keywords: ['tutorial', 'how to', 'learn', 'guide', 'course', 'lesson', 'teach', 'explain', 'walkthrough']
      },
      {
        name: 'review',
        keywords: ['review', 'opinion', 'thoughts', 'rating', 'critique', 'analysis', 'evaluation']
      },
      {
        name: 'music',
        keywords: ['music', 'song', 'track', 'album', 'artist', 'musician', 'band', 'lyrics', 'melody'],
        types: [MediaType.AUDIO]
      },
      {
        name: 'interview',
        keywords: ['interview', 'conversation', 'discussion', 'talk', 'chat', 'q&a', 'qa']
      },
      {
        name: 'lecture',
        keywords: ['lecture', 'presentation', 'talk', 'speech', 'seminar', 'webinar']
      },
      {
        name: 'demo',
        keywords: ['demo', 'demonstration', 'example', 'sample', 'showcase', 'preview']
      },
      {
        name: 'news',
        keywords: ['news', 'report', 'update', 'breaking', 'latest', 'current events']
      },
    ];

    for (const intent of intents) {
      // Check if intent is relevant for this media type
      if (intent.types && !intent.types.includes(itemType)) {
        continue;
      }

      // Check if query contains intent keywords
      if (intent.keywords.some(keyword => query.includes(keyword))) {
        return { matched: true, intent: intent.name };
      }
    }

    return { matched: false };
  }

  /**
   * Check if query matches transcription content (improved)
   */
  private checkTranscriptionMatch(
    content: string | undefined,
    query: string,
    queryWords: string[]
  ): {
    matched: boolean;
    matchType: string;
    matchStrength: number;
    hasPhraseMatch: boolean;
  } {
    if (!content) {
      return { matched: false, matchType: 'none', matchStrength: 1.0, hasPhraseMatch: false };
    }

    const contentLower = content.toLowerCase();
    
    // Extract transcription text (if it's in content field with "transcription:" prefix)
    let transcriptionText = contentLower;
    if (contentLower.includes('transcription:')) {
      transcriptionText = contentLower.split('transcription:')[1]?.trim() || contentLower;
    }

    // Exact phrase match (strongest)
    if (transcriptionText.includes(query)) {
      return {
        matched: true,
        matchType: 'exact phrase',
        matchStrength: 1.0,
        hasPhraseMatch: true
      };
    }

    // Check for phrase matches (2+ consecutive words)
    if (queryWords.length >= 2) {
      for (let i = 0; i <= queryWords.length - 2; i++) {
        const phrase = queryWords.slice(i, i + 2).join(' ');
        if (transcriptionText.includes(phrase)) {
          return {
            matched: true,
            matchType: 'phrase',
            matchStrength: 0.9,
            hasPhraseMatch: true
          };
        }
      }
    }

    // All query words present
    const allWordsMatch = queryWords.every(word => transcriptionText.includes(word));
    if (allWordsMatch && queryWords.length > 0) {
      return {
        matched: true,
        matchType: 'all words',
        matchStrength: 0.85,
        hasPhraseMatch: false
      };
    }

    // Most query words present
    const matchingWords = queryWords.filter(word => transcriptionText.includes(word));
    const matchRatio = matchingWords.length / queryWords.length;
    
    if (matchRatio >= 0.6 && queryWords.length > 1) {
      return {
        matched: true,
        matchType: 'most words',
        matchStrength: 0.7,
        hasPhraseMatch: false
      };
    }

    // Some query words present
    if (matchingWords.length > 0) {
      return {
        matched: true,
        matchType: 'some words',
        matchStrength: 0.5,
        hasPhraseMatch: false
      };
    }

    return { matched: false, matchType: 'none', matchStrength: 1.0, hasPhraseMatch: false };
  }

  /**
   * Calculate recency boost (newer content gets slight boost)
   */
  private calculateRecencyBoost(createdAt: Date): number {
    if (!MediaMatchingSettings.RECENCY_BOOST_ENABLED) {
      return 1.0;
    }

    const now = new Date();
    const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    // No boost if older than max days
    if (daysSinceCreation > MediaMatchingSettings.RECENCY_BOOST_MAX_DAYS) {
      return 1.0;
    }

    // Linear decay: full boost for 0 days, no boost at max days
    const boostRatio = 1 - (daysSinceCreation / MediaMatchingSettings.RECENCY_BOOST_MAX_DAYS);
    const boost = 1.0 + (MediaMatchingSettings.RECENCY_BOOST_MULTIPLIER - 1.0) * boostRatio;

    return boost;
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
          let baseSimilarity = row.similarity ?? (1 - (row.distance ?? 0));
          
          // Apply type-aware boosting
          baseSimilarity = this.applyTypeAwareBoosting(item, query, baseSimilarity);
          
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
        .sort((a: { relevanceScore?: number; similarity: number }, b: { relevanceScore?: number; similarity: number }) => (b.relevanceScore ?? b.similarity) - (a.relevanceScore ?? a.similarity));

      // Calculate average similarity
      const averageSimilarity = filteredResults.length > 0
        ? filteredResults.reduce((sum: number, r: { similarity: number }) => sum + r.similarity, 0) / filteredResults.length
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
        const avgSim = filteredResults.reduce((sum: number, r: { similarity: number }) => sum + r.similarity, 0) / filteredResults.length;
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

  /**
   * Fuzzy search using Levenshtein distance
   * Finds items even with typos or partial matches
   * 
   * @param query - Search query (can have typos)
   * @param limit - Maximum number of results
   * @param minScore - Minimum fuzzy match score (0-1)
   * @param searchFields - Fields to search in (default: all)
   * @returns Array of search results with fuzzy match scores
   */
  async fuzzySearch(
    query: string,
    limit: number = FuzzySearchSettings.DEFAULT_LIMIT,
    minScore: number = FuzzySearchSettings.DEFAULT_MIN_SCORE,
    searchFields: ('title' | 'description' | 'content')[] = [...FuzzySearchSettings.DEFAULT_SEARCH_FIELDS]
  ): Promise<Array<{
    item: MediaItem;
    fuzzyScore: number;
    matchedField: string;
    matchedText?: string;
  }>> {
    if (!query || query.trim() === '') {
      return [];
    }

    const validatedLimit = validateLimit(limit);
    const queryLower = query.toLowerCase().trim();

    // Get all media items
    const allItems = await this.mediaRepository.find();

    const results: Array<{
      item: MediaItem;
      fuzzyScore: number;
      matchedField: string;
      matchedText?: string;
    }> = [];

    for (const item of allItems) {
      let bestScore = 0;
      let bestField = '';
      let matchedText = '';

      // Search in title
      if (searchFields.includes('title') && item.title) {
        const titleScore = fuzzyMatch(item.title, queryLower, minScore);
        if (titleScore > bestScore) {
          bestScore = titleScore;
          bestField = 'title';
          matchedText = item.title;
        }
      }

      // Search in description
      if (searchFields.includes('description') && item.description) {
        const descScore = fuzzyMatch(item.description, queryLower, minScore);
        if (descScore > bestScore) {
          bestScore = descScore;
          bestField = 'description';
          matchedText = item.description.substring(0, 100);
        }
      }

      // Search in content
      if (searchFields.includes('content') && item.content) {
        const contentScore = fuzzyMatch(item.content, queryLower, minScore);
        if (contentScore > bestScore) {
          bestScore = contentScore;
          bestField = 'content';
          matchedText = item.content.substring(0, 100);
        }
      }

      // Add to results if score meets threshold
      if (bestScore >= minScore) {
        results.push({
          item,
          fuzzyScore: bestScore,
          matchedField: bestField,
          matchedText: matchedText || undefined,
        });
      }
    }

    // Sort by fuzzy score (descending) and limit
    return results
      .sort((a, b) => b.fuzzyScore - a.fuzzyScore)
      .slice(0, validatedLimit);
  }
}

