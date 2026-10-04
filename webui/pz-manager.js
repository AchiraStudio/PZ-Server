const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const DockerClient = require('./docker-client');
const RconClient = require('./rcon-client');

class PZManager {
  constructor(options = {}) {
    this.serverName = options.serverName || process.env.SERVER_NAME || 'server';
    this.adminUsername = options.adminUsername || process.env.ADMIN_USERNAME || 'admin';
    this.adminPassword = options.adminPassword || process.env.ADMIN_PASSWORD || '';
    this.language = options.language || process.env.LANGUAGE || 'en';
    this.maxRam = options.maxRam || process.env.MAX_RAM || '8g';
    this.dataDir = options.dataDir || '/data';
    this.appDir = options.appDir || '/app';

    this.containerName = options.containerName || process.env.PZ_CONTAINER_NAME || 'project-zomboid-dedicated-server';
    this.rconHost = options.rconHost || process.env.RCON_HOST || 'pzserver';
    this.rconPort = parseInt(options.rconPort || process.env.RCON_PORT || '27015', 10);
    this.rconPassword = options.rconPassword || this.adminPassword;

    this.docker = new DockerClient();
    this.rcon = new RconClient({
      host: this.rconHost,
      port: this.rconPort,
      password: this.rconPassword
    });

    this.status = 'starting'; // 'stopped', 'installing', 'starting', 'online', 'stopping'
    this.process = null;
    this.pid = null;
    this.startTime = Date.now();
    this.onlinePlayers = new Set();
    this.logHistory = [];
    this.maxLogHistory = 2500;
    this.subscribers = new Set();

    this.init();
  }

  init() {
    // 1. If running with Docker socket, stream container logs
    if (this.docker.hasSocket) {
      console.log(`[Supervisor] Connecting to Docker socket for container: ${this.containerName}...`);
      this.docker.streamLogs(this.containerName, (line) => {
        this.addLog(line, 'server');
      });
    }

    // 2. Setup RCON listeners (silently retry in background without spamming logs)
    let hadAuth = false;
    this.rcon.on('authenticated', () => {
      hadAuth = true;
      this.status = 'online';
      this.broadcast({ type: 'status', status: this.status });
      this.addLog('[RCON] Interactive console authenticated. Ready for commands.', 'supervisor');
      this.pollPlayers();
    });

    this.rcon.on('disconnect', () => {
      if (hadAuth) {
        this.addLog('[RCON] Interactive console disconnected. Reconnecting in background...', 'supervisor');
        hadAuth = false;
      }
    });

    this.rcon.on('error', () => {
      // Silently ignore connection errors during boot/retry
    });

    // Ensure server.ini has RCON configured
    this.ensureRconConfig();
    setInterval(() => this.ensureRconConfig(), 30000);

    // Start RCON client connection attempts
    this.rcon.connect();

    // Regular polling for players when online
    setInterval(() => {
      if (this.rcon.authenticated) {
        this.pollPlayers();
      }
    }, 15000);
  }

  ensureRconConfig() {
    try {
      const serverIniPath = path.join(this.dataDir, 'Zomboid', 'Server', `${this.serverName}.ini`);
      if (fs.existsSync(serverIniPath)) {
        let content = fs.readFileSync(serverIniPath, 'utf8');
        let updated = false;

        const passMatch = content.match(/^RCONPassword=(.*)$/m);
        if (!passMatch || !passMatch[1] || passMatch[1].trim() === '') {
          if (passMatch) {
            content = content.replace(/^RCONPassword=.*$/m, `RCONPassword=${this.rconPassword}`);
          } else {
            content += `\nRCONPassword=${this.rconPassword}\n`;
          }
          updated = true;
        }

        if (updated) {
          fs.writeFileSync(serverIniPath, content, 'utf8');
          console.log(`[Supervisor] Configured RCONPassword in ${serverIniPath}`);
        }
      }
    } catch (e) {}
  }


