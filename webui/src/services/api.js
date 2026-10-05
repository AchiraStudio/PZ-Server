// ==============================================================================
// Project Zomboid Server Web UI - REST & WebSocket API Client
// ==============================================================================

const API_BASE = '/api';

export async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { ...options.headers };

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin'
  });

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('pz-unauthorized'));
    throw new Error('Unauthorized');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  }

  return data;
}

// Auth APIs
export const authApi = {
  check: () => request('/auth/me'),
  login: (password) => request('/auth/login', { method: 'POST', body: { password } }),
  logout: () => request('/auth/logout', { method: 'POST' })
};

// Server Controls & Status
export const serverApi = {
  getStatus: () => request('/status'),
  start: () => request('/server/start', { method: 'POST' }),
  stop: () => request('/server/stop', { method: 'POST' }),
  restart: () => request('/server/restart', { method: 'POST' }),
  update: () => request('/server/update', { method: 'POST' }),
  syncMods: () => request('/server/sync-mods', { method: 'POST' }),
  sendCommand: (command) => request('/server/command', { method: 'POST', body: { command } }),
  getLogHistory: () => request('/logs/history')
};

// Configuration & Sandbox APIs
export const configApi = {
  getServerIni: () => request('/config/server-ini'),
  saveServerIni: (payload) => request('/config/server-ini', { method: 'POST', body: payload }),
  getSandbox: () => request('/config/sandbox'),
  saveSandbox: (payload) => request('/config/sandbox', { method: 'POST', body: payload }),
  getPresets: () => request('/config/presets')
};

// Mods Management
export const modsApi = {
  getMods: () => request('/mods'),
  saveMods: (workshopItems, mods) => request('/mods', { method: 'POST', body: { workshopItems, mods } }),
  fetchCollection: (collectionUrl) => request('/mods/fetch-collection', { method: 'POST', body: { collectionUrl } }),
  fetchItem: (workshopId) => request('/mods/fetch-item', { method: 'POST', body: { workshopId } }),
  parseBulk: (text) => request('/mods/parse-bulk', { method: 'POST', body: { text } }),
  bulkAdd: (items) => request('/mods/bulk-add', { method: 'POST', body: { items } })
};

// Players & Security
export const playersApi = {
  getPlayers: () => request('/players'),
  setRole: (username, accesslevel) => request('/players/role', { method: 'POST', body: { username, accesslevel } }),
  removeWhitelist: (username) => request(`/players/${encodeURIComponent(username)}`, { method: 'DELETE' }),
  kick: (username, reason) => request('/players/kick', { method: 'POST', body: { username, reason } }),
  ban: (username, reason, banIp) => request('/players/ban', { method: 'POST', body: { username, reason, banIp } }),
  unban: (username) => request('/players/unban', { method: 'POST', body: { username } })
};

// Worlds & Backups
export const backupsApi = {
  getWorlds: () => request('/worlds'),
  createBackup: (worldName) => request('/worlds/backup', { method: 'POST', body: { worldName } }),
  deleteBackup: (filename) => request(`/worlds/backup/${encodeURIComponent(filename)}`, { method: 'DELETE' }),
  wipeWorld: (worldName) => request('/worlds/wipe', { method: 'POST', body: { worldName } })
};

// File Manager APIs (All tested with proper safe relative paths)
export const filesApi = {
  list: (dirPath = '') => request(`/files/list?path=${encodeURIComponent(dirPath)}`),
  read: (filePath) => request(`/files/read?path=${encodeURIComponent(filePath)}`),
  write: (filePath, content) => request('/files/write', { method: 'POST', body: { path: filePath, content } }),
  createFile: (filePath) => request('/files/create-file', { method: 'POST', body: { path: filePath } }),
  mkdir: (dirPath) => request('/files/mkdir', { method: 'POST', body: { path: dirPath } }),
  delete: (targetPath) => request(`/files?path=${encodeURIComponent(targetPath)}`, { method: 'DELETE' }),
  batchDelete: (paths) => request('/files/batch-delete', { method: 'POST', body: { paths } }),
  rename: (oldPath, newPath) => request('/files/rename', { method: 'POST', body: { oldPath, newPath } }),
  upload: (file, targetDir = '') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetDir', targetDir);
    return request('/files/upload', { method: 'POST', body: formData });
  },
  getDownloadUrl: (filePath) => `/api/files/download?path=${encodeURIComponent(filePath)}`
};

// WebSocket log & telemetry streaming helper
export function connectWebSocket(onMessage, onOpen, onClose) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  let ws = null;
  let reconnectTimer = null;
  let isClosedExplicitly = false;

  function connect() {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (onOpen) onOpen();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    ws.onclose = () => {
      if (onClose) onClose();
      if (!isClosedExplicitly) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    };

    ws.onerror = (err) => {
      ws.close();
    };
  }

  connect();

  return {
    send: (msg) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
    },
    close: () => {
      isClosedExplicitly = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    }
  };
}
