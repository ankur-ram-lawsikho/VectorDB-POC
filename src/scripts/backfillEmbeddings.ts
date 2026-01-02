import { AppDataSource } from '../config/database';
import { MediaItem } from '../entities/MediaItem';
import { generateEmbedding, prepareTextForEmbedding } from '../utils/embeddings';
import * as dotenv from 'dotenv';

dotenv.config();

async function backfillEmbeddings() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');

    const mediaRepository = AppDataSource.getRepository(MediaItem);
    
    // Get all items without embeddings
    const itemsWithoutEmbeddings = await mediaRepository.find({
      where: { embedding: null as unknown as string },
    });

    console.log(`Found ${itemsWithoutEmbeddings.length} items without embeddings`);

    for (const item of itemsWithoutEmbeddings) {
      try {
        console.log(`Processing: ${item.title}`);
        
        // Generate embedding with enhanced support for audio/video
        const textForEmbedding = await prepareTextForEmbedding(
          item.title,
          item.description || undefined,
          item.content || undefined,
          item // Pass item for enhanced audio/video processing
        );
        
        // Skip if no relevant field
        if (!textForEmbedding || textForEmbedding.trim() === '') {
          console.log(`⚠ Skipping ${item.title} - no ${item.type === 'text' ? 'content' : item.type === 'video' ? 'url' : 'file'}`);
          continue;
        }
        
        const embeddingArray = await generateEmbedding(textForEmbedding);
        const embeddingString = `[${embeddingArray.join(',')}]`;

        // Update the embedding
        await mediaRepository.query(
          `UPDATE media_items SET embedding = $1::vector(768) WHERE id = $2`,
          [embeddingString, item.id]
        );

        console.log(`✓ Added embedding for: ${item.title}`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing ${item.title}:`, error);
      }
    }

    console.log('Backfill complete!');
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error in backfill:', error);
    process.exit(1);
  }
}

backfillEmbeddings();

