const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const crypto = require('crypto');

const PZManager = require('./pz-manager');
const FileManager = require('./file-manager');
const BackupManager = require('./backup-manager');
const DbManager = require('./db-manager');
const {
  parseIni,
  serializeIni,
  parseLuaTable,
  serializeSandboxVars,
  SANDBOX_SCHEMA
} = require('./config-parser');
const steamWorkshop = require('./steam-workshop');


const PORT = parseInt(process.env.WEBUI_PORT || '5011', 10);
const DATA_DIR = process.env.DATA_DIR || (process.platform === 'win32' ? path.join(__dirname, 'mock_data') : '/data');
const APP_DIR = process.env.APP_DIR || (process.platform === 'win32' ? path.join(__dirname, 'mock_app') : '/app');
const SERVER_NAME = process.env.SERVER_NAME || 'server';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const WEBUI_PASSWORD = process.env.WEBUI_PASSWORD || ADMIN_PASSWORD;
const WEBUI_AUTH_DISABLED = process.env.WEBUI_AUTH_DISABLED === 'true';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Generate auth token secret
const AUTH_SECRET = crypto.randomBytes(32).toString('hex');
const activeTokens = new Set();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Initialize managers
const pz = new PZManager({
  serverName: SERVER_NAME,
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: ADMIN_PASSWORD,
  language: process.env.LANGUAGE || 'en',
  maxRam: process.env.MAX_RAM || '8g',
  dataDir: DATA_DIR,
  appDir: APP_DIR
});

const fileManager = new FileManager(DATA_DIR);
const backupManager = new BackupManager(DATA_DIR, SERVER_NAME);
const dbManager = new DbManager(DATA_DIR, SERVER_NAME);

// Setup multer for file uploads
const upload = multer({
  dest: path.join(DATA_DIR, '.tmp_uploads'),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Authentication Middleware
function checkAuth(req, res, next) {
  if (WEBUI_AUTH_DISABLED) return next();

  const token = req.cookies.pz_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token && activeTokens.has(token)) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Please login.' });
}

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (WEBUI_AUTH_DISABLED || password === WEBUI_PASSWORD) {
    const token = crypto.randomBytes(24).toString('hex');
    activeTokens.add(token);
    res.cookie('pz_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.json({ success: true, token });
  }
  return res.status(401).json({ error: 'Invalid password' });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies.pz_token;
  if (token) activeTokens.delete(token);
  res.clearCookie('pz_token');
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  if (WEBUI_AUTH_DISABLED) {
    return res.json({ authenticated: true, authDisabled: true });
  }
  const token = req.cookies.pz_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const isValid = token && activeTokens.has(token);
  res.json({ authenticated: isValid, authDisabled: false });
});

// Protect all /api endpoints except auth
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth')) return next();
  return checkAuth(req, res, next);
});

// ==========================================
// SERVER CONTROLS & STATUS API
// ==========================================

app.get('/api/status', (req, res) => {
  res.json(pz.getStats());
});

app.post('/api/server/start', async (req, res) => {
  const result = await pz.startServer();
  res.json(result);
});

app.post('/api/server/stop', async (req, res) => {
  const result = await pz.stopServer();
  res.json(result);
});

app.post('/api/server/restart', async (req, res) => {
  const result = await pz.restartServer();
  res.json(result);
});

app.post('/api/server/command', (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'Command required' });
  const result = pz.sendCommand(command);
  res.json(result);
});

