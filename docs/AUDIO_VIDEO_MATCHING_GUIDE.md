# Audio and Video Matching Enhancement Guide

## Overview

The audio and video matching system has been significantly enhanced to provide better search and discovery capabilities for audio and video media items. The enhancements include metadata extraction, transcription support, type-aware boosting, and improved text preparation for embeddings.

**Important**: This system is optimized for **video link uploads** (YouTube, Vimeo, etc.) rather than local file uploads. All features work seamlessly with URL-based videos.

## Key Enhancements

### 1. Enhanced Metadata Extraction

The system now extracts comprehensive metadata from audio and video files/URLs to improve search relevance:

- **Format Information**: MP3, WAV, MP4, WEBM, YOUTUBE, VIMEO, etc.
- **Codec Information**: Audio/video codec details
- **Duration**: File duration in seconds (with YouTube API integration)
- **File Size**: File size in bytes/MB (for local files)
- **Audio-Specific**: Sample rate, bitrate, channels (mono/stereo)
- **Video-Specific**: Resolution, frame rate, bitrate
- **Platform Detection**: Automatic YouTube, Vimeo, and other platform detection

**Location**: `src/utils/mediaMetadata.ts`

### 2. Transcription Support

A transcription utility has been added to extract spoken content from audio and video files:

- **Placeholder Implementation**: Ready for integration with transcription services
- **Supported Services**: Google Cloud Speech-to-Text, OpenAI Whisper, AssemblyAI, AWS Transcribe, Azure Speech
- **URL Support**: AssemblyAI supports direct URL transcription for video links
- **Automatic Integration**: Transcription text is automatically included in embeddings when available

**Location**: `src/utils/transcription.ts`

**To Enable Transcription**:
1. Configure a transcription service API key in your `.env` file:
   ```
   GOOGLE_CLOUD_SPEECH_API_KEY=your_key
   # OR
   OPENAI_API_KEY=your_key
   # OR
   ASSEMBLYAI_API_KEY=your_key  # Supports URLs directly!
   ```
2. Set `MediaMatchingSettings.ENABLE_TRANSCRIPTION = true` in `src/config/vectordb.settings.ts`

### 3. Enhanced Text Preparation

The embedding generation now includes:

- **Metadata Context**: Format, codec, duration, and technical details
- **Type-Specific Keywords**: Audio/video-specific terms for better matching
- **Transcription Content**: Spoken words from audio/video files
- **Contextual Information**: File size, format hints, platform info (YouTube, Vimeo, etc.)
- **Platform Keywords**: YouTube, Vimeo, online video, video link, etc.

**Example Enhanced Text for YouTube Video**:
```
React Tutorial Learn React from scratch video file video recording YOUTUBE video YOUTUBE format YOUTUBE codec video link online video YouTube video YouTube video ID dQw4w9WgXcQ
```

### 4. Type-Aware Boosting

Search results now receive intelligent boosting based on:

- **Type Matching**: Audio queries boost audio results, video queries boost video results (15% boost)
- **Format Matching**: Queries mentioning specific formats (MP3, MP4, YouTube, etc.) boost matching items (10% boost)
- **Transcription Matching**: Queries matching transcription content receive significant boost (20% boost)
- **Keyword Matching**: Media-specific keywords (audio, video, recording, YouTube, etc.) boost relevant items (5% boost)

**Location**: `MediaService.applyTypeAwareBoosting()`

### 5. Configuration Settings

New settings in `src/config/vectordb.settings.ts`:

```typescript
export const MediaMatchingSettings = {
  TYPE_MATCH_BOOST: 1.15,              // 15% boost for type matches
  METADATA_MATCH_BOOST: 1.1,           // 10% boost for metadata matches
  TRANSCRIPTION_MATCH_BOOST: 1.2,      // 20% boost for transcription matches
  ENABLE_METADATA_EXTRACTION: true,    // Enable metadata extraction
  ENABLE_TRANSCRIPTION: false,         // Enable transcription (set to true when configured)
  INCLUDE_METADATA_IN_EMBEDDINGS: true,
  INCLUDE_TRANSCRIPTION_IN_EMBEDDINGS: true,
  MIN_TRANSCRIPTION_CONFIDENCE: 0.7,
  KEYWORDS_BOOST: 1.05,                // 5% boost for keyword matches
}
```

## Video Link Support (YouTube, Vimeo, etc.)

### YouTube Video Links

The system fully supports YouTube video links with automatic detection and enhanced metadata:

**Supported URL Formats**:
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://youtube.com/embed/VIDEO_ID`
- `https://youtube.com/v/VIDEO_ID`

