/**
 * Main Application Controller
 * Handles SPA navigation, WebSocket connection, server status, and auth.
 */

const App = {
  ws: null,
  reconnectTimer: null,
  currentStatus: 'stopped',
  uptimeSeconds: 0,
  uptimeInterval: null,

  init() {
    this.setupAuth();
    this.setupNavigation();
    this.setupHeaderActions();
    this.setupModals();
    this.initWebSocket();
    this.startStatusPoller();
  },

  // Auth checking
  async setupAuth() {
    const authOverlay = document.getElementById('authOverlay');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');

    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (!data.authenticated && !data.authDisabled) {
        authOverlay.classList.remove('hidden');
      }
    } catch (e) {
      authOverlay.classList.remove('hidden');
    }

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.classList.add('hidden');
      const password = document.getElementById('loginPassword').value;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (data.success) {
          authOverlay.classList.add('hidden');
          App.toast('Logged in successfully', 'success');
          App.loadActiveTabData();
        } else {
          loginError.textContent = data.error || 'Login failed';
          loginError.classList.remove('hidden');
        }
      } catch (err) {
        loginError.textContent = 'Server connection error';
        loginError.classList.remove('hidden');
      }
    });

    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    });
  },

  // SPA Navigation
  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      this.switchTab(hash, false);
    });

    // Initial load from hash
    const initialHash = window.location.hash.replace('#', '') || 'dashboard';
    this.switchTab(initialHash, false);
  },

  switchTab(tabName, updateHash = true) {
    const navItems = document.querySelectorAll('.nav-item');
    const panes = document.querySelectorAll('.tab-pane');

    const targetPane = document.getElementById(`tab-${tabName}`);
    if (!targetPane) return;

    navItems.forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-tab') === tabName);
    });

    panes.forEach(pane => pane.classList.remove('active'));
    targetPane.classList.add('active');

    if (updateHash) {
      window.location.hash = tabName;
    }

    // Set page title
    const titleMap = {
      dashboard: 'Dashboard',
      console: 'Interactive Server Terminal',
      sandbox: 'Sandbox Settings Editor',
      mods: 'Mods & Steam Workshop',
      'server-ini': 'Server Configuration',
      players: 'Players & Bans',
      worlds: 'Worlds & Save Backups',
      files: 'File Explorer & Editor'
    };
    document.getElementById('pageTitle').textContent = titleMap[tabName] || 'Dashboard';

    this.loadTabHandler(tabName);
  },

  loadActiveTabData() {
    const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab') || 'dashboard';
    this.loadTabHandler(activeTab);
  },

  loadTabHandler(tabName) {
    if (tabName === 'sandbox' && window.SandboxController) window.SandboxController.load();
    if (tabName === 'mods' && window.ModsController) window.ModsController.load();
    if (tabName === 'server-ini' && window.ServerIniController) window.ServerIniController.load();
    if (tabName === 'players' && window.PlayersController) window.PlayersController.load();
    if (tabName === 'worlds' && window.WorldsController) window.WorldsController.load();
    if (tabName === 'files' && window.FilesController) window.FilesController.load();
  },

  // WebSocket for Live Logs & Server Events
  initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[WS] Connected to PZ Server stream');
      if (this.reconnectTimer) clearInterval(this.reconnectTimer);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleWsMessage(msg);
      } catch (e) {
        console.error('Invalid WS message', e);
      }
    };

    this.ws.onclose = () => {
      console.warn('[WS] Stream closed. Reconnecting in 3s...');
      this.reconnectTimer = setTimeout(() => this.initWebSocket(), 3000);
    };
  },

  handleWsMessage(msg) {
    if (msg.type === 'init') {
      this.updateStatus(msg.status);
      this.updateOnlinePlayers(msg.onlinePlayers || []);
      if (window.ConsoleController) {
        window.ConsoleController.initLogs(msg.logs || []);
      }
    } else if (msg.type === 'status') {
      this.updateStatus(msg.status);
    } else if (msg.type === 'log') {
      if (window.ConsoleController) {
        window.ConsoleController.appendLog(msg.log);
      }
      this.appendMiniLog(msg.log);
    } else if (msg.type === 'players') {
      this.updateOnlinePlayers(msg.onlinePlayers || []);
    }
  },

  appendMiniLog(log) {
    const mini = document.getElementById('dashMiniConsole');
    if (!mini) return;
    const line = `[${log.source.toUpperCase()}] ${log.text}\n`;
    mini.textContent += line;
    // Keep last 1500 chars
    if (mini.textContent.length > 3000) {
      mini.textContent = mini.textContent.slice(-2500);
    }
    mini.scrollTop = mini.scrollHeight;
  },

  updateStatus(status) {
    this.currentStatus = status;
    const dot = document.getElementById('quickStatusDot');
    const text = document.getElementById('quickStatusText');
    const dashStatus = document.getElementById('dashStatus');

    dot.className = `status-dot ${status}`;
    text.textContent = status.toUpperCase();
    if (dashStatus) dashStatus.textContent = status.toUpperCase();

    // Toggle button states
    const btnQuickStart = document.getElementById('btnQuickStart');
    const btnQuickStop = document.getElementById('btnQuickStop');
    const btnQuickRestart = document.getElementById('btnQuickRestart');
    const dashBtnStart = document.getElementById('dashBtnStart');
    const dashBtnStop = document.getElementById('dashBtnStop');
    const dashBtnRestart = document.getElementById('dashBtnRestart');

    const isRunning = status === 'online' || status === 'starting';
    const isStopping = status === 'stopping' || status === 'installing';

    btnQuickStart.disabled = isRunning || isStopping;
    btnQuickStop.disabled = !isRunning;
    btnQuickRestart.disabled = !isRunning;

    if (dashBtnStart) dashBtnStart.disabled = isRunning || isStopping;
    if (dashBtnStop) dashBtnStop.disabled = !isRunning;
    if (dashBtnRestart) dashBtnRestart.disabled = !isRunning;
  },

  updateOnlinePlayers(players) {
    const count = players.length;
    const badge = document.getElementById('playerBadge');
    const dashCount = document.getElementById('dashPlayersCount');

    if (badge) badge.textContent = count;
    if (dashCount) dashCount.textContent = count;

    if (window.PlayersController) {
      window.PlayersController.renderOnline(players);
    }
  },

  // Poller for system stats & uptime
  startStatusPoller() {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const data = await res.json();
          this.renderStats(data);
        }
      } catch (e) {}
    };

    fetchStats();
    setInterval(fetchStats, 4000);
  },

  renderStats(data) {
    if (data.status) this.updateStatus(data.status);
    if (data.serverName) {
      document.getElementById('headerServerName').textContent = data.serverName;
      const infoName = document.getElementById('infoServerName');
      if (infoName) infoName.textContent = data.serverName;
    }

    // Uptime
    const uptimeStr = this.formatDuration(data.uptime || 0);
    document.getElementById('quickUptimeText').textContent = uptimeStr;
    const dashUptime = document.getElementById('dashUptime');
    if (dashUptime) dashUptime.textContent = `Uptime: ${uptimeStr}`;

    // Memory
    if (data.system) {
      const mem = data.system;
      const memPct = mem.memPercent || 0;
      const memVal = document.getElementById('dashMemValue');
      const memBar = document.getElementById('dashMemBar');
      if (memVal) memVal.textContent = `${memPct}%`;
      if (memBar) memBar.style.width = `${memPct}%`;

      const cpuCores = document.getElementById('dashCpuCores');
      const cpuLoad = document.getElementById('dashCpuLoad');
      if (cpuCores) cpuCores.textContent = `${mem.cpuCount} Cores`;
      if (cpuLoad && mem.loadAvg) cpuLoad.textContent = `Load: ${mem.loadAvg[0].toFixed(2)}`;
    }
  },

  formatDuration(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  },

  // Quick Action Buttons
  setupHeaderActions() {
    const bindAction = (btnId, endpoint, msg) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.addEventListener('click', async () => {
        try {
          App.toast(`${msg}...`, 'info');
          const res = await fetch(endpoint, { method: 'POST' });
          const data = await res.json();
          if (data.error) App.toast(data.error, 'error');
        } catch (e) {
          App.toast(`Failed to execute: ${e.message}`, 'error');
        }
      });
    };

    bindAction('btnQuickStart', '/api/server/start', 'Starting server');
    bindAction('dashBtnStart', '/api/server/start', 'Starting server');

    bindAction('btnQuickStop', '/api/server/stop', 'Stopping server');
    bindAction('dashBtnStop', '/api/server/stop', 'Stopping server');

    bindAction('btnQuickRestart', '/api/server/restart', 'Restarting server');
    bindAction('dashBtnRestart', '/api/server/restart', 'Restarting server');

    bindAction('dashBtnSteamUpdate', '/api/server/update', 'Launching SteamCMD PZ server update');
    bindAction('dashBtnSyncMods', '/api/server/sync-mods', 'Downloading workshop mods via SteamCMD');
    bindAction('dashBtnBackup', '/api/worlds/backup', 'Creating instant world backup');
  },

  setupModals() {
    const broadcastModal = document.getElementById('broadcastModal');
    const btnQuickBroadcast = document.getElementById('btnQuickBroadcast');
    const broadcastForm = document.getElementById('broadcastForm');

    btnQuickBroadcast.addEventListener('click', () => {
      broadcastModal.classList.remove('hidden');
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-close');
        document.getElementById(target)?.classList.add('hidden');
      });
    });

    broadcastForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('broadcastMsg').value;
      if (!msg) return;

      try {
        await fetch('/api/server/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: `servermsg "${msg}"` })
        });
        App.toast('Announcement broadcasted to server', 'success');
        broadcastModal.classList.add('hidden');
        document.getElementById('broadcastMsg').value = '';
      } catch (err) {
        App.toast('Broadcast failed: ' + err.message, 'error');
      }
    });
  },

  toast(text, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = text;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
