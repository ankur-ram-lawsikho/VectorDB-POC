import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import { EmbeddingSettings, MediaMatchingSettings } from '../config/vectordb.settings';
import { MediaItem, MediaType } from '../entities/MediaItem';
import { 
  extractFileMetadata, 
  generateEnhancedTextForMedia,
  extractMediaKeywords 
} from './mediaMetadata';
import { getOrGenerateTranscription } from './transcription';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }

  try {
    // Use the embedding model from settings
    // It produces 768-dimensional vectors (from EmbeddingSettings.DIMENSION)
    const model = genAI.getGenerativeModel({ model: EmbeddingSettings.MODEL_NAME });
    
    const result = await model.embedContent(text);
    
    // The embedding response structure varies by model
    // For text-embedding-004: result.embedding.values
    // For older models: result.embeddings (array)
    let embedding: number[] | Float32Array | undefined;
    
    if (result.embedding?.values) {
      embedding = result.embedding.values;
    } else {
      // Fallback: check if result has embeddings property (for older API structure)
      const resultAny = result as unknown as { embeddings?: number[][] };
      if (resultAny.embeddings && resultAny.embeddings.length > 0) {
        embedding = resultAny.embeddings[0];
      }
    }

    if (!embedding || embedding.length === 0) {
      throw new Error('Failed to generate embedding from Gemini API');
    }

    // Convert to array of numbers (handles Float32Array, regular arrays, etc.)
    return Array.from(embedding);
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Prepare text for embedding with enhanced support for audio/video
 * 
 * @param item - Media item (optional, for enhanced audio/video processing)
 * @param title - Title
 * @param description - Description
 * @param content - Content
 * @returns Enhanced text string for embedding
 */
export async function prepareTextForEmbedding(
  title?: string,
  description?: string,
  content?: string,
  item?: MediaItem
): Promise<string> {
  // For audio/video items, use enhanced text preparation
  if (item && (item.type === MediaType.AUDIO || item.type === MediaType.VIDEO)) {
    return await prepareEnhancedTextForMedia(item, title, description, content);
  }

  // For other types, use simple concatenation
  const parts: string[] = [];
  if (title) parts.push(title);
  if (description) parts.push(description);
  if (content) parts.push(content);
  return parts.join(' ');
}

/**
 * Prepare enhanced text for audio/video media items
 * Includes metadata, transcription, and contextual information
 */
async function prepareEnhancedTextForMedia(
  item: MediaItem,
  title?: string,
  description?: string,
  content?: string
): Promise<string> {
  const parts: string[] = [];

  // Use provided title or item title
  const itemTitle = title || item.title;
  if (itemTitle) {
    parts.push(itemTitle);
  }

  // Use provided description or item description
  const itemDescription = description || item.description;
  if (itemDescription) {
    parts.push(itemDescription);
  }

  // Extract metadata if enabled (works for both file paths and URLs)
  let metadata;
  if (MediaMatchingSettings.ENABLE_METADATA_EXTRACTION) {
    try {
      metadata = await extractFileMetadata(
        item.filePath, 
        item.mimeType, 
        item.type,
        item.url // Pass URL for YouTube/online video support
      );
    } catch (error) {
      console.warn(`Error extracting metadata for item ${item.id}:`, error);
    }
  }

  // Generate enhanced text with metadata
  if (MediaMatchingSettings.INCLUDE_METADATA_IN_EMBEDDINGS && metadata) {
    const enhancedText = generateEnhancedTextForMedia(item, metadata);
    // Add enhanced text (but avoid duplicating title/description)
    const enhancedParts = enhancedText.split(' ').filter(part => {
      const partLower = part.toLowerCase();
      return !itemTitle?.toLowerCase().includes(partLower) && 
             !itemDescription?.toLowerCase().includes(partLower);
    });
    parts.push(...enhancedParts);
  }

  // Add transcription if enabled and available
  if (MediaMatchingSettings.ENABLE_TRANSCRIPTION && 
      MediaMatchingSettings.INCLUDE_TRANSCRIPTION_IN_EMBEDDINGS) {
    try {
      const transcription = await getOrGenerateTranscription(item);
      if (transcription) {
        parts.push(`transcription: ${transcription}`);
      }
    } catch (error) {
      console.warn(`Error getting transcription for item ${item.id}:`, error);
    }
  }

  // Add keywords for better matching
  if (metadata) {
    const keywords = extractMediaKeywords(item, metadata);
    parts.push(...keywords);
  }

  // Add content if provided
  if (content) {
    parts.push(content);
  } else if (item.content) {
    parts.push(item.content);
  }

  return parts.join(' ');
}

