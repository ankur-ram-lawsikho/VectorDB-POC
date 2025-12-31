import express, { Request, Response } from 'express';
import { MediaService } from '../services/mediaService';
import { MediaType } from '../entities/MediaItem';
import { upload } from '../middleware/upload';
import { RecommendationService } from '../services/recommendationService';
import { 
  LimitSettings, 
  SimilaritySettings, 
  SemanticSearchSettings,
  RecommendationSettings,
  SearchSettings,
  FuzzySearchSettings
} from '../config/vectordb.settings';
import path from 'path';

const router = express.Router();
const mediaService = new MediaService();
const recommendationService = new RecommendationService();

// Get all media items
router.get('/', async (req: Request, res: Response) => {
  try {
    const mediaItems = await mediaService.getAllMedia();
    res.json(mediaItems);
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Failed to fetch media items' });
  }
});

// Get statistics about embeddings
router.get('/stats/embeddings', async (req: Request, res: Response) => {
  try {
    const stats = await mediaService.getEmbeddingStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching embedding stats:', error);
    res.status(500).json({ error: 'Failed to fetch embedding statistics' });
  }
});

// Create text media item
router.post('/text', async (req: Request, res: Response) => {
  try {
    const { title, content, description } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const mediaItem = await mediaService.createMediaItem(
      title,
      MediaType.TEXT,
      content,
      description
    );

    res.status(201).json(mediaItem);
  } catch (error) {
    console.error('Error creating text media:', error);
    res.status(500).json({ error: 'Failed to create text media item' });
  }
});

// Create video link media item
router.post('/video', async (req: Request, res: Response) => {
  try {
    const { title, url, description } = req.body;

    if (!title || !url) {
      return res.status(400).json({ error: 'Title and URL are required' });
    }

    const mediaItem = await mediaService.createMediaItem(
      title,
      MediaType.VIDEO,
      undefined,
      description,
      undefined,
      url
    );

    res.status(201).json(mediaItem);
  } catch (error) {
    console.error('Error creating video media:', error);
    res.status(500).json({ error: 'Failed to create video media item' });
  }
});

// Upload audio file
router.post('/audio', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const mediaItem = await mediaService.createMediaItem(
      title,
      MediaType.AUDIO,
      undefined,
      description,
      req.file.path,
      undefined,
      req.file.mimetype
    );

    res.status(201).json(mediaItem);
  } catch (error) {
    console.error('Error uploading audio:', error);
    res.status(500).json({ error: 'Failed to upload audio file' });
  }
});

// Upload image file
router.post('/image', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const mediaItem = await mediaService.createMediaItem(
      title,
      MediaType.IMAGE,
      undefined,
      description,
      req.file.path,
      undefined,
      req.file.mimetype
    );

    res.status(201).json(mediaItem);
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image file' });
  }
});

// Search media items by text query
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, limit, maxDistance, metric } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    console.log(`Search request: query="${query}", limit=${limit || LimitSettings.DEFAULT_SEARCH_LIMIT}, maxDistance=${maxDistance || 'default'}, metric=${metric || SearchSettings.DEFAULT_METRIC}`);

    const results = await mediaService.searchMedia(
      query,
      limit || LimitSettings.DEFAULT_SEARCH_LIMIT,
      maxDistance,
      metric || SearchSettings.DEFAULT_METRIC
    );
    
    res.json({
      query,
      count: results.length,
      results: results.map(r => ({
        ...r.item,
        similarity: r.similarity,
        distance: r.distance,
      })),
    });
  } catch (error) {
    console.error('Error searching media:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: 'Failed to search media items', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to search media items' });
    }
  }
});

// Semantic search endpoint - understands meaning and context
router.post('/search/semantic', async (req: Request, res: Response) => {
  try {
    const { query, limit, minSimilarity, includeRelated, contextBoost } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    console.log(`Semantic search request: query="${query}", limit=${limit || LimitSettings.DEFAULT_SEARCH_LIMIT}`);

    const result = await mediaService.semanticSearch(
      query,
      limit || LimitSettings.DEFAULT_SEARCH_LIMIT,
      {
        minSimilarity: minSimilarity || SemanticSearchSettings.DEFAULT_MIN_SIMILARITY,
        includeRelated: includeRelated !== false ? SemanticSearchSettings.DEFAULT_INCLUDE_RELATED : false,
        contextBoost: contextBoost !== false ? SemanticSearchSettings.DEFAULT_CONTEXT_BOOST : false,
      }
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error in semantic search:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: 'Failed to perform semantic search', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to perform semantic search' });
    }
  }
});

