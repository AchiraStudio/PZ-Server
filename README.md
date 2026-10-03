# ☣️ Project Zomboid Dedicated Server with Built-in Web UI

A modern, containerized **Project Zomboid Dedicated Server** built on top of [zicstardust/project-zomboid-dedicated-server](https://hub.docker.com/r/zicstardust/project-zomboid-dedicated-server) featuring an all-in-one **Web Management Dashboard & Process Supervisor**.

Manage your multiplayer Knox County apocalypse directly from your web browser — track live server logs, send console commands in real time, customize sandbox variables with visual sliders, configure workshop mods, inspect player accounts in SQLite, generate instant world backups, and browse/edit server files in-browser.

---

## ✨ Features

- 🖥️ **Live Web Dashboard**: Real-time server state indicator (`ONLINE`, `STOPPED`, `STARTING`), uptime counter, live RAM and CPU utilization gauges, connected player counts, and quick-action controls.
- ⚡ **Interactive Server Terminal & Log Stream**:
  - Live console streaming via WebSockets.
  - Interactive stdin command bar — issue commands like `help`, `save`, `players`, `broadcast <msg>`, `startrain`, `teleport`, and `additem`.
  - Quick command chips and command history navigation (Up/Down arrow keys).
  - Real-time log keyword filtering, auto-scroll toggle, and one-click log copy.
- 🛠️ **Visual Sandbox Editor (`SandboxVars.lua`)**:
  - Interactive form for hundreds of sandbox variables categorized into Zombie Lore, Population, Multipliers, Time & World, Loot Rarity, and Character.
  - One-click presets: *Apocalypse (Hardcore)*, *Survivor (Standard)*, *Builder (Casual)*, and *28 Days Later (Sprinters 🏃)*.
  - Live search filter and bidirectional raw Lua editor toggle.
- 🧩 **Mods & Steam Workshop Manager**:
  - Add mods by Workshop ID or Steam Workshop URL.
  - Interactive load order adjustment (Move Up / Down, Enable / Disable, Delete).
  - One-click **"Sync & Download Workshop Mods"** via SteamCMD.
  - Built-in detection of local mod folders in `/data/Zomboid/mods`.
- ⚙️ **Server Configuration GUI (`server.ini`)**:
  - Visual controls for public server name, description, welcome message, player limits, PvP, sleep allowed, pause when empty, global chat, and anti-cheat.
  - Dual-mode switch between friendly UI and raw INI editor.
- 👥 **Players & Whitelist Manager**:
  - Live list of active connected players with instant Kick and Ban actions.
  - Direct integration with Project Zomboid's SQLite database (`/data/Zomboid/db/<SERVER_NAME>.db`).
  - Whitelist management: modify player access levels (`ADMIN`, `MODERATOR`, `GM`, `OVERSEER`, `OBSERVER`, `NONE`) and view ban history.
- 📦 **Worlds & Backups**:
  - View multiplayer world saves in `/data/Zomboid/saves/Multiplayer/`.
  - Instant one-click compressed `.tar.gz` world backups.
  - Download, manage, and safely wipe/reset world saves with safety confirmations.
- 📁 **In-Browser File Explorer & Code Editor**:
  - Full breadcrumb file navigation for `/data`.
  - Quick-access shortcuts to `server.ini`, `SandboxVars.lua`, and `spawnregions.lua`.
  - In-browser code editor with syntax highlighting, line numbers, Tab-key support, file creation, deletion, download, and file upload.
- 🔒 **Security & Authentication**:
  - Password-protected Web UI matching your admin password or a dedicated `WEBUI_PASSWORD`.

---

## 🚀 Quick Start

### 1. Clone or Download Repository

```bash
git clone https://github.com/your-username/project-zomboid-server-webui.git
cd project-zomboid-server-webui
```

### 2. Configure Environment

Copy `.env.example` to `.env` and set your desired admin password:

```bash
cp .env.example .env
```

Edit `.env` to set your credentials and preferences:
```env
SERVER_NAME=server
ADMIN_PASSWORD=MySuperSecretPassword123!
WEBUI_PASSWORD=MySuperSecretPassword123!
WEBUI_PORT=5011
MAX_RAM=8g
BUILD=stable
STEAM=true
```

> 💡 **Changing the Web UI Port**: You only need to change **one line**! In `.env`, change `WEBUI_PORT=5011` to any port you like (e.g. `WEBUI_PORT=8080`), or change line 11 in `docker-compose.yml`.

### 3. Start Server with Docker Compose

```bash
docker compose up -d
```

### 4. Access the Web Management Console

Open your web browser and navigate to:
```
http://localhost:5011
```
Enter your password (`WEBUI_PASSWORD` or `ADMIN_PASSWORD`) to unlock the console!

---

## 🌐 Network & Port Forwarding

For players to connect across the Internet or LAN, ensure the following ports are mapped and forwarded on your router/firewall:

| Port | Protocol | Purpose |
|------|----------|---------|
| `5011` | TCP | Web UI Management Dashboard (Default) |
| `16261` | UDP | Default Game Traffic Port (Required) |
| `16262` | UDP | Direct Connection Port (Required for Build 41 & 42) |
| `27015` | TCP | Optional RCON Port (if enabled in `server.ini`) |

---

## 📋 Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_NAME` | `server` | Name of the server configuration file (`<SERVER_NAME>.ini`) and world folder. |
| `ADMIN_USERNAME` | `admin` | Default administrator username for the game server. |
| `ADMIN_PASSWORD` | *(auto/prompt)* | Administrator password for Project Zomboid in-game console and permissions. |
| `WEBUI_PASSWORD` | Matches `ADMIN_PASSWORD` | Password required to unlock the Web UI dashboard. |
| `WEBUI_PORT` | `5011` | Port for the Web UI HTTP and WebSocket server (change in 1 line). |
| `WEBUI_AUTH_DISABLED` | `false` | Set to `true` to disable web login authentication. |
| `BUILD` | `stable` | Game branch: `stable` / `42`, `unstable`, `41` (legacy 41), `42.19`. |
| `MAX_RAM` | `8g` | Max RAM allocated to the JVM (e.g. `4096m`, `8g`, `16g`, `32g`). |
| `STEAM` | `true` | Set `false` to disable Steam auth and allow non-Steam players. |
| `TZ` | `America/New_York` | Container timezone for logs and schedule timestamps. |
| `PUID` / `PGID` | `1000` / `1000` | User ID and Group ID for file permission alignment on Linux hosts. |
| `LANGUAGE` | `en` | Server language (`en`, `es`, `fr`, `de`, `ru`, `cn`, etc.). |
| `AUTO_START` | `true` | Automatically launches the game server when the container starts. |
| `DISABLE_MOD_DOWNLOADER` | `false` | Disables automatic workshop mod downloads for non-Steam servers. |
| `DISABLE_CACHE` | `false` | Enables/disables binary cache on `/cache`. |
| `UPDATE_JRE` | `false` | Updates bundled JRE to latest Azul Zulu runtime (17 for B41, 25 for B42). |

---

## 🛠️ Mod Management

The Web UI provides 3 powerful ways to add and manage mods:

### 1. Single Mod (with Auto-Detect)
- Enter any Steam Workshop ID or URL.
- Click **🔍 Auto-Detect** — the server contacts Steam, extracts the mod title, and automatically detects the internal **Mod ID** from the author's description!
- Click **Add Mod**.

### 2. 📚 Steam Collection Importer (Bulk)
- Paste any public Steam Workshop Collection URL or ID (e.g., `https://steamcommunity.com/sharedfiles/filedetails/?id=2848248911`).
- Click **Fetch Collection**.
- The server retrieves every mod in the collection, including thumbnails, titles, Workshop IDs, and detected Mod IDs.
- Review the interactive checklist, pick which items to include, and click **➕ Add Selected Mods to Server**!

### 3. 📋 Bulk Text / Raw Paste
- Paste raw strings copied from `server.ini` (e.g. `WorkshopItems=2688809268;2790930776` and `Mods=AuthenticZLite;FilibusterRhymesUsedCars`).
- Or paste a raw list of Workshop URLs or IDs.
- Check **Auto-fetch Mod IDs from Steam** and click **Parse & Import Mods**.

### Non-Steam Servers
If `STEAM=false`, the server automatically downloads workshop mods listed under `WorkshopItems` in `server.ini` via SteamCMD and unpacks them into `/data/Zomboid/mods/` on startup.


---

## 💾 Backups and World Saves

Multiplayer world saves are stored under:
```
/data/Zomboid/saves/Multiplayer/<SERVER_NAME>/
```

- **Creating Backups**: In the **Worlds & Backups** tab or dashboard, click **"Instant World Backup"**. This creates a timestamped `.tar.gz` archive in `/data/backups/`.
- **Downloading Backups**: You can download any archive directly from the Web UI table or file explorer.
- **Wiping World**: If you want a fresh world generation, stop the server and use the **Wipe World** button in the Danger Zone.

---

## 🏗️ Building the Image Manually

If you prefer to build the container image yourself:

```bash
docker build -t my-project-zomboid-server:latest .
```

To run with your custom tag:
```bash
docker run -d \
  --name project-zomboid-server \
  -p 8080:8080 \
  -p 16261:16261/udp \
  -p 16262:16262/udp \
  -v $(pwd)/data:/data \
  -v $(pwd)/cache:/cache \
  -e ADMIN_PASSWORD="MySecretPassword123!" \
  my-project-zomboid-server:latest
```

---

## 📜 License

MIT License. Project Zomboid is a registered trademark of The Indie Stone.
