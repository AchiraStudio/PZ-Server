#!/usr/bin/env bash
set -e

# ==============================================================================
# Project Zomboid Dedicated Server + Web UI - Linux Setup & Deploy Script
# ==============================================================================

echo "=========================================================="
echo "  ☣️  Project Zomboid Server & Web UI Setup                "
echo "=========================================================="

# 1. Check Docker & Docker Compose
if ! command -v docker &> /dev/null; then
    echo "❌ Error: 'docker' is not installed."
    echo "Install Docker using: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: Docker Compose is not installed."
    echo "Install Docker Compose using your package manager or Docker Desktop plugin."
    exit 1
fi

echo "✅ Docker & Compose detected."

# 2. Make scripts executable
chmod +x scripts/*.sh 2>/dev/null || true

# 3. Setup .env file
if [ ! -f .env ]; then
    echo "📄 Creating .env from .env.example..."
    cp .env.example .env

    # Detect Host UID and GID to avoid permission conflicts on volume
    MY_UID=$(id -u)
    MY_GID=$(id -g)
    sed -i "s/PUID=1000/PUID=${MY_UID}/" .env
    sed -i "s/PGID=1000/PGID=${MY_GID}/" .env

    # Generate a random admin password
    GEN_PASS=$(tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 16)
    sed -i "s/ADMIN_PASSWORD=ChangeThisSecretPassword123!/ADMIN_PASSWORD=${GEN_PASS}/" .env
    sed -i "s/WEBUI_PASSWORD=ChangeThisSecretPassword123!/WEBUI_PASSWORD=${GEN_PASS}/" .env

    echo "🔐 Generated initial password: ${GEN_PASS}"
    echo "   (You can change this anytime in .env)"
fi

# Ensure data and cache directories exist with correct owner
mkdir -p data cache
chown -R "$(id -u):$(id -g)" data cache 2>/dev/null || true

# 4. Build and start containers
echo "🚀 Building and launching containers..."
docker compose up -d --build

# 5. Get IP address
SERVER_IP=$(curl -s -4 https://ifconfig.me || hostname -I | awk '{print $1}')
WEB_PORT=$(grep -E "^WEBUI_PORT=" .env | cut -d '=' -f2 | tr -d ' ' || echo "5011")
WEB_PORT=${WEB_PORT:-5011}

echo ""
echo "=========================================================="
echo "  🎉 Server Successfully Started!                         "
echo "=========================================================="
echo "  🌐 Web Management Dashboard: http://${SERVER_IP}:${WEB_PORT}"
echo "  🎮 Game Connection Port:     16261 (UDP)"
echo "  🔑 Check / Edit Password in: .env"
echo "  📋 View Live Logs:           docker compose logs -f"
echo "=========================================================="
