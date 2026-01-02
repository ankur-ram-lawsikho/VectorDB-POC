# Setup Instructions

## Prerequisites

### Install Docker Desktop

**For Windows:**
1. Download Docker Desktop from: https://www.docker.com/products/docker-desktop/
2. Run the installer and follow the setup wizard
3. **Important:** You may be prompted to:
   - Enable WSL 2 (Windows Subsystem for Linux 2) - this is required
   - Restart your computer
4. After installation/restart, launch Docker Desktop from the Start menu
5. Wait for Docker Desktop to start (you'll see a Docker icon in the system tray)
6. Verify installation by opening PowerShell and running:
   ```powershell
   docker --version
   docker compose version
   ```

**Note:** Docker Desktop includes both `docker` and `docker compose` commands. In newer versions (v2.0+), use `docker compose` (without hyphen) instead of `docker-compose`.

### Docker Troubleshooting

**"Docker is not recognized"**
- Make sure Docker Desktop is installed and running
- Check if Docker Desktop is in your system tray (bottom right)
- Try restarting Docker Desktop
- Restart your PowerShell/terminal window

**"WSL 2 installation is incomplete"**
- Docker Desktop requires WSL 2 on Windows
- Follow the prompts in Docker Desktop to install WSL 2
- Or manually install: https://docs.microsoft.com/en-us/windows/wsl/install

**"Cannot connect to Docker daemon"**
- Make sure Docker Desktop is running (check system tray)
- Try restarting Docker Desktop
- Check if virtualization is enabled in your BIOS (required for Docker)

**Port Already in Use**
- If you get an error about port 5432 being in use, you might have PostgreSQL already running locally
- Stop the local PostgreSQL service, or
- Change the port in `docker-compose.yml` to a different port (e.g., 5433)

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
docker compose ps
```

### Docker Compose Commands

```bash
# Start the database
docker compose up -d

# Check if it's running
docker compose ps

# View logs
docker compose logs

# Stop the database
docker compose down

# Stop and remove all data
docker compose down -v
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
- Check that the PostgreSQL container is running: `docker compose ps`
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

### Docker Issues
- See the Docker Troubleshooting section above
- Make sure Docker Desktop is running before starting the application
- Check Docker logs: `docker compose logs`
