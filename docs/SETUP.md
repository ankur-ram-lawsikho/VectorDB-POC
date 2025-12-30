# Setup Instructions

## Step 0: Install Docker Desktop (if not already installed)

**For Windows:**
1. Download Docker Desktop from: https://www.docker.com/products/docker-desktop/
2. Run the installer and follow the setup wizard
3. Restart your computer if prompted
4. Launch Docker Desktop and wait for it to start (you'll see a Docker icon in the system tray)
5. Verify installation by opening PowerShell and running:
   ```powershell
   docker --version
   ```

**Note:** Docker Desktop includes both `docker` and `docker compose` commands. In newer versions, use `docker compose` (without hyphen) instead of `docker-compose`.

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Create Environment File

Create a `.env` file in the root directory with the following content:

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

**Important:** Replace `your_gemini_api_key_here` with your actual Google Gemini API key. You can get a free API key from https://aistudio.google.com/apikey

## Step 3: Start PostgreSQL with pgvector

**For newer Docker versions (recommended):**
```bash
docker compose up -d
```

**For older Docker versions:**
```bash
docker-compose up -d
```

**Note:** If you get an error, try `docker compose` (without hyphen) as newer Docker Desktop versions use this format.

Wait a few seconds for the database to be ready. You can check the status with:
```bash
docker-compose ps
```

## Step 4: Run the Application

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Step 5: Access the Web Interface

Open your browser and navigate to:
```
http://localhost:3000
```

## Troubleshooting

### Database Connection Issues
- Make sure Docker is running
- Check that the PostgreSQL container is running: `docker-compose ps`
- Verify the database credentials in your `.env` file match the docker-compose.yml

### Gemini API Issues
- Make sure you have a valid API key in your `.env` file
- Get your free API key from https://aistudio.google.com/apikey
- The embedding model used is `text-embedding-004`
- Free tier allows up to 1,500 requests per day and 1,000,000 tokens per minute

### File Upload Issues
- Make sure the `uploads/` directory exists (it will be created automatically)
- Check file size limits (default is 10MB)
- Supported formats:
  - Images: JPEG, PNG, GIF, WebP
  - Audio: MP3, WAV, OGG

