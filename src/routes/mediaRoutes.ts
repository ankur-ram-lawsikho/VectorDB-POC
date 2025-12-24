import express, { Request, Response } from 'express';
import { MediaService } from '../services/mediaService';
import { MediaType } from '../entities/MediaItem';
import { upload } from '../middleware/upload';
import path from 'path';

const router = express.Router();
const mediaService = new MediaService();

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

    console.log(`Search request: query="${query}", limit=${limit || 10}, maxDistance=${maxDistance || 'default'}, metric=${metric || 'cosine'}`);

    const results = await mediaService.searchMedia(
      query,
      limit || 10,
      maxDistance,
      metric || 'cosine'
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

// Find similar media items to a given media item (must be before /:id route)
router.get('/:id/similar', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const maxDistance = req.query.maxDistance ? parseFloat(req.query.maxDistance as string) : undefined;
    const metric = (req.query.metric as 'cosine' | 'l2' | 'inner_product') || 'cosine';

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

export default router;