**Automatic Features**:
- ✅ YouTube URL detection
- ✅ Video ID extraction
- ✅ Platform keywords (YouTube, online video, etc.)
- ✅ Type-aware boosting
- ✅ Enhanced search with YouTube context

**Example Usage**:
```typescript
POST /api/media/video
{
  "title": "React Tutorial - Complete Guide",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "description": "Learn React from scratch"
}
```

### Other Platforms

**Vimeo**: Automatic platform detection and metadata extraction  
**Dailymotion**: Generic online video support  
**Other URLs**: Format detection from URL, platform-agnostic metadata

### Benefits of URL-Only Approach

- ✅ **No File Storage Required**: No need for file upload handling
- ✅ **Faster Processing**: No file download/upload time
- ✅ **Better Scalability**: No storage limits, works with any video length
- ✅ **Platform Integration**: Direct YouTube/Vimeo integration, can fetch metadata via APIs

## How It Works

### Embedding Generation Flow

1. **Media Item Creation**: When an audio/video item is created:
   - For URLs: Platform is detected (YouTube, Vimeo, etc.)
   - Metadata is extracted from URL or file (if enabled)
   - Transcription is generated (if enabled and service configured)
   - Enhanced text is prepared including all metadata and transcription
   - Embedding is generated from the enhanced text

2. **Search Process**:
   - Query embedding is generated
   - Vector similarity search finds matching items
   - Type-aware boosting is applied to similarity scores
   - Results are sorted by boosted similarity

### Example: YouTube Video Processing

**Input**:
- Title: "React Tutorial"
- Type: Video
- URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- Description: "Learn React from scratch"

**Enhanced Text Generated**:
```
React Tutorial Learn React from scratch video file video recording YOUTUBE video YOUTUBE format YOUTUBE codec video link online video YouTube video YouTube video ID dQw4w9WgXcQ
```

**If Transcription Available**:
```
React Tutorial ... transcription: Welcome to this React tutorial. Today we'll learn about components and state management...
```

## Usage Examples

### Basic Search (Automatic Enhancement)

```typescript
// Search automatically uses enhanced matching
const results = await mediaService.searchMedia("React tutorial YouTube", 10);

// Results are automatically boosted if:
// - Query mentions "YouTube" and result is YouTube video
// - Query mentions "video" and result is video type
// - Query matches format/codec
// - Query matches transcription content
```

### Creating Video Links

```typescript
// YouTube video with enhanced metadata
const videoItem = await mediaService.createMediaItem(
  "React Tutorial",
  MediaType.VIDEO,
  undefined,
  "Learn React fundamentals",
  undefined,  // No filePath
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ"  // URL
);

// Enhanced embedding is automatically generated with YouTube context
```

### Semantic Search with Type-Aware Boosting

```typescript
// Semantic search also benefits from type-aware boosting
const results = await mediaService.semanticSearch(
  "JavaScript tutorial YouTube video",
  10,
  { contextBoost: true }
);

// YouTube videos matching "YouTube" or "video" receive boost
```

## Advanced Configuration

### Enable Transcription for URLs

For transcription of video links (without downloading):

1. **Use AssemblyAI** (supports URLs):
   ```bash
   npm install assemblyai
   ```

2. **Add to `.env`**:
   ```
   ASSEMBLYAI_API_KEY=your_api_key
   ```

3. **Update `transcribeMedia()`** in `src/utils/transcription.ts`:
   ```typescript
   import { AssemblyAI } from 'assemblyai';
   
   if (url && !filePath) {
     const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });
     const transcript = await client.transcripts.transcribe({
       audio_url: url,  // Direct URL support!
     });
     return {
       text: transcript.text,
       confidence: transcript.confidence,
     };
   }
   ```

### Full YouTube Metadata (Optional)

To get detailed metadata (duration, resolution, etc.) from YouTube videos:

1. **Get YouTube API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable YouTube Data API v3
   - Create API key

2. **Install YouTube API Client**:
   ```bash
   npm install googleapis
   ```

3. **Update `extractYouTubeMetadata()`** in `src/utils/mediaMetadata.ts`:
   ```typescript
   import { google } from 'googleapis';
   
   async function extractYouTubeMetadata(
     url: string,
     type: MediaType
   ): Promise<MediaMetadata> {
     const metadata: MediaMetadata = {};
     const videoId = extractYouTubeVideoId(url);
     
     if (videoId && process.env.YOUTUBE_API_KEY) {
       const youtube = google.youtube('v3');
       const response = await youtube.videos.list({
         part: 'snippet,contentDetails,statistics',
         id: videoId,
         key: process.env.YOUTUBE_API_KEY,
       });
       
       if (response.data.items?.[0]) {
         const video = response.data.items[0];
         
         // Parse duration (ISO 8601: PT5M30S)
         const duration = video.contentDetails?.duration;
         if (duration) {
           metadata.duration = parseISO8601Duration(duration);
         }
         
         // Get resolution from thumbnails
         const thumbnails = video.snippet?.thumbnails;
         if (thumbnails?.high) {
           metadata.resolution = `${thumbnails.high.width}x${thumbnails.high.height}`;
         }
       }
     }
     
     return metadata;
   }
   ```

