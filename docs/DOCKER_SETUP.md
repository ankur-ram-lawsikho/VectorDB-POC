# Docker Setup Guide

## Installing Docker Desktop on Windows

### Step 1: Download Docker Desktop
1. Go to: https://www.docker.com/products/docker-desktop/
2. Click "Download for Windows"
3. The installer file will be downloaded (usually named `Docker Desktop Installer.exe`)

### Step 2: Install Docker Desktop
1. Run the installer file you just downloaded
2. Follow the installation wizard:
   - Accept the license agreement
   - Choose installation options (defaults are usually fine)
   - Click "Install"
3. **Important:** You may be prompted to:
   - Enable WSL 2 (Windows Subsystem for Linux 2) - this is required
   - Restart your computer

### Step 3: Start Docker Desktop
1. After installation/restart, launch Docker Desktop from the Start menu
2. Wait for Docker Desktop to start (you'll see a Docker icon in the system tray)
3. The Docker Desktop window will open - you can close it, Docker will continue running in the background

### Step 4: Verify Installation
Open PowerShell and run:
```powershell
docker --version
```

You should see something like: `Docker version 24.x.x, build xxxxx`

Also verify Docker Compose:
```powershell
docker compose version
```

## Using Docker Compose

**Important:** Newer versions of Docker Desktop (v2.0+) use `docker compose` (with a space) instead of `docker-compose` (with a hyphen).

### Check Your Docker Version
```powershell
docker --version
```

### If you have Docker Desktop v2.0 or newer:
Use:
```powershell
docker compose up -d
docker compose ps
docker compose down
```

### If you have an older version:
Use:
```powershell
docker-compose up -d
docker-compose ps
docker-compose down
```

## Troubleshooting

### "Docker is not recognized"
- Make sure Docker Desktop is installed and running
- Check if Docker Desktop is in your system tray (bottom right)
- Try restarting Docker Desktop
- Restart your PowerShell/terminal window

### "WSL 2 installation is incomplete"
- Docker Desktop requires WSL 2 on Windows
- Follow the prompts in Docker Desktop to install WSL 2
- Or manually install: https://docs.microsoft.com/en-us/windows/wsl/install

### "Cannot connect to Docker daemon"
- Make sure Docker Desktop is running (check system tray)
- Try restarting Docker Desktop
- Check if virtualization is enabled in your BIOS (required for Docker)

### Port Already in Use
If you get an error about port 5432 being in use:
- You might have PostgreSQL already running locally
- Stop the local PostgreSQL service, or
- Change the port in `docker-compose.yml` to a different port (e.g., 5433)

## Quick Start Commands

Once Docker is installed and running:

```powershell
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