// Fuzzy search endpoint - typo-tolerant search
router.post('/search/fuzzy', async (req: Request, res: Response) => {
  try {
    const { query, limit, minScore, searchFields } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    console.log(`Fuzzy search request: query="${query}", limit=${limit || FuzzySearchSettings.DEFAULT_LIMIT}`);

    const results = await mediaService.fuzzySearch(
      query,
      limit || FuzzySearchSettings.DEFAULT_LIMIT,
      minScore || FuzzySearchSettings.DEFAULT_MIN_SCORE,
      searchFields || [...FuzzySearchSettings.DEFAULT_SEARCH_FIELDS]
    );
    
    res.json({
      query,
      count: results.length,
      results: results.map(r => ({
        ...r.item,
        fuzzyScore: r.fuzzyScore,
        matchedField: r.matchedField,
        matchedText: r.matchedText,
      })),
      metadata: {
        searchType: 'fuzzy',
        averageScore: results.length > 0
          ? results.reduce((sum, r) => sum + r.fuzzyScore, 0) / results.length
          : 0,
        minScore: results.length > 0 ? Math.min(...results.map(r => r.fuzzyScore)) : 0,
        maxScore: results.length > 0 ? Math.max(...results.map(r => r.fuzzyScore)) : 0,
      },
    });
  } catch (error) {
    console.error('Error in fuzzy search:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: 'Failed to perform fuzzy search', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to perform fuzzy search' });
    }
  }
});

// Find similar media items to a given media item (must be before /:id route)
router.get('/:id/similar', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || LimitSettings.DEFAULT_SIMILAR_ITEMS_LIMIT;
    const maxDistance = req.query.maxDistance ? parseFloat(req.query.maxDistance as string) : undefined;
    const metric = (req.query.metric as 'cosine' | 'l2' | 'inner_product') || SearchSettings.DEFAULT_METRIC;

    const results = await mediaService.findSimilarMedia(id, limit, maxDistance, metric);
    
    res.json({
      sourceId: id,
      count: results.length,
      results: results.map(r => ({
        ...r.item,
        similarity: r.similarity,
        distance: r.distance,
      })),
    });
  } catch (error) {
    console.error('Error finding similar media:', error);
    if (error instanceof Error && error.message === 'Media item not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof Error && error.message.includes('embedding')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to find similar media items' });
  }
});

// Get media item by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const mediaItem = await mediaService.getMediaById(req.params.id);
    if (!mediaItem) {
      return res.status(404).json({ error: 'Media item not found' });
    }
    res.json(mediaItem);
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Failed to fetch media item' });
  }
});

// Delete media item
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await mediaService.deleteMedia(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Media item not found' });
    }
    res.json({ message: 'Media item deleted successfully' });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ error: 'Failed to delete media item' });
  }
});

// Serve uploaded files
router.get('/file/:id', async (req: Request, res: Response) => {
  try {
    const mediaItem = await mediaService.getMediaById(req.params.id);
    if (!mediaItem || !mediaItem.filePath) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.resolve(mediaItem.filePath);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// ==================== RECOMMENDATION ENDPOINTS ====================

/**
 * Get item-based recommendations
 * GET /api/media/recommendations/item/:id
 * Query params: limit, minSimilarity, excludeIds (comma-separated)
 */
router.get('/recommendations/item/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || RecommendationSettings.DEFAULT_LIMIT;
    const minSimilarity = req.query.minSimilarity 
      ? parseFloat(req.query.minSimilarity as string) 
      : RecommendationSettings.DEFAULT_MIN_SIMILARITY;
    const excludeIds = req.query.excludeIds 
      ? (req.query.excludeIds as string).split(',').filter(id => id.trim())
      : [];

    const result = await recommendationService.getItemBasedRecommendations(
      id,
      limit,
      minSimilarity,
      excludeIds
    );

    res.json(result);
  } catch (error) {
    console.error('Error getting item-based recommendations:', error);
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('embedding')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to get recommendations', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to get recommendations' });
    }
  }
});

/**
 * Get multi-item based recommendations
 * POST /api/media/recommendations/multi-item
 * Body: { itemIds: string[], limit?: number, minSimilarity?: number, excludeIds?: string[] }
 */
router.post('/recommendations/multi-item', async (req: Request, res: Response) => {
  try {
    const { 
      itemIds, 
      limit = RecommendationSettings.DEFAULT_LIMIT, 
      minSimilarity = RecommendationSettings.DEFAULT_MIN_SIMILARITY, 
      excludeIds = [] 
    } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'itemIds array is required' });
    }

    const result = await recommendationService.getMultiItemRecommendations(
      itemIds,
      limit,
      minSimilarity,
      excludeIds
    );

    res.json(result);
  } catch (error) {
    console.error('Error getting multi-item recommendations:', error);
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('No source items')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('embedding')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to get recommendations', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to get recommendations' });
    }
  }
});

/**
 * Get content-based recommendations
 * POST /api/media/recommendations/content-based
 * Body: { query: string, limit?: number, minSimilarity?: number, excludeIds?: string[] }
 */