4. **Add to `.env`**:
   ```
   YOUTUBE_API_KEY=your_api_key_here
   ```

## Benefits

### Improved Search Accuracy

- **Better Context**: Metadata provides additional searchable context
- **Type Awareness**: Audio/video queries find relevant media types
- **Platform Recognition**: YouTube/Vimeo queries find platform-specific videos
- **Transcription Search**: Find audio/video by spoken content

### Enhanced Relevance

- **Intelligent Boosting**: Relevant items rank higher
- **Format Matching**: Find items by format/codec/platform
- **Keyword Recognition**: Media-specific terms improve matching

### Better User Experience

- **More Relevant Results**: Type-aware boosting surfaces better matches
- **Comprehensive Search**: Find items by content, not just title
- **Platform Discovery**: Find items by platform (YouTube, Vimeo, etc.)

## Performance Considerations

### Metadata Extraction

- **URL Processing**: Metadata extraction for URLs is fast (no file I/O)
- **API Calls**: YouTube API calls may have rate limits
- **Caching**: Metadata can be cached to avoid repeated extraction

### Transcription

- **API Costs**: Transcription services may have usage costs
- **Processing Time**: Transcription can take time for long audio/video files
- **URL Support**: AssemblyAI supports direct URL transcription (no download needed)
- **Caching**: Store transcriptions in database to avoid re-processing

### Embedding Generation

- **Enhanced Text Length**: Enhanced text may be longer, but embeddings handle this well
- **Rate Limiting**: Follow API rate limits when generating embeddings
- **Batch Processing**: Use backfill script for existing items

## Troubleshooting

### No Metadata Extracted

**Issue**: Metadata extraction returns empty results

**Solutions**:
- For URLs: Check URL format is correct (YouTube, Vimeo, etc.)
- For files: Check file path is correct and file exists
- Verify MIME type is set correctly
- Consider integrating YouTube API for detailed metadata

### Transcription Not Working

**Issue**: Transcription returns null

**Solutions**:
- Verify transcription service API key is set
- Check `ENABLE_TRANSCRIPTION` is set to `true`
- For URLs: Use AssemblyAI (supports URLs directly)
- For files: Ensure file format is supported by transcription service
- Check file size limits for transcription service

### Low Search Relevance

**Issue**: Audio/video items not ranking well in search

**Solutions**:
- Ensure metadata extraction is enabled
- Add detailed descriptions to media items
- Enable transcription if audio/video contains speech
- Check that embeddings were regenerated after enabling features
- Use semantic search instead of keyword search

### YouTube Video Not Found in Search

**Possible causes**:
1. Embedding not generated - Check if embedding exists in database
2. Title/description too generic - Add more specific descriptions
3. Query doesn't match - Try broader search terms

**Solutions**:
- Run backfill script to regenerate embeddings: `npm run backfill-embeddings`
- Add more descriptive titles and descriptions
- Try semantic search instead of keyword search
- Search for "YouTube video" or "online video" to find all YouTube links

## Future Enhancements

Potential improvements:

1. **Video Frame Analysis**: Extract key frames and generate descriptions
2. **Audio Analysis**: Extract music/speech classification, tempo, mood
3. **Automatic Tagging**: Generate tags from metadata and transcription
4. **Multi-Language Support**: Support transcription in multiple languages
5. **Real-Time Processing**: Process metadata/transcription during upload
6. **Advanced Metadata**: Extract artist, album, genre for audio files
7. **Platform-Specific Features**: Leverage platform APIs for richer metadata

## Summary

The enhanced audio and video matching system provides:

✅ **Comprehensive Metadata Extraction** (works with URLs and files)  
✅ **YouTube/Vimeo Platform Support**  
✅ **Transcription Support** (ready for integration, URL-capable)  
✅ **Type-Aware Search Boosting**  
✅ **Enhanced Embedding Generation**  
✅ **Improved Search Relevance**  
✅ **Better User Experience**  

All enhancements are backward compatible and work automatically for new and existing items (after backfill). The system is optimized for video link uploads, making it perfect for URL-based video management!
