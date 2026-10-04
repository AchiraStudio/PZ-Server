const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class PZManager {
  constructor(options = {}) {
    this.serverName = options.serverName || process.env.SERVER_NAME || 'server';
    this.adminUsername = options.adminUsername || process.env.ADMIN_USERNAME || 'admin';
    this.adminPassword = options.adminPassword || process.env.ADMIN_PASSWORD || '';
    this.language = options.language || process.env.LANGUAGE || 'en';
    this.maxRam = options.maxRam || process.env.MAX_RAM || '8g';
    this.dataDir = options.dataDir || '/data';
    this.appDir = options.appDir || '/app';

    this.status = 'stopped'; // 'stopped', 'installing', 'starting', 'online', 'stopping'
    this.process = null;
    this.pid = null;
    this.startTime = null;
    this.onlinePlayers = new Set();
    this.logHistory = [];
    this.maxLogHistory = 2500;
    this.subscribers = new Set();
  }

  // Subscribe websocket client
  subscribe(ws) {
    this.subscribers.add(ws);
    // Send initial status and cached logs
    ws.send(JSON.stringify({
      type: 'init',
      status: this.status,
      onlinePlayers: Array.from(this.onlinePlayers),
      logs: this.logHistory.slice(-500)
    }));

    ws.on('close', () => {
      this.subscribers.delete(ws);
    });
  }

  broadcast(message) {
    const payload = JSON.stringify(message);
    for (const ws of this.subscribers) {
      if (ws.readyState === 1 /* OPEN */) {
        try {
          ws.send(payload);
        } catch (e) {}
      }
    }
  }

  addLog(rawText, source = 'server') {
    const lines = rawText.toString().split(/\r?\n/);
    const timestamp = new Date().toISOString();

    for (const line of lines) {
      if (!line && lines.length > 1) continue;
      console.log(`[${source.toUpperCase()}] ${line}`);
      const logEntry = {
        timestamp,
        source,
        text: line
      };

      this.logHistory.push(logEntry);
      if (this.logHistory.length > this.maxLogHistory) {
        this.logHistory.shift();
      }

      this.broadcast({
        type: 'log',
        log: logEntry
      });

      this.analyzeLogLine(line);
    }
  }

  analyzeLogLine(line) {
    // Detect server started
    if (line.includes('SERVER STARTED') || line.includes('Server launched and waiting for players')) {
      if (this.status !== 'online') {
        this.status = 'online';
        this.broadcast({ type: 'status', status: this.status });
      }
    }

    // Detect player connection patterns
    // e.g.: "User John connected" or "ConnectionManager: Player John (SteamID ...) connected"
    const joinMatch = line.match(/(?:User|Player)\s+([a-zA-Z0-9_-]+)\s+connected/i);
    if (joinMatch) {
      const username = joinMatch[1];
      this.onlinePlayers.add(username);
      this.broadcast({
        type: 'players',
        onlinePlayers: Array.from(this.onlinePlayers)
      });
    }

    // Detect player disconnect
    const leaveMatch = line.match(/(?:User|Player)\s+([a-zA-Z0-9_-]+)\s+(?:disconnected|fully disconnected)/i);
    if (leaveMatch) {
      const username = leaveMatch[1];
      this.onlinePlayers.delete(username);
      this.broadcast({
        type: 'players',
        onlinePlayers: Array.from(this.onlinePlayers)
      });
    }
  }

  async startServer() {
    if (this.status === 'online' || this.status === 'starting' || this.status === 'installing') {
      return { success: false, message: `Server is already in ${this.status} state.` };
    }

    const startScript = path.join(this.appDir, 'start-server.sh');
    const downloadScript = '/usr/local/bin/download_server.sh';

    if (!fs.existsSync(startScript)) {
      if (fs.existsSync(downloadScript)) {
        this.addLog('[Supervisor] Dedicated server files not detected in /app. Automatically downloading server via SteamCMD...', 'supervisor');
        try {
          await this.runScript(downloadScript);
        } catch (dlErr) {
          this.addLog(`[Supervisor] Server download failed: ${dlErr.message}`, 'error');
          return { success: false, error: dlErr.message };
        }
      } else {
        // Local dev/preview simulation mode when running outside Docker container
        this.status = 'starting';
        this.startTime = Date.now();
        this.broadcast({ type: 'status', status: this.status });
        this.addLog(`[Supervisor] Starting Project Zomboid Dedicated Server (${this.serverName})...`, 'supervisor');
        this.addLog('[Supervisor] Running in development/preview mode (start-server.sh not present in local filesystem).', 'supervisor');
        setTimeout(() => {
          this.status = 'online';
          this.addLog('*** SERVER STARTED ***', 'server');
          this.addLog('Project Zomboid Server listening on port 16261 (UDP)', 'server');
          this.broadcast({ type: 'status', status: this.status });
        }, 1500);
        return { success: true };
      }
    }

    this.status = 'starting';
    this.startTime = Date.now();
    this.broadcast({ type: 'status', status: this.status });
    this.addLog(`[Supervisor] Starting Project Zomboid Dedicated Server (${this.serverName})...`, 'supervisor');

    // Command to launch PZ Dedicated Server
    const args = [
      `-Duser.language=${this.language}`,
      `-Ddeployment.user.cachedir=${this.dataDir}`,
      '--',
      '-servername', this.serverName,
      '-adminusername', this.adminUsername,
      '-adminpassword', this.adminPassword || 'AdminPass123'
    ];

    try {
      this.process = spawn(startScript, args, {
        cwd: this.appDir,
        env: {
          ...process.env,
          PATH: process.env.PATH,
          LANG: 'en_US.UTF-8'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.pid = this.process.pid;

      this.process.stdout.on('data', (chunk) => {
        this.addLog(chunk.toString(), 'stdout');
      });

      this.process.stderr.on('data', (chunk) => {
        this.addLog(chunk.toString(), 'stderr');
      });

      this.process.on('close', (code, signal) => {
        this.addLog(`[Supervisor] Server process exited with code ${code} (signal: ${signal})`, 'supervisor');
        this.status = 'stopped';
        this.process = null;
        this.pid = null;
        this.startTime = null;
        this.onlinePlayers.clear();
        this.broadcast({ type: 'status', status: this.status });
        this.broadcast({ type: 'players', onlinePlayers: [] });
      });

      this.process.on('error', (err) => {
        this.addLog(`[Supervisor] Process error: ${err.message}`, 'error');
        this.status = 'stopped';
        this.broadcast({ type: 'status', status: this.status });
      });

      return { success: true };
    } catch (err) {
      this.status = 'stopped';
      this.broadcast({ type: 'status', status: this.status });
      this.addLog(`[Supervisor] Failed to launch server: ${err.message}`, 'error');
      return { success: false, error: err.message };
    }
  }

  async stopServer() {
    if (this.status === 'stopped') {
      return { success: false, message: 'Server is already stopped.' };
    }

    this.status = 'stopping';
    this.broadcast({ type: 'status', status: this.status });
    this.addLog('[Supervisor] Stopping server gracefully (sending "save" then "quit")...', 'supervisor');

    if (!this.process) {
      // Mock mode
      setTimeout(() => {
        this.status = 'stopped';
        this.startTime = null;
        this.onlinePlayers.clear();
        this.broadcast({ type: 'status', status: this.status });
        this.addLog('[Supervisor] Server stopped.', 'supervisor');
      }, 1000);
      return { success: true };
    }

    try {
      this.sendCommand('save');
      setTimeout(() => {
        this.sendCommand('quit');
      }, 2000);

      // Force kill after 25s timeout if server hangs
      const killTimeout = setTimeout(() => {
        if (this.process) {
          this.addLog('[Supervisor] Server did not exit in time. Forcing termination...', 'supervisor');
          this.process.kill('SIGKILL');
        }
      }, 25000);

      this.process.once('close', () => {
        clearTimeout(killTimeout);
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async restartServer() {
    this.addLog('[Supervisor] Restarting server...', 'supervisor');
    await this.stopServer();
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 3000));
    return this.startServer();
  }

  sendCommand(command) {
    const cmd = command.trim();
    if (!cmd) return { success: false, message: 'Empty command' };

    this.addLog(`> ${cmd}`, 'input');

    if (this.process && this.process.stdin && this.process.stdin.writable) {
      this.process.stdin.write(cmd + '\n');
      return { success: true };
    } else {
      if (this.status === 'online') {
        // Echo mock response
        this.addLog(`[Server Console] Executed command: ${cmd}`, 'server');
        return { success: true };
      }
      return { success: false, message: 'Server is not running or stdin is unavailable.' };
    }
  }

  async runScript(scriptPath, args = []) {
    if (this.status === 'online' || this.status === 'starting') {
      throw new Error('Please stop the server before running server updates or downloads.');
    }

    this.status = 'installing';
    this.broadcast({ type: 'status', status: this.status });
    this.addLog(`[Supervisor] Running task: ${path.basename(scriptPath)} ${args.join(' ')}...`, 'supervisor');

    return new Promise((resolve, reject) => {
      if (!fs.existsSync(scriptPath)) {
        setTimeout(() => {
          this.addLog(`[Supervisor] Simulation: Script completed successfully.`, 'supervisor');
          this.status = 'stopped';
          this.broadcast({ type: 'status', status: this.status });
          resolve({ success: true, simulated: true });
        }, 2000);
        return;
      }

      const proc = spawn(scriptPath, args, {
        cwd: this.appDir,
        env: process.env
      });

      proc.stdout.on('data', chunk => this.addLog(chunk.toString(), 'stdout'));
      proc.stderr.on('data', chunk => this.addLog(chunk.toString(), 'stderr'));

      proc.on('close', (code) => {
        this.status = 'stopped';
        this.broadcast({ type: 'status', status: this.status });
        if (code === 0) {
          this.addLog(`[Supervisor] Task completed successfully.`, 'supervisor');
          resolve({ success: true });
        } else {
          this.addLog(`[Supervisor] Task exited with error code ${code}.`, 'error');
          reject(new Error(`Exit code ${code}`));
        }
      });
    });
  }

  getStats() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    let uptime = 0;
    if (this.startTime && this.status === 'online') {
      uptime = Math.floor((Date.now() - this.startTime) / 1000);
    }

    return {
      status: this.status,
      serverName: this.serverName,
      uptime,
      onlinePlayersCount: this.onlinePlayers.size,
      onlinePlayers: Array.from(this.onlinePlayers),
      system: {
        totalMem,
        usedMem,
        freeMem,
        memPercent: Math.round((usedMem / totalMem) * 100),
        cpuCount: os.cpus().length,
        loadAvg: os.loadavg()
      }
    };
  }
}

module.exports = PZManager;
