import express from 'express';
import cors from 'cors';
import { Client } from 'pg';
import { AppDataSource } from './config/database';
import mediaRoutes from './routes/mediaRoutes';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));

// Routes
app.use('/api/media', mediaRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize database and start server
async function startServer() {
  try {
    // First, create a raw connection to enable pgvector extension BEFORE TypeORM syncs
    const client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'media_library',
    });
    
    await client.connect();
    console.log('Raw database connection established');
    
    // Enable pgvector extension BEFORE TypeORM tries to create tables
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('pgvector extension enabled');
    
    await client.end();
    
    // Now initialize TypeORM (this will sync schema)
    await AppDataSource.initialize();
    console.log('Database connected successfully');

    // Convert the embedding column from text to vector type after table creation
    try {
      const columnInfo = await AppDataSource.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'media_items' AND column_name = 'embedding';
      `);

      if (columnInfo.length > 0) {
        // Check if it's already vector type
        const isVectorType = await AppDataSource.query(`
          SELECT EXISTS (
            SELECT 1 
            FROM pg_type t 
            JOIN pg_namespace n ON n.oid = t.typnamespace 
            WHERE t.typname = 'vector' 
            AND n.nspname = 'public'
          );
        `);

        // If column exists and is text type, convert to vector
        if (columnInfo[0].data_type === 'text') {
          await AppDataSource.query(`
            ALTER TABLE media_items 
            ALTER COLUMN embedding TYPE vector(768) 
            USING CASE 
              WHEN embedding IS NULL THEN NULL 
              ELSE embedding::vector 
            END;
          `);
          console.log('Vector column type converted from text to vector(768)');
        } else if (columnInfo[0].data_type === 'USER-DEFINED') {
          console.log('Vector column already exists with correct type');
        }
      }
    } catch (error) {
      console.log('Vector column setup:', error instanceof Error ? error.message : 'OK');
    }

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`API endpoints available at http://localhost:${PORT}/api/media`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

startServer();

