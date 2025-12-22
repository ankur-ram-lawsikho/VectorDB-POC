import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MediaType {
  TEXT = 'text',
  AUDIO = 'audio',
  VIDEO = 'video',
  IMAGE = 'image',
}

@Entity('media_items')
export class MediaItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'enum', enum: MediaType })
  type!: MediaType;

  @Column({ type: 'text', nullable: true })
  content?: string; // For text content or file paths/URLs

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  filePath?: string; // For uploaded files

  @Column({ type: 'varchar', length: 500, nullable: true })
  url?: string; // For video links or external resources

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType?: string;

  @Column({ type: 'text', nullable: true })
  embedding?: string; // Vector embedding stored as text, converted to vector(768) type in DB after sync

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