app.post('/api/server/update', async (req, res) => {
  try {
    const script = path.join(APP_DIR, 'download_server.sh');
    const result = await pz.runScript(script);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/server/sync-mods', async (req, res) => {
  try {
    const script = path.join('/usr/local/bin', 'mods_downloader.sh');
    const result = await pz.runScript(script);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CONFIGURATION API (server.ini & SandboxVars.lua)
// ==========================================

const SERVER_INI_PATH = path.join(DATA_DIR, 'Zomboid', 'Server', `${SERVER_NAME}.ini`);
const SANDBOX_VARS_PATH = path.join(DATA_DIR, 'Zomboid', 'Server', `${SERVER_NAME}_SandboxVars.lua`);

// Helper to ensure server config directories exist
function ensureConfigDir() {
  const cfgDir = path.join(DATA_DIR, 'Zomboid', 'Server');
  if (!fs.existsSync(cfgDir)) {
    fs.mkdirSync(cfgDir, { recursive: true });
  }
}

app.get('/api/config/server-ini', (req, res) => {
  ensureConfigDir();
  if (!fs.existsSync(SERVER_INI_PATH)) {
    return res.json({
      exists: false,
      data: {
        Public: 'false',
        PublicName: 'Project Zomboid Dedicated Server',
        PublicDescription: 'Survival awaits...',
        MaxPlayers: '32',
        PingLimit: '400',
        PauseEmpty: 'true',
        GlobalChat: 'true',
        Open: 'true',
        ServerWelcomeMessage: 'Welcome to Project Zomboid!',
        Mods: '',
        WorkshopItems: ''
      },
      raw: ''
    });
  }

  const raw = fs.readFileSync(SERVER_INI_PATH, 'utf8');
  const parsed = parseIni(raw);
  res.json({
    exists: true,
    data: parsed.data,
    raw
  });
});

app.post('/api/config/server-ini', (req, res) => {
  ensureConfigDir();
  const { data, raw } = req.body;

  let contentToWrite = '';
  if (raw !== undefined) {
    contentToWrite = raw;
  } else if (data) {
    let originalRawLines = [];
    if (fs.existsSync(SERVER_INI_PATH)) {
      const origRaw = fs.readFileSync(SERVER_INI_PATH, 'utf8');
      originalRawLines = parseIni(origRaw).rawLines;
    }
    contentToWrite = serializeIni(data, originalRawLines);
  } else {
    return res.status(400).json({ error: 'Missing data or raw content' });
  }

  fs.writeFileSync(SERVER_INI_PATH, contentToWrite, 'utf8');
  res.json({ success: true });
});

app.get('/api/config/sandbox', (req, res) => {
  ensureConfigDir();
  if (!fs.existsSync(SANDBOX_VARS_PATH)) {
    return res.json({
      exists: false,
      schema: SANDBOX_SCHEMA,
      data: {
        VERSION: 5,
        Zombies: 3,
        Distribution: 1,
        DayLength: 3,
        StartYear: 1,
        StartMonth: 7,
        StartDay: 9,
        StartTime: 2,
        WaterShut: 2,
        ElecShut: 2,
        FoodLoot: 2,
        CannedFoodLoot: 2,
        LiteratureLoot: 2,
        SurvivalGearsLoot: 2,
        MedicalLoot: 2,
        WeaponLoot: 2,
        RangedWeaponLoot: 2,
        AmmoLoot: 2,
        XpMultiplier: 1.0,
        ZombieLore: {
          Speed: 2,
          Strength: 2,
          Toughness: 2,
          Transmission: 1,
          Mortality: 5,
          Reanimate: 3,
          Cognition: 3,
          Memory: 2,
          Sight: 2,
          Hearing: 2
        },
        ZombieConfig: {
          PopulationMultiplier: 1.0,
          PopulationPeakMultiplier: 1.5,
          PopulationPeakDay: 28,
          RespawnHours: 72.0
        }
      },
      raw: ''
    });
  }

  const raw = fs.readFileSync(SANDBOX_VARS_PATH, 'utf8');
  const data = parseLuaTable(raw);
  res.json({
    exists: true,
    schema: SANDBOX_SCHEMA,
    data,
    raw
  });
});

app.post('/api/config/sandbox', (req, res) => {
  ensureConfigDir();
  const { data, raw } = req.body;

  let contentToWrite = '';
  if (raw !== undefined) {
    contentToWrite = raw;
  } else if (data) {
    contentToWrite = serializeSandboxVars(data);
  } else {
    return res.status(400).json({ error: 'Missing data or raw content' });
  }

  fs.writeFileSync(SANDBOX_VARS_PATH, contentToWrite, 'utf8');
  res.json({ success: true });
});

// Presets for Sandbox
app.get('/api/config/presets', (req, res) => {
  res.json({
    apocalypse: {
      name: 'Apocalypse (Hardcore)',
      description: 'Stealth focus. Short lifespan. Combat is best avoided.',
      data: {
        Zombies: 3,
        DayLength: 2,
        FoodLoot: 1,
        WeaponLoot: 1,
        AmmoLoot: 1,
        ZombieLore: { Speed: 2, Strength: 2, Toughness: 2, Transmission: 1, Mortality: 5 }
      }
    },
    survivor: {
      name: 'Survivor (Standard)',
      description: 'Powerful combat, classic Project Zomboid experience.',
      data: {
        Zombies: 3,
        DayLength: 2,
        FoodLoot: 2,
        WeaponLoot: 2,
        AmmoLoot: 2,
        ZombieLore: { Speed: 2, Strength: 2, Toughness: 2, Transmission: 1, Mortality: 5 }
      }
    },
    builder: {
      name: 'Builder (Casual)',
      description: 'Focus on construction, farming and survival with fewer zombies.',
      data: {
        Zombies: 4,
        DayLength: 3,
        FoodLoot: 3,
        WeaponLoot: 3,
        AmmoLoot: 3,
        ZombieLore: { Speed: 3, Strength: 3, Toughness: 3, Transmission: 4 }
      }
    },
    sprinters: {
      name: '28 Days Later (Sprinters)',
      description: 'All zombies are fast sprinters. Pure nightmare.',
      data: {
        Zombies: 3,
        DayLength: 2,
        FoodLoot: 2,
        WeaponLoot: 3,
        AmmoLoot: 3,
        ZombieLore: { Speed: 1, Strength: 2, Toughness: 2, Transmission: 1 }
      }
    }
  });
});

// ==========================================
// MODS MANAGEMENT API
// ==========================================

app.get('/api/mods', (req, res) => {
  ensureConfigDir();
  let workshopItems = [];
  let mods = [];

  if (fs.existsSync(SERVER_INI_PATH)) {
    const raw = fs.readFileSync(SERVER_INI_PATH, 'utf8');
    const { data } = parseIni(raw);
    if (data.WorkshopItems) {
      workshopItems = data.WorkshopItems.split(';').map(s => s.trim()).filter(Boolean);
    }
    if (data.Mods) {
      mods = data.Mods.split(';').map(s => s.trim()).filter(Boolean);
    }
  }

  // Also scan local mods folder
  const localModsDir = path.join(DATA_DIR, 'Zomboid', 'mods');
  const installedMods = [];
  if (fs.existsSync(localModsDir)) {
    try {
      const dirs = fs.readdirSync(localModsDir, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory()) {
          installedMods.push(d.name);
        }
      }
    } catch (e) {}
  }

  res.json({
    workshopItems,
    mods,
    installedMods
  });
});

app.post('/api/mods', (req, res) => {
  ensureConfigDir();
  const { workshopItems, mods } = req.body;

  let origData = {};
  let originalRawLines = [];
  if (fs.existsSync(SERVER_INI_PATH)) {
    const origRaw = fs.readFileSync(SERVER_INI_PATH, 'utf8');
    const parsed = parseIni(origRaw);
    origData = parsed.data;
    originalRawLines = parsed.rawLines;
  }

  if (Array.isArray(workshopItems)) {
    origData.WorkshopItems = workshopItems.join(';');
  }
  if (Array.isArray(mods)) {
    origData.Mods = mods.join(';');
  }

  const newIni = serializeIni(origData, originalRawLines);
  fs.writeFileSync(SERVER_INI_PATH, newIni, 'utf8');
  res.json({ success: true, workshopItems: origData.WorkshopItems, mods: origData.Mods });
});

// Fetch all items from a Steam Collection with their metadata & detected Mod IDs
app.post('/api/mods/fetch-collection', async (req, res) => {
  const { collectionUrl } = req.body;
  if (!collectionUrl) return res.status(400).json({ error: 'Collection URL or ID is required' });

  try {
    const collectionData = await steamWorkshop.fetchCollection(collectionUrl);
    // Fetch details for all items in batch
    const items = await steamWorkshop.batchFetchModDetails(collectionData.workshopIds, 5);
    res.json({
      collectionId: collectionData.collectionId,
      title: collectionData.title,
      itemCount: collectionData.itemCount,
      items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch metadata & detected Mod IDs for a single Workshop item
app.post('/api/mods/fetch-item', async (req, res) => {
  const { workshopId } = req.body;
  if (!workshopId) return res.status(400).json({ error: 'Workshop ID is required' });

  try {
    const id = steamWorkshop.extractId(workshopId);
    if (!id) return res.status(400).json({ error: 'Invalid Workshop ID or URL' });
    const details = await steamWorkshop.fetchModDetails(id);
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Parse arbitrary bulk text input
app.post('/api/mods/parse-bulk', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.json({ workshopIds: [], modIds: [], items: [] });

  try {
    const parsed = steamWorkshop.parseBulkText(text);
    // If workshop IDs are found, fetch their details so user can verify title & Mod IDs
    let items = [];
    if (parsed.workshopIds.length > 0) {
      items = await steamWorkshop.batchFetchModDetails(parsed.workshopIds.slice(0, 50), 5);
    }
    res.json({
      workshopIds: parsed.workshopIds,
      modIds: parsed.modIds,
      items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk add multiple items to server.ini
app.post('/api/mods/bulk-add', (req, res) => {
  ensureConfigDir();
  const { items } = req.body; // array of { workshopId, modId }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array required' });
  }

  let origData = {};
  let originalRawLines = [];
  if (fs.existsSync(SERVER_INI_PATH)) {
    const origRaw = fs.readFileSync(SERVER_INI_PATH, 'utf8');
    const parsed = parseIni(origRaw);
    origData = parsed.data;
    originalRawLines = parsed.rawLines;
  }

  const currentWorkshopItems = origData.WorkshopItems ? origData.WorkshopItems.split(';').map(s => s.trim()).filter(Boolean) : [];
  const currentMods = origData.Mods ? origData.Mods.split(';').map(s => s.trim()).filter(Boolean) : [];

  let addedCount = 0;
  for (const item of items) {
    const wsId = item.workshopId ? item.workshopId.toString().trim() : '';
    const modId = item.modId ? item.modId.toString().trim() : '';

    if (wsId && !currentWorkshopItems.includes(wsId)) {
      currentWorkshopItems.push(wsId);
    }
    if (modId && !currentMods.includes(modId)) {
      currentMods.push(modId);
      addedCount++;
    }
  }

  origData.WorkshopItems = currentWorkshopItems.join(';');
  origData.Mods = currentMods.join(';');

  const newIni = serializeIni(origData, originalRawLines);
  fs.writeFileSync(SERVER_INI_PATH, newIni, 'utf8');

  res.json({
    success: true,
    addedCount,
    totalMods: currentMods.length,
    totalWorkshopItems: currentWorkshopItems.length,
    workshopItems: origData.WorkshopItems,
    mods: origData.Mods
  });
});


// ==========================================
// PLAYERS & ROLES / BANS API
// ==========================================

app.get('/api/players', async (req, res) => {
  try {
    const whitelistUsers = await dbManager.getAllUsers();
    const bans = await dbManager.getAllBans();
    res.json({
      onlinePlayers: Array.from(pz.onlinePlayers),
      whitelist: whitelistUsers,
      bans
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/players/role', async (req, res) => {
  const { username, accesslevel } = req.body;
  if (!username || !accesslevel) return res.status(400).json({ error: 'Username and accesslevel required' });

  try {
    await dbManager.updateUserRole(username, accesslevel);
    // Also send in-game console command if server running
    pz.sendCommand(`setaccesslevel "${username}" "${accesslevel}"`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/players/:username', async (req, res) => {
  const { username } = req.params;
  try {
    await dbManager.removeUser(username);
    pz.sendCommand(`removeuserfromwhitelist "${username}"`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/players/kick', (req, res) => {
  const { username, reason } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  const reasonStr = reason ? ` -r "${reason}"` : '';
  pz.sendCommand(`kickuser "${username}"${reasonStr}`);
  res.json({ success: true });
});

app.post('/api/players/ban', (req, res) => {
  const { username, reason, banIp } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  const reasonStr = reason ? ` -r "${reason}"` : '';
  const ipFlag = banIp ? ' -ip' : '';
  pz.sendCommand(`banuser "${username}"${ipFlag}${reasonStr}`);
  res.json({ success: true });
});

app.post('/api/players/unban', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  try {
    await dbManager.unbanUser(username);
    pz.sendCommand(`unbanuser "${username}"`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// WORLDS & BACKUPS API
// ==========================================

app.get('/api/worlds', async (req, res) => {
  try {
    const worlds = await backupManager.listWorlds();
    const backups = await backupManager.listBackups();
    res.json({ worlds, backups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/worlds/backup', async (req, res) => {
  const { worldName } = req.body;
  try {
    const result = await backupManager.createBackup(worldName || SERVER_NAME);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/worlds/backup/:filename', async (req, res) => {
  try {
    await backupManager.deleteBackup(req.params.filename);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/worlds/wipe', async (req, res) => {
  if (pz.status === 'online' || pz.status === 'starting') {
    return res.status(400).json({ error: 'Server must be stopped before wiping world.' });
  }
  const { worldName } = req.body;
  try {
    await backupManager.wipeWorld(worldName || SERVER_NAME);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// FILE MANAGER API
// ==========================================

app.get('/api/files/list', async (req, res) => {
  try {
    const result = await fileManager.list(req.query.path || '');
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/files/read', async (req, res) => {
  try {
    const result = await fileManager.readFile(req.query.path);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/files/write', async (req, res) => {
  const { path: filePath, content } = req.body;
  try {
    const result = await fileManager.writeFile(filePath, content);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/files/mkdir', async (req, res) => {
  try {
    const result = await fileManager.createDir(req.body.path);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/files', async (req, res) => {
  try {
    const result = await fileManager.delete(req.query.path);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/files/rename', async (req, res) => {
  const { oldPath, newPath } = req.body;
  try {
    const result = await fileManager.rename(oldPath, newPath);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/files/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const targetDir = req.body.targetDir || '';
  try {
    const safeTargetDir = fileManager.resolveSafePath(targetDir);
    const dest = path.join(safeTargetDir, req.file.originalname);
    await fs.promises.rename(req.file.path, dest);
    res.json({ success: true, filename: req.file.originalname });
  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/files/download', (req, res) => {
  try {
    const safePath = fileManager.resolveSafePath(req.query.path);
    res.download(safePath);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// LOGS & WEBSOCKETS
// ==========================================

app.get('/api/logs/history', (req, res) => {
  res.json({
    logs: pz.logHistory
  });
});

wss.on('connection', (ws) => {
  pz.subscribe(ws);
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all for SPA client routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start listener
server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`  Project Zomboid Server Web UI is running!`);
  console.log(`  Access URL: http://localhost:${PORT}`);
  console.log(`  Server Name: ${SERVER_NAME}`);
  console.log(`  Admin Auth: ${WEBUI_AUTH_DISABLED ? 'Disabled' : 'Enabled'}`);
  console.log(`=======================================================`);

  // Auto start server if requested
  const autoStart = process.env.AUTO_START !== 'false';
  if (autoStart) {
    console.log('[Supervisor] AUTO_START is active. Starting PZ server...');
    pz.startServer().catch(err => console.error('[Supervisor] Startup error:', err));
  }
});

module.exports = { app, server, pz };
