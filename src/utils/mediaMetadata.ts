import { MediaItem, MediaType } from '../entities/MediaItem';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Audio/Video Metadata Extraction Utility
 * 
 * Extracts enhanced metadata from audio and video files to improve
 * search and matching capabilities.
 */

export interface MediaMetadata {
  format?: string;
  duration?: number;
  fileSize?: number;
  bitrate?: number;
  sampleRate?: number; // For audio
  channels?: number; // For audio
  resolution?: string; // For video
  frameRate?: number; // For video
  codec?: string;
  transcription?: string; // Extracted transcription
}

/**
 * Extract file metadata from file system or URL
 */
export async function extractFileMetadata(
  filePath: string | undefined,
  mimeType: string | undefined,
  type: MediaType,
  url?: string
): Promise<MediaMetadata> {
  const metadata: MediaMetadata = {};

  // Handle YouTube URLs
  if (url && isYouTubeUrl(url)) {
    return await extractYouTubeMetadata(url, type);
  }

  // Handle other URLs (Vimeo, etc.)
  if (url && !filePath) {
    return await extractUrlMetadata(url, type);
  }

  // Handle local file paths
  if (!filePath || !fs.existsSync(filePath)) {
    return metadata;
  }

  try {
    // Get file size
    const stats = fs.statSync(filePath);
    metadata.fileSize = stats.size;

    // Extract format from mimeType
    if (mimeType) {
      metadata.format = mimeType.split('/')[1]?.toUpperCase();
      metadata.codec = extractCodecFromMimeType(mimeType);
    }

    // Extract format from file extension
    if (!metadata.format) {
      const ext = path.extname(filePath).toLowerCase().slice(1);
      metadata.format = ext.toUpperCase();
    }

    // For audio/video files, we would typically use libraries like:
    // - ffprobe (ffmpeg) for detailed metadata
    // - node-ffmpeg for Node.js
    // - mediainfo for comprehensive metadata
    
    // Placeholder: In a real implementation, you would use ffprobe or similar
    // For now, we'll extract basic info from filename and mimeType
    
    if (type === MediaType.AUDIO) {
      // Audio-specific metadata extraction would go here
      // Example: Use ffprobe to get duration, bitrate, sample rate, channels
      metadata.sampleRate = extractSampleRateFromMimeType(mimeType);
    } else if (type === MediaType.VIDEO) {
      // Video-specific metadata extraction would go here
      // Example: Use ffprobe to get duration, resolution, frame rate, codec
    }

  } catch (error) {
    console.warn(`Error extracting metadata from ${filePath}:`, error);
  }

  return metadata;
}

/**
 * Extract codec information from MIME type
 */
function extractCodecFromMimeType(mimeType: string | undefined): string | undefined {
  if (!mimeType) return undefined;

  const codecMap: Record<string, string> = {
    'audio/mpeg': 'MP3',
    'audio/mp3': 'MP3',
    'audio/wav': 'WAV',
    'audio/ogg': 'OGG',
    'audio/aac': 'AAC',
    'audio/flac': 'FLAC',
    'video/mp4': 'MP4',
    'video/webm': 'WEBM',
    'video/ogg': 'OGG',
    'video/quicktime': 'MOV',
    'video/x-msvideo': 'AVI',
  };

  return codecMap[mimeType.toLowerCase()];
}

/**
 * Extract sample rate hint from MIME type (basic implementation)
 */
function extractSampleRateFromMimeType(mimeType: string | undefined): number | undefined {
  // Most audio formats use standard sample rates
  // In a real implementation, this would come from actual file analysis
  if (!mimeType) return undefined;
  
  // Default common sample rates
  if (mimeType.includes('wav')) return 44100;
  if (mimeType.includes('mp3')) return 44100;
  return 44100; // Default
}

/**
 * Generate enhanced text description for audio/video items
 * This includes metadata, format info, and other contextual information
 */
export function generateEnhancedTextForMedia(
  item: MediaItem,
  metadata?: MediaMetadata
): string {
  const parts: string[] = [];

  // Always include title
  if (item.title) {
    parts.push(item.title);
  }

  // Add description
  if (item.description) {
    parts.push(item.description);
  }

  // Add type-specific context
  if (item.type === MediaType.AUDIO) {
    parts.push('audio file');
    parts.push('audio recording');
    
    if (metadata) {
      if (metadata.format) {
        parts.push(`${metadata.format} audio`);
        parts.push(`${metadata.format} format`);
      }
      if (metadata.codec) {
        parts.push(`${metadata.codec} codec`);
      }
      if (metadata.sampleRate) {
        parts.push(`${metadata.sampleRate}Hz sample rate`);
      }
      if (metadata.duration) {
        const minutes = Math.floor(metadata.duration / 60);
        const seconds = Math.floor(metadata.duration % 60);
        parts.push(`${minutes} minutes ${seconds} seconds`);
        parts.push(`${metadata.duration} seconds duration`);
      }
      if (metadata.bitrate) {
        parts.push(`${metadata.bitrate} kbps`);
      }
      if (metadata.channels) {
        parts.push(`${metadata.channels} channel${metadata.channels > 1 ? 's' : ''}`);
        if (metadata.channels === 2) parts.push('stereo');
        if (metadata.channels === 1) parts.push('mono');
      }
    }

    // Add transcription if available
    if (metadata?.transcription) {
      parts.push(`transcription: ${metadata.transcription}`);
    }

  } else if (item.type === MediaType.VIDEO) {
    parts.push('video file');
    parts.push('video recording');
    
    if (metadata) {
      if (metadata.format) {
        parts.push(`${metadata.format} video`);
        parts.push(`${metadata.format} format`);
      }
      if (metadata.codec) {
        parts.push(`${metadata.codec} codec`);
      }
      if (metadata.resolution) {
        parts.push(`${metadata.resolution} resolution`);
      }
      if (metadata.frameRate) {
        parts.push(`${metadata.frameRate} fps`);
        parts.push(`${metadata.frameRate} frames per second`);
      }
      if (metadata.duration) {
        const minutes = Math.floor(metadata.duration / 60);
        const seconds = Math.floor(metadata.duration % 60);
        parts.push(`${minutes} minutes ${seconds} seconds`);
        parts.push(`${metadata.duration} seconds duration`);
      }
      if (metadata.bitrate) {
        parts.push(`${metadata.bitrate} kbps`);
      }
    }

    // Add URL context if it's a video link
    if (item.url) {
      parts.push('video link');
      parts.push('online video');
      if (isYouTubeUrl(item.url)) {
        parts.push('YouTube video');
        parts.push('YouTube');
        const videoId = extractYouTubeVideoId(item.url);
        if (videoId) {
          parts.push(`video ID ${videoId}`);
        }
      } else if (item.url.includes('vimeo.com')) {
        parts.push('Vimeo video');
        parts.push('Vimeo');
      } else if (item.url.includes('dailymotion.com')) {
        parts.push('Dailymotion video');
        parts.push('Dailymotion');
      }
    }

    // Add transcription if available
    if (metadata?.transcription) {
      parts.push(`transcription: ${metadata.transcription}`);
    }
  }

  // Add file size context
  if (metadata?.fileSize) {
    const sizeMB = (metadata.fileSize / (1024 * 1024)).toFixed(2);
    parts.push(`${sizeMB} MB`);
  }

  // Add content if available (might contain additional context)
  if (item.content) {
    parts.push(item.content);
  }

  return parts.join(' ');
}

