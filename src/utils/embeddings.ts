import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import { EmbeddingSettings } from '../config/vectordb.settings';

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

export function prepareTextForEmbedding(
  title?: string,
  description?: string,
  content?: string
): string {
  // Use only title, description, and content for embeddings (for all media types)
  const parts: string[] = [];
  if (title) parts.push(title);
  if (description) parts.push(description);
  if (content) parts.push(content);
  return parts.join(' ');
}

