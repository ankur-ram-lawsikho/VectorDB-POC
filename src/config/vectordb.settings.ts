/**
 * VectorDB Settings & Configuration
 * 
 * Centralized configuration for all VectorDB features including:
 * - Similarity thresholds and strictness
 * - Search parameters
 * - Recommendation settings
 * - Embedding configuration
 */

/**
 * Similarity Threshold Settings
 * Controls how strict the similarity matching is
 */
export const SimilaritySettings = {
  /**
   * Default minimum similarity threshold (0-1)
   * Higher = more strict (fewer, more relevant results)
   * Lower = more permissive (more, less relevant results)
   */
  DEFAULT_MIN_SIMILARITY: 0.3,

  /**
   * Strict similarity threshold
   * Use for high-quality, highly relevant results only
   */
  STRICT_MIN_SIMILARITY: 0.7,

  /**
   * Moderate similarity threshold
   * Balanced between relevance and coverage
   */
  MODERATE_MIN_SIMILARITY: 0.5,

  /**
   * Permissive similarity threshold
   * More diverse results, may include less relevant items
   */
  PERMISSIVE_MIN_SIMILARITY: 0.1,

  /**
   * Very permissive similarity threshold
   * Maximum coverage, includes all results
   */
  VERY_PERMISSIVE_MIN_SIMILARITY: 0.0,

  /**
   * Progressive threshold lowering steps
   * Used when not enough results found with default threshold
   * System will try these thresholds in order until enough results are found
   */
  PROGRESSIVE_THRESHOLDS: [0.2, 0.1, 0.05, 0.0],

  /**
   * Strong semantic match threshold
   * Results above this are considered "strong matches"
   */
  STRONG_MATCH_THRESHOLD: 0.5,
} as const;

/**
 * Distance Threshold Settings
 * Controls maximum distance for similarity search
 */
export const DistanceSettings = {
  /**
   * Default max distance for cosine similarity (0-2)
   * Lower = more strict, Higher = more permissive
   */
  DEFAULT_COSINE_MAX_DISTANCE: 0.5,

  /**
   * Default max distance for L2/Euclidean similarity
   */
  DEFAULT_L2_MAX_DISTANCE: 1.0,

  /**
   * Default max distance for inner product
   */
  DEFAULT_INNER_PRODUCT_MAX_DISTANCE: 0.5,

  /**
   * Adaptive threshold for semantic search
   * Very permissive to capture semantic relationships
   */
  SEMANTIC_SEARCH_ADAPTIVE_THRESHOLD: 1.0,
} as const;

/**
 * Result Limit Settings
 * Controls how many results are returned by default
 */
export const LimitSettings = {
  /**
   * Default limit for search results
   */
  DEFAULT_SEARCH_LIMIT: 10,

  /**
   * Default limit for recommendations
   */
  DEFAULT_RECOMMENDATION_LIMIT: 10,

  /**
   * Default limit for similar items
   */
  DEFAULT_SIMILAR_ITEMS_LIMIT: 10,

  /**
   * Maximum limit allowed (safety limit)
   */
  MAX_LIMIT: 100,

  /**
   * Minimum limit allowed
   */
  MIN_LIMIT: 1,

  /**
   * Candidate multiplier for filtering
   * Gets N times more candidates than requested for better filtering
   */
  CANDIDATE_MULTIPLIER: 2,

  /**
   * Semantic search candidate multiplier
   * Gets more candidates for semantic analysis
   */
  SEMANTIC_CANDIDATE_MULTIPLIER: 5,
} as const;

/**
 * Semantic Search Settings
 * Configuration for semantic search features
 */
export const SemanticSearchSettings = {
  /**
   * Default minimum similarity for semantic search
   */
  DEFAULT_MIN_SIMILARITY: 0.3,

  /**
   * Include related concepts by default
   */
  DEFAULT_INCLUDE_RELATED: true,

  /**
   * Enable context boosting by default
   */
  DEFAULT_CONTEXT_BOOST: true,

  /**
   * Title match boost score
   */
  TITLE_MATCH_BOOST: 0.1,

  /**
   * Partial word match boost per word
   */
  PARTIAL_WORD_MATCH_BOOST: 0.05,

  /**
   * Description match boost
   */
  DESCRIPTION_MATCH_BOOST: 0.05,
} as const;

/**
 * Recommendation Settings
 * Configuration for recommendation system
 */