/**
 * Extract keywords from media metadata for better matching
 */
export function extractMediaKeywords(
  item: MediaItem,
  metadata?: MediaMetadata
): string[] {
  const keywords: string[] = [];

  // Type keywords
  keywords.push(item.type);

  // Format keywords
  if (metadata?.format) {
    keywords.push(metadata.format.toLowerCase());
  }

  // Codec keywords
  if (metadata?.codec) {
    keywords.push(metadata.codec.toLowerCase());
  }

  // Duration keywords (rounded)
  if (metadata?.duration) {
    const minutes = Math.floor(metadata.duration / 60);
    if (minutes > 0) {
      keywords.push(`${minutes}min`);
      if (minutes <= 5) keywords.push('short');
      else if (minutes <= 30) keywords.push('medium');
      else keywords.push('long');
    }
  }

  // Audio-specific keywords
  if (item.type === MediaType.AUDIO) {
    keywords.push('audio', 'sound', 'recording');
    if (metadata?.channels === 2) keywords.push('stereo');
    if (metadata?.channels === 1) keywords.push('mono');
  }

  // Video-specific keywords
  if (item.type === MediaType.VIDEO) {
    keywords.push('video', 'movie', 'clip');
    if (item.url) keywords.push('online', 'streaming');
  }

  return keywords;
}

/**
 * Check if URL is a YouTube URL
 */
function isYouTubeUrl(url: string): boolean {
  const youtubePatterns = [
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/i,
    /youtube\.com\/watch\?v=/i,
    /youtu\.be\//i,
  ];
  return youtubePatterns.some(pattern => pattern.test(url));
}

/**
 * Extract metadata from YouTube URL
 * 
 * Note: For full metadata extraction, you would need:
 * - YouTube Data API v3 (requires API key)
 * - Or use libraries like: ytdl-core, youtube-dl, etc.
 */
async function extractYouTubeMetadata(
  url: string,
  type: MediaType
): Promise<MediaMetadata> {
  const metadata: MediaMetadata = {};

  // Extract video ID from URL
  const videoId = extractYouTubeVideoId(url);
  
  if (videoId) {
    metadata.format = 'YOUTUBE';
    metadata.codec = 'YOUTUBE';
    
    // Add YouTube-specific context
    // In production, you would fetch actual metadata using YouTube API:
    // 
    // Example with YouTube Data API v3:
    // const youtube = google.youtube('v3');
    // const response = await youtube.videos.list({
    //   part: 'snippet,contentDetails,statistics',
    //   id: videoId,
    //   key: process.env.YOUTUBE_API_KEY,
    // });
    // const video = response.data.items[0];
    // metadata.duration = parseDuration(video.contentDetails.duration);
    // metadata.resolution = video.snippet.thumbnails?.high?.width + 'x' + video.snippet.thumbnails?.high?.height;
    
    // For now, we'll add basic YouTube context
    metadata.format = 'YOUTUBE';
    metadata.codec = 'YOUTUBE';
  }

  return metadata;
}

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/i,
    /youtube\.com\/embed\/([^&\n?#]+)/i,
    /youtube\.com\/v\/([^&\n?#]+)/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Extract metadata from other video URLs (Vimeo, etc.)
 */
async function extractUrlMetadata(
  url: string,
  type: MediaType
): Promise<MediaMetadata> {
  const metadata: MediaMetadata = {};

  // Detect platform
  if (url.includes('vimeo.com')) {
    metadata.format = 'VIMEO';
    metadata.codec = 'VIMEO';
  } else if (url.includes('dailymotion.com')) {
    metadata.format = 'DAILYMOTION';
    metadata.codec = 'DAILYMOTION';
  } else {
    // Generic video URL
    metadata.format = 'ONLINE';
    metadata.codec = 'ONLINE';
  }

  // Extract format from URL if possible
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.mp4')) {
    metadata.format = 'MP4';
    metadata.codec = 'MP4';
  } else if (urlLower.includes('.webm')) {
    metadata.format = 'WEBM';
    metadata.codec = 'WEBM';
  }

  return metadata;
}

