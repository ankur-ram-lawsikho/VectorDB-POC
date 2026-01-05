# Free Transcription Setup Guide

## Overview

This guide explains how to set up **completely free** transcription for audio/video files and URLs using:
1. **Local Whisper** (OpenAI's open-source model)
2. **YouTube audio extraction** (yt-dlp)
3. **Integration with your existing codebase**

---

## Part 1: Setting Up Local Whisper Transcription

### What is Whisper?

Whisper is OpenAI's open-source automatic speech recognition (ASR) system. It's:
- ✅ **100% Free** (runs locally, no API costs)
- ✅ **High Accuracy** (state-of-the-art results)
- ✅ **Multi-language** (supports 99+ languages)
- ✅ **No Rate Limits** (process as many files as you want)

### Installation Steps

#### Step 1: Install Python Dependencies

You'll need to add these packages to your `package.json`:

```json
{
  "dependencies": {
    // ... existing dependencies ...
    "openai-whisper": "^20231117",  // Official Whisper package
    "yt-dlp": "^2023.12.30",        // For YouTube audio extraction
    "@ffmpeg-installer/ffmpeg": "^1.1.0"  // Required for audio processing
  }
}
```

**OR** use the faster alternative (recommended for production):

```json
{
  "dependencies": {
    // ... existing dependencies ...
    "faster-whisper": "^0.10.0",    // Faster, optimized Whisper
    "yt-dlp": "^2023.12.30",
    "@ffmpeg-installer/ffmpeg": "^1.1.0"
  }
}
```

#### Step 2: Install System Dependencies

**For Windows:**
```powershell
# Install FFmpeg (required for audio processing)
# Option 1: Using Chocolatey
choco install ffmpeg

# Option 2: Download from https://ffmpeg.org/download.html
# Add to PATH environment variable
```

**For Linux/Mac:**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg
```

#### Step 3: Install Python (if not already installed)

Whisper requires Python 3.8+:

```bash
# Check Python version
python --version

# If not installed, download from python.org
# Or use package manager:
# Windows: choco install python
# macOS: brew install python
# Linux: sudo apt-get install python3
```

#### Step 4: Install Whisper Python Package

```bash
# Using pip (comes with Python)
pip install openai-whisper

# OR for faster performance (recommended):
pip install faster-whisper

# If you get permission errors, use:
pip install --user openai-whisper
```

#### Step 5: Verify Installation

```bash
# Test Whisper installation
whisper --version

# Or test in Python:
python -c "import whisper; print('Whisper installed successfully')"
```

### Whisper Model Options

Whisper has different model sizes (larger = more accurate, slower):

| Model | Size | Speed | Accuracy | Best For |
|-------|------|-------|----------|----------|
| `tiny` | 39 MB | Fastest | Good | Quick testing |
| `base` | 74 MB | Fast | Better | Development |
| `small` | 244 MB | Medium | Good | **Recommended** |
| `medium` | 769 MB | Slow | Very Good | Production |
| `large` | 1550 MB | Slowest | Best | High accuracy needs |

**Recommendation:** Start with `small` or `medium` for good balance.

---

## Part 2: YouTube Audio Extraction Setup

### What is yt-dlp?

`yt-dlp` is a command-line program to download videos/audio from YouTube and other sites. It's:
- ✅ **Free and Open Source**
- ✅ **Works with YouTube URLs**
- ✅ **Extracts audio only** (no need to download full video)
- ✅ **Supports many platforms** (YouTube, Vimeo, etc.)

### Installation Steps

#### Step 1: Install yt-dlp

**Option A: Using npm (recommended for Node.js projects):**
```bash
npm install yt-dlp
```

**Option B: Using pip (Python package):**
```bash
pip install yt-dlp
```

**Option C: Standalone binary:**
- Download from: https://github.com/yt-dlp/yt-dlp/releases
- Add to PATH

#### Step 2: Verify Installation

```bash
# Test yt-dlp
yt-dlp --version

# Or test YouTube URL extraction
yt-dlp --list-formats "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

### Using yt-dlp in Node.js

Since `yt-dlp` is a Python tool, you'll need to call it from Node.js:

**Option 1: Use `yt-dlp-wrap` (Node.js wrapper):**
```bash
npm install yt-dlp-wrap
```

**Option 2: Use `child_process` to execute yt-dlp command:**
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
```

---

## Part 3: Integration with Your Existing Code

### Current Code Structure

Your current transcription setup is in:
- `src/utils/transcription.ts` - Contains placeholder transcription functions
- `src/utils/embeddings.ts` - Uses transcription in embedding generation
- `src/services/mediaService.ts` - Creates media items and generates embeddings

### Integration Plan

Here's how to integrate Whisper + YouTube extraction:

#### Step 1: Create YouTube Audio Downloader

**New file: `src/utils/youtubeDownloader.ts`**

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Download audio from YouTube URL
 * @param url - YouTube video URL
 * @param outputPath - Optional output path (defaults to temp directory)
 * @returns Path to downloaded audio file
 */
export async function downloadYouTubeAudio(
  url: string,
  outputPath?: string
): Promise<string> {
  // Create temp directory if not provided
  const tempDir = outputPath || path.join(os.tmpdir(), 'youtube-audio');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Generate unique filename
  const videoId = extractYouTubeVideoId(url) || Date.now().toString();
  const audioPath = path.join(tempDir, `${videoId}.mp3`);

  try {
    // Use yt-dlp to extract audio
    // -x: extract audio only
    // --audio-format mp3: convert to MP3
    // -o: output path
    const command = `yt-dlp -x --audio-format mp3 -o "${audioPath}" "${url}"`;
    
    await execAsync(command);
    
    // Check if file was created
    if (fs.existsSync(audioPath)) {
      return audioPath;
    } else {
      throw new Error('Audio file was not created');
    }
  } catch (error) {
    console.error('Error downloading YouTube audio:', error);
    throw error;
  }
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
 * Clean up temporary audio file
 */
export function cleanupAudioFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn('Error cleaning up audio file:', error);
  }
}
```

#### Step 2: Update Transcription Utility

**Update: `src/utils/transcription.ts`**

Add Whisper integration:

```typescript
import { MediaItem, MediaType } from '../entities/MediaItem';
import * as fs from 'fs';
import * as path from 'path';
import { downloadYouTubeAudio, cleanupAudioFile } from './youtubeDownloader';

// For faster-whisper (recommended):
import { WhisperModel } from 'faster-whisper';

// OR for openai-whisper:
// import whisper from 'openai-whisper';

// ... existing interfaces ...

/**
 * Initialize Whisper model (cache it to avoid reloading)
 */
let whisperModel: WhisperModel | null = null;

async function getWhisperModel(): Promise<WhisperModel> {
  if (!whisperModel) {
    // Using faster-whisper (recommended)
    const { WhisperModel } = await import('faster-whisper');
    whisperModel = new WhisperModel('small', { device: 'cpu' }); // or 'cuda' for GPU
  }
  return whisperModel;
}

/**
 * Transcribe audio/video file using local Whisper
 */
export async function transcribeMedia(
  item: MediaItem,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult | null> {
  // Only transcribe audio and video
  if (item.type !== MediaType.AUDIO && item.type !== MediaType.VIDEO) {
    return null;
  }

  const filePath = item.filePath;
  const url = item.url;
  
  if (!filePath && !url) {
    console.warn(`No file path or URL for item ${item.id}`);
    return null;
  }

  let audioFilePath: string | null = null;
  let isTemporaryFile = false;

  try {
    // Handle YouTube URLs
    if (url && isYouTubeUrl(url) && !filePath) {
      console.log(`[Transcription] Downloading audio from YouTube: ${url}`);
      audioFilePath = await downloadYouTubeAudio(url);
      isTemporaryFile = true;
    }
    // Handle other URLs (download first)
    else if (url && !filePath) {
      // For non-YouTube URLs, you might need to download first
      // Or use a different approach
      console.warn(`[Transcription] Non-YouTube URL transcription not yet implemented: ${url}`);
      return null;
    }
    // Handle local files
    else if (filePath) {
      if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return null;
      }
      audioFilePath = filePath;
    }

    if (!audioFilePath) {
      return null;
    }

    // Transcribe using Whisper
    console.log(`[Transcription] Transcribing: ${audioFilePath}`);
    const model = await getWhisperModel();
    
    // Using faster-whisper
    const { segments } = await model.transcribe(audioFilePath, {
      language: options.language || 'en',
      task: 'transcribe',
    });

    // Combine segments into full text
    const text = segments.map(s => s.text).join(' ');
    
    // Calculate confidence (average of segment confidences)
    const confidence = segments.length > 0
      ? segments.reduce((sum, s) => sum + (s.noSpeechProb || 0), 0) / segments.length
      : undefined;

    // Clean up temporary file if we downloaded it
    if (isTemporaryFile && audioFilePath) {
      cleanupAudioFile(audioFilePath);
    }

    return {
      text: text.trim(),
      confidence: confidence ? 1 - confidence : undefined, // Convert no-speech-prob to confidence
      language: options.language || 'en',
      segments: segments.map(s => ({
        start: s.start,
        end: s.end,
        text: s.text,
        confidence: s.noSpeechProb ? 1 - s.noSpeechProb : undefined,
      })),
    };

  } catch (error) {
    console.error(`Error transcribing media item ${item.id}:`, error);
    
    // Clean up temporary file on error
    if (isTemporaryFile && audioFilePath) {
      cleanupAudioFile(audioFilePath);
    }
    
    return null;
  }
}

/**
 * Check if URL is YouTube
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
 * Update availability check
 */
export function isTranscriptionAvailable(): boolean {
  // Check if Whisper is available (always true if installed)
  try {
    // Try to import faster-whisper
    require.resolve('faster-whisper');
    return true;
  } catch {
    try {
      // Try to import openai-whisper
      require.resolve('openai-whisper');
      return true;
    } catch {
      return false;
    }
  }
}

// ... rest of existing code ...
```

#### Step 3: Update Environment Variables

**Update: `.env` (optional, for configuration)**

```env
# Transcription Settings
WHISPER_MODEL=small                    # tiny, base, small, medium, large
WHISPER_DEVICE=cpu                     # cpu or cuda (for GPU)
WHISPER_LANGUAGE=en                     # Auto-detect if not specified
YOUTUBE_AUDIO_TEMP_DIR=./temp/audio    # Temporary directory for downloaded audio
```

#### Step 4: Update Package.json Scripts

**Update: `package.json`**

```json
{
  "scripts": {
    // ... existing scripts ...
    "install-whisper": "pip install faster-whisper",
    "install-ytdlp": "pip install yt-dlp"
  }
}
```

### How It Works Together

Here's the flow when you create a video item with a YouTube URL:

1. **Media Item Creation** (`mediaService.createMediaItem`)
   - User provides YouTube URL
   - Item is saved to database

2. **Embedding Generation** (`embeddings.prepareTextForEmbedding`)
   - Checks if transcription is enabled
   - Calls `getOrGenerateTranscription()`

3. **Transcription Process** (`transcription.getOrGenerateTranscription`)
   - Detects YouTube URL
   - Downloads audio using `yt-dlp` → `downloadYouTubeAudio()`
   - Transcribes audio using Whisper → `transcribeMedia()`
   - Returns transcription text

4. **Text Preparation** (`embeddings.prepareTextForEmbedding`)
   - Combines: title + description + metadata + transcription
   - Creates enhanced text for embedding

5. **Embedding Generation** (`embeddings.generateEmbedding`)
   - Uses Gemini text-embedding-004 (your existing model)
   - Generates 768-dimensional vector
   - Saves to database

6. **Cleanup**
   - Temporary audio file is deleted
   - Transcription is cached (optional)

---

## Installation Checklist

### Prerequisites
- [ ] Python 3.8+ installed
- [ ] FFmpeg installed and in PATH
- [ ] Node.js and npm working

### Step 1: Install Python Packages
```bash
# Install Whisper
pip install faster-whisper
# OR
pip install openai-whisper

# Install yt-dlp
pip install yt-dlp
```

### Step 2: Install Node.js Packages
```bash
npm install yt-dlp-wrap @ffmpeg-installer/ffmpeg
# OR if using child_process (no extra package needed)
npm install @ffmpeg-installer/ffmpeg
```

### Step 3: Verify Installation
```bash
# Test Whisper
python -c "from faster_whisper import WhisperModel; print('OK')"

# Test yt-dlp
yt-dlp --version
```

### Step 4: Test YouTube Download
```bash
# Test downloading audio from YouTube
yt-dlp -x --audio-format mp3 "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

---

## Usage Examples

### Example 1: Transcribe YouTube Video

```typescript
import { MediaService } from './services/mediaService';
import { MediaType } from './entities/MediaItem';

const mediaService = new MediaService();

// Create video item with YouTube URL
const videoItem = await mediaService.createMediaItem(
  "React Tutorial",
  MediaType.VIDEO,
  undefined, // content
  "Learn React from scratch",
  undefined, // filePath
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // YouTube URL
  "video/youtube"
);

// Transcription happens automatically during embedding generation!
// The transcription is included in the embedding text
```

### Example 2: Transcribe Local Audio File

```typescript
const audioItem = await mediaService.createMediaItem(
  "Podcast Episode",
  MediaType.AUDIO,
  undefined,
  "Discussion about AI",
  "./uploads/podcast.mp3", // Local file path
  undefined, // no URL
  "audio/mpeg"
);

// Transcription happens automatically!
```

### Example 3: Manual Transcription

```typescript
import { transcribeMedia } from './utils/transcription';
import { getMediaById } from './services/mediaService';

const item = await getMediaById('some-id');
const transcription = await transcribeMedia(item, {
  language: 'en',
  enablePunctuation: true
});

console.log(transcription.text);
```

---

## Performance Considerations

### Speed Optimization

1. **Use `faster-whisper` instead of `openai-whisper`**
   - 4x faster with same accuracy
   - Lower memory usage

2. **Use GPU if available**
   ```typescript
   const model = new WhisperModel('small', { device: 'cuda' });
   ```

3. **Cache transcriptions**
   - Store transcriptions in database
   - Avoid re-transcribing same files

4. **Use smaller models for faster processing**
   - `tiny` or `base` for quick results
   - `small` or `medium` for better accuracy

### Memory Usage

| Model | RAM Usage | Best For |
|-------|-----------|----------|
| `tiny` | ~1 GB | Low-memory systems |
| `base` | ~1 GB | Development |
| `small` | ~2 GB | **Recommended** |
| `medium` | ~5 GB | Production |
| `large` | ~10 GB | High accuracy |

### Processing Time Estimates

For a 10-minute audio file:
- `tiny`: ~30 seconds
- `base`: ~1 minute
- `small`: ~2 minutes
- `medium`: ~5 minutes
- `large`: ~10 minutes

*Times vary based on CPU/GPU speed*

---

## Troubleshooting

### Issue: "Whisper not found"
**Solution:**
```bash
pip install faster-whisper
# Verify:
python -c "from faster_whisper import WhisperModel; print('OK')"
```

### Issue: "FFmpeg not found"
**Solution:**
- Install FFmpeg and add to PATH
- Or use: `npm install @ffmpeg-installer/ffmpeg`

### Issue: "yt-dlp not found"
**Solution:**
```bash
pip install yt-dlp
# Verify:
yt-dlp --version
```

### Issue: "Out of memory"
**Solution:**
- Use smaller Whisper model (`tiny` or `base`)
- Process files in smaller chunks
- Increase system RAM

### Issue: "YouTube download fails"
**Solution:**
- Update yt-dlp: `pip install -U yt-dlp`
- Check internet connection
- Verify YouTube URL is valid

### Issue: "Transcription is slow"
**Solution:**
- Use `faster-whisper` instead of `openai-whisper`
- Use GPU if available (`device: 'cuda'`)
- Use smaller model (`tiny` or `base`)
- Process in background/async

---

## Cost Comparison

### Current Approach (API-based)
- Google Gemini API: $0.01/minute for audio
- 100 videos (10 min each) = $10
- Rate limits apply

### New Approach (Local Whisper)
- **$0.00** (completely free!)
- No rate limits
- Process unlimited files
- One-time setup cost (time to install)

---

## Next Steps

1. **Install dependencies** (Python + Node.js packages)
2. **Create YouTube downloader utility** (`youtubeDownloader.ts`)
3. **Update transcription utility** (`transcription.ts`)
4. **Test with a sample YouTube URL**
5. **Enable transcription in settings** (`MediaMatchingSettings.ENABLE_TRANSCRIPTION = true`)
6. **Run backfill script** to transcribe existing items

---

## Summary

✅ **Completely Free** - No API costs, no rate limits  
✅ **High Accuracy** - State-of-the-art Whisper model  
✅ **YouTube Support** - Direct URL transcription  
✅ **Easy Integration** - Works with your existing code  
✅ **Production Ready** - Used by thousands of applications  

This setup gives you professional-grade transcription at zero cost!