export const RecommendationSettings = {
  /**
   * Default minimum similarity for recommendations
   */
  DEFAULT_MIN_SIMILARITY: 0.5,

  /**
   * Default limit for recommendations
   */
  DEFAULT_LIMIT: 6,

  /**
   * Default limit for detail page recommendations
   */
  DETAIL_PAGE_LIMIT: 6,

  /**
   * Hybrid recommendation weights
   */
  HYBRID_WEIGHTS: {
    ITEM_BASED: 0.5,
    CONTENT_BASED: 0.5,
  },

  /**
   * Progressive threshold lowering for recommendations ONLY
   * Used when not enough results found with DEFAULT_MIN_SIMILARITY
   * System will try these thresholds in order until enough results are found
   * Set to empty array [] to disable progressive lowering
   */
  PROGRESSIVE_THRESHOLDS: [0.4, 0.3, 0.2, 0.1, 0.05, 0.0],
} as const;

/**
 * Embedding Settings
 * Configuration for embedding generation
 */
export const EmbeddingSettings = {
  /**
   * Embedding model name
   */
  MODEL_NAME: 'text-embedding-004',

  /**
   * Embedding dimension (vector size)
   */
  DIMENSION: 768,

  /**
   * Rate limiting delay between API calls (ms)
   */
  RATE_LIMIT_DELAY: 100,

  /**
   * Auto-backfill on startup
   */
  AUTO_BACKFILL_ON_STARTUP: true,
} as const;

/**
 * Search Settings
 * General search configuration
 */
export const SearchSettings = {
  /**
   * Default search limit
   */
  DEFAULT_LIMIT: 20,

  /**
   * Default distance metric
   */
  DEFAULT_METRIC: 'cosine' as const,

  /**
   * Enable logging for search operations
   */
  ENABLE_LOGGING: true,
} as const;

/**
 * Database Settings
 * Configuration for database operations
 */
export const DatabaseSettings = {
  /**
   * Enable TypeORM synchronization
   * WARNING: Set to false in production
   */
  SYNCHRONIZE: true,

  /**
   * Enable query logging
   */
  ENABLE_LOGGING: false,
} as const;

/**
 * Performance Settings
 * Configuration for performance optimization
 */
export const PerformanceSettings = {
  /**
   * Enable caching (if implemented)
   */
  ENABLE_CACHING: false,

  /**
   * Cache TTL in seconds
   */
  CACHE_TTL: 3600,

  /**
   * Batch size for bulk operations
   */
  BATCH_SIZE: 100,
} as const;

/**
 * Export all settings as a single object for easy access
 */
export const VectorDBSettings = {
  similarity: SimilaritySettings,
  distance: DistanceSettings,
  limits: LimitSettings,
  semantic: SemanticSearchSettings,
  recommendations: RecommendationSettings,
  embeddings: EmbeddingSettings,
  search: SearchSettings,
  database: DatabaseSettings,
  performance: PerformanceSettings,
} as const;

/**
 * Helper function to get similarity threshold by strictness level
 */
export function getSimilarityThreshold(level: 'strict' | 'moderate' | 'default' | 'permissive' | 'very-permissive'): number {
  switch (level) {
    case 'strict':
      return SimilaritySettings.STRICT_MIN_SIMILARITY;
    case 'moderate':
      return SimilaritySettings.MODERATE_MIN_SIMILARITY;
    case 'permissive':
      return SimilaritySettings.PERMISSIVE_MIN_SIMILARITY;
    case 'very-permissive':
      return SimilaritySettings.VERY_PERMISSIVE_MIN_SIMILARITY;
    case 'default':
    default:
      return SimilaritySettings.DEFAULT_MIN_SIMILARITY;
  }
}

/**
 * Helper function to get max distance by metric
 */
export function getMaxDistance(metric: 'cosine' | 'l2' | 'inner_product'): number {
  switch (metric) {
    case 'cosine':
      return DistanceSettings.DEFAULT_COSINE_MAX_DISTANCE;
    case 'l2':
      return DistanceSettings.DEFAULT_L2_MAX_DISTANCE;
    case 'inner_product':
      return DistanceSettings.DEFAULT_INNER_PRODUCT_MAX_DISTANCE;
    default:
      return DistanceSettings.DEFAULT_COSINE_MAX_DISTANCE;
  }
}

/**
 * Helper function to validate and clamp limit value
 */
export function validateLimit(limit: number): number {
  return Math.max(
    LimitSettings.MIN_LIMIT,
    Math.min(LimitSettings.MAX_LIMIT, limit)
  );
}

/**
 * Helper function to validate similarity threshold
 */
export function validateSimilarity(similarity: number): number {
  return Math.max(0, Math.min(1, similarity));
}

