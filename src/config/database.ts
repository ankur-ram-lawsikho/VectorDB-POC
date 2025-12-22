import { DataSource } from 'typeorm';
import { MediaItem } from '../entities/MediaItem';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'media_library',
  entities: [MediaItem],
  synchronize: true, // Set to false in production and use migrations
  logging: false,
});

