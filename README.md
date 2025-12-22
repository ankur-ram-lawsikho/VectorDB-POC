# VectorDB Media Library

A Node.js media library application that uses PostgreSQL with pgvector for semantic search. Store and search through text, audio files, video links, and images using vector embeddings.

## Features

- Store different types of media:
  - Text content (from notepad)
  - Audio files (MP3, WAV, OGG)
  - Video links (YouTube, Vimeo, etc.)
  - Image files (JPEG, PNG, GIF, WebP)
- Semantic search using vector embeddings
- RESTful API for all operations
- Docker-based PostgreSQL with pgvector

## Prerequisites

- Node.js (v18 or higher)
- Docker Desktop (download from https://www.docker.com/products/docker-desktop/)
- Google Gemini API key (free tier available - for generating embeddings)

**Installing Docker Desktop:**
1. Download from https://www.docker.com/products/docker-desktop/
2. Run the installer and follow the setup wizard
3. Restart your computer if prompted
4. Launch Docker Desktop and wait for it to start
5. Verify installation: Open PowerShell and run `docker --version`

## Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```
   DB_HOST=localhost
   DB_PORT=5433
   DB_USERNAME=postgres
   DB_PASSWORD=postgres
   DB_DATABASE=media_library
   PORT=3000
   GEMINI_API_KEY=your_gemini_api_key_here
   UPLOAD_DIR=./uploads
   MAX_FILE_SIZE=10485760
   ```

3. **Start PostgreSQL with pgvector:**
   
   **For newer Docker versions (recommended):**
   ```bash
   docker compose up -d
   ```
   
   **For older Docker versions:**
   ```bash
   docker-compose up -d
   ```
   
   Wait a few seconds for the database to start. Check status with:
   ```bash
   docker compose ps
   ```

4. **Run the application:**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`

## API Endpoints

### Get all media items
```
GET /api/media
```

### Get media item by ID
```
GET /api/media/:id
```

### Create text media
```
POST /api/media/text
Body: {
  "title": "My Note",
  "content": "This is the text content...",
  "description": "Optional description"
}
```

### Create video link
```
POST /api/media/video
Body: {
  "title": "Video Title",
  "url": "https://youtube.com/watch?v=...",
  "description": "Optional description"
}
```

### Upload audio file
```
POST /api/media/audio
Content-Type: multipart/form-data
Body: {
  "audio": <file>,
  "title": "Audio Title",
  "description": "Optional description"
}
```

### Upload image file
```
POST /api/media/image
Content-Type: multipart/form-data
Body: {
  "image": <file>,
  "title": "Image Title",
  "description": "Optional description"
}
```

### Search media
```
POST /api/media/search
Body: {
  "query": "search term",
  "limit": 10
}
```

### Delete media item
```
DELETE /api/media/:id
```

### Get file
```
GET /api/media/file/:id
```

## Frontend

Open `public/index.html` in your browser to use the simple web interface for managing your media library.

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server

## Notes

- Make sure Docker is running before starting the application
- The pgvector extension will be automatically enabled on first run
- Uploaded files are stored in the `uploads/` directory
- Vector embeddings are generated using Google Gemini's `text-embedding-004` model (free tier available)