  async pollPlayers() {
    try {
      const resp = await this.rcon.send('players');
      // Parse output: "Players connected (1): \n - PlayerName"
      const names = [];
      const lines = resp.split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/^-\s*([a-zA-Z0-9_-]+)/);
        if (m) names.push(m[1]);
      }

      this.onlinePlayers = new Set(names);
      this.broadcast({
        type: 'players',
        onlinePlayers: names
      });
    } catch (e) {}
  }

  subscribe(ws) {
    this.subscribers.add(ws);
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

  async sendCommand(command) {
    const cmd = command.trim();
    if (!cmd) return { success: false, message: 'Empty command' };

    this.addLog(`> ${cmd}`, 'input');

    // 1. Priority: RCON
    if (this.rcon) {
      try {
        const reply = await this.rcon.send(cmd);
        if (reply && reply.trim()) {
          this.addLog(reply.trim(), 'server');
        }
        return { success: true, reply };
      } catch (err) {
        this.addLog(`[Console] ${err.message}`, 'supervisor');
        return { success: false, error: err.message };
      }
    }

    // 2. Fallback: Local spawned process
    if (this.process && this.process.stdin && this.process.stdin.writable) {
      this.process.stdin.write(cmd + '\n');
      return { success: true };
    }

    this.addLog('[Supervisor] Console is not ready yet.', 'supervisor');
    return { success: false, message: 'Console is not connected yet.' };
  }


  async startServer() {
    if (this.docker.hasSocket) {
      try {
        this.status = 'starting';
        this.broadcast({ type: 'status', status: this.status });
        this.addLog(`[Supervisor] Starting container ${this.containerName}...`, 'supervisor');
        await this.docker.start(this.containerName);
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    return { success: true };
  }

  async stopServer() {
    this.status = 'stopping';
    this.broadcast({ type: 'status', status: this.status });
    this.addLog('[Supervisor] Stopping server gracefully (sending "save" then "quit")...', 'supervisor');

    if (this.rcon && this.rcon.authenticated) {
      try {
        await this.rcon.send('save');
        setTimeout(() => this.rcon.send('quit').catch(() => {}), 1500);
      } catch (e) {}
    }

    if (this.docker.hasSocket) {
      try {
        setTimeout(async () => {
          await this.docker.stop(this.containerName).catch(() => {});
          this.status = 'stopped';
          this.broadcast({ type: 'status', status: this.status });
          this.addLog('[Supervisor] Container stopped.', 'supervisor');
        }, 3000);
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    this.status = 'stopped';
    this.broadcast({ type: 'status', status: this.status });
    return { success: true };
  }

  async restartServer() {
    this.addLog('[Supervisor] Restarting server container...', 'supervisor');
    if (this.rcon && this.rcon.authenticated) {
      try {
        await this.rcon.send('save');
      } catch (e) {}
    }

    if (this.docker.hasSocket) {
      try {
        await this.docker.restart(this.containerName);
        this.status = 'starting';
        this.broadcast({ type: 'status', status: this.status });
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    return { success: true };
  }

  async runScript(scriptPath, args = []) {
    // Forwarded to docker exec or simulated
    this.addLog(`[Supervisor] Executing script: ${path.basename(scriptPath)}...`, 'supervisor');
    if (this.docker.hasSocket) {
      try {
        await this.docker.exec(this.containerName, [scriptPath, ...args]);
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: true };
  }

  async getStats() {
    let containerStats = null;
    if (this.docker.hasSocket) {
      containerStats = await this.docker.getStats(this.containerName);
    }

    const totalMem = containerStats?.totalMem || os.totalmem();
    const usedMem = containerStats?.usedMem || (os.totalmem() - os.freemem());
    const memPercent = containerStats?.memPercent || Math.round((usedMem / totalMem) * 100);

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
        freeMem: totalMem - usedMem,
        memPercent,
        cpuCount: os.cpus().length,
        cpuPercent: containerStats?.cpuPercent || 0,
        loadAvg: os.loadavg()
      }
    };
  }
}

module.exports = PZManager;