router.post('/recommendations/content-based', async (req: Request, res: Response) => {
  try {
    const { 
      query, 
      limit = RecommendationSettings.DEFAULT_LIMIT, 
      minSimilarity = RecommendationSettings.DEFAULT_MIN_SIMILARITY, 
      excludeIds = [] 
    } = req.body;

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({ error: 'query is required' });
    }

    const result = await recommendationService.getContentBasedRecommendations(
      query,
      limit,
      minSimilarity,
      excludeIds
    );

    res.json(result);
  } catch (error) {
    console.error('Error getting content-based recommendations:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: 'Failed to get recommendations', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to get recommendations' });
    }
  }
});

/**
 * Get hybrid recommendations
 * POST /api/media/recommendations/hybrid
 * Body: { 
 *   itemIds?: string[], 
 *   query?: string, 
 *   limit?: number, 
 *   minSimilarity?: number, 
 *   excludeIds?: string[],
 *   weights?: { itemBased?: number, contentBased?: number }
 * }
 */
router.post('/recommendations/hybrid', async (req: Request, res: Response) => {
  try {
    const { 
      itemIds, 
      query, 
      limit = RecommendationSettings.DEFAULT_LIMIT, 
      minSimilarity = RecommendationSettings.DEFAULT_MIN_SIMILARITY, 
      excludeIds = [],
      weights = RecommendationSettings.HYBRID_WEIGHTS
    } = req.body;

    if ((!itemIds || itemIds.length === 0) && (!query || query.trim() === '')) {
      return res.status(400).json({ 
        error: 'Either itemIds or query must be provided for hybrid recommendations' 
      });
    }

    const result = await recommendationService.getHybridRecommendations({
      itemIds,
      query,
      limit,
      minSimilarity,
      excludeIds,
      weights,
    });

    res.json(result);
  } catch (error) {
    console.error('Error getting hybrid recommendations:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: 'Failed to get recommendations', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to get recommendations' });
    }
  }
});

/**
 * Get recommendations (auto-detect strategy)
 * POST /api/media/recommendations
 * Body: { 
 *   itemId?: string,
 *   itemIds?: string[],
 *   query?: string,
 *   strategy?: 'item-based' | 'multi-item' | 'content-based' | 'hybrid',
 *   limit?: number,
 *   minSimilarity?: number,
 *   excludeIds?: string[],
 *   weights?: { itemBased?: number, contentBased?: number }
 * }
 */
router.post('/recommendations', async (req: Request, res: Response) => {
  try {
    const { 
      itemId,
      itemIds,
      query,
      strategy,
      limit = RecommendationSettings.DEFAULT_LIMIT,
      minSimilarity = RecommendationSettings.DEFAULT_MIN_SIMILARITY,
      excludeIds = [],
      weights = RecommendationSettings.HYBRID_WEIGHTS
    } = req.body;

    // Auto-detect strategy if not specified
    let detectedStrategy = strategy;
    if (!detectedStrategy) {
      if (itemId) {
        detectedStrategy = 'item-based';
      } else if (itemIds && itemIds.length > 0) {
        detectedStrategy = itemIds.length === 1 ? 'item-based' : 'multi-item';
      } else if (query) {
        detectedStrategy = 'content-based';
      } else if ((itemIds && itemIds.length > 0) || query) {
        detectedStrategy = 'hybrid';
      } else {
        return res.status(400).json({ 
          error: 'Must provide itemId, itemIds, or query for recommendations' 
        });
      }
    }

    let result;
    switch (detectedStrategy) {
      case 'item-based':
        if (!itemId && (!itemIds || itemIds.length === 0)) {
          return res.status(400).json({ error: 'itemId or itemIds required for item-based recommendations' });
        }
        const idToUse = itemId || (itemIds && itemIds[0]);
        result = await recommendationService.getItemBasedRecommendations(
          idToUse,
          limit,
          minSimilarity,
          excludeIds
        );
        break;

      case 'multi-item':
        if (!itemIds || itemIds.length === 0) {
          return res.status(400).json({ error: 'itemIds array required for multi-item recommendations' });
        }
        result = await recommendationService.getMultiItemRecommendations(
          itemIds,
          limit,
          minSimilarity,
          excludeIds
        );
        break;

      case 'content-based':
        if (!query || query.trim() === '') {
          return res.status(400).json({ error: 'query required for content-based recommendations' });
        }
        result = await recommendationService.getContentBasedRecommendations(
          query,
          limit,
          minSimilarity,
          excludeIds
        );
        break;

      case 'hybrid':
        result = await recommendationService.getHybridRecommendations({
          itemIds: itemIds || (itemId ? [itemId] : []),
          query,
          limit,
          minSimilarity,
          excludeIds,
          weights,
        });
        break;

      default:
        return res.status(400).json({ error: `Unknown strategy: ${detectedStrategy}` });
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting recommendations:', error);
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('embedding')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to get recommendations', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to get recommendations' });
    }
  }
});

export default router;

