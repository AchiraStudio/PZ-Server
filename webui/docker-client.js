const http = require('http');
const fs = require('fs');

class DockerClient {
  constructor(socketPath = '/var/run/docker.sock') {
    this.socketPath = socketPath;
    this.hasSocket = fs.existsSync(socketPath);
    this.logStreamReq = null;
    this.shouldStream = true;
    this.logStreamTimer = null;
  }

  request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      if (!this.hasSocket) {
        return reject(new Error(`Docker socket not found at ${this.socketPath}`));
      }

      const options = {
        socketPath: this.socketPath,
        path,
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.message || `Docker API returned ${res.statusCode}`));
            }
          } catch (e) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`Docker API returned ${res.statusCode}: ${data}`));
            }
          }
        });
      });

      req.on('error', reject);
      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    });
  }

  stopLogStream() {
    this.shouldStream = false;
    if (this.logStreamTimer) {
      clearTimeout(this.logStreamTimer);
      this.logStreamTimer = null;
    }
    if (this.logStreamReq) {
      try {
        this.logStreamReq.destroy();
      } catch (e) {}
      this.logStreamReq = null;
    }
  }

  // Stream logs continuously from container
  streamLogs(containerName, onLine) {
    if (!this.hasSocket) return null;
    this.shouldStream = true;

    const path = `/containers/${containerName}/logs?follow=1&stdout=1&stderr=1&tail=150&timestamps=0`;
    const options = {
      socketPath: this.socketPath,
      path,
      method: 'GET'
    };

    let remainder = '';

    const req = http.request(options, (res) => {
      res.on('data', (chunk) => {
        // Docker multiplexed stream header: 8 bytes per frame
        // [STREAM_TYPE (1 byte), 0, 0, 0, SIZE (4 bytes big-endian)]
        let text = '';
        let offset = 0;
        
        while (offset < chunk.length) {
          if (chunk.length - offset >= 8 && (chunk[offset] === 1 || chunk[offset] === 2)) {
            const frameSize = chunk.readUInt32BE(offset + 4);
            const framePayload = chunk.slice(offset + 8, offset + 8 + frameSize);
            text += framePayload.toString('utf8');
            offset += 8 + frameSize;
          } else {
            text += chunk.slice(offset).toString('utf8');
            break;
          }
        }

        const lines = (remainder + text).split(/\r?\n/);
        remainder = lines.pop(); // Keep last partial line

        for (const line of lines) {
          if (line.trim()) {
            onLine(line);
          }
        }
      });

      res.on('end', () => {
        if (this.shouldStream) {
          this.logStreamTimer = setTimeout(() => this.streamLogs(containerName, onLine), 5000);
        }
      });
    });

    req.on('error', (err) => {
      if (this.shouldStream) {
        this.logStreamTimer = setTimeout(() => this.streamLogs(containerName, onLine), 5000);
      }
    });

    this.logStreamReq = req;
    req.end();
    return req;
  }

  // Get container memory and CPU stats
  async getStats(containerName) {
    try {
      const data = await this.request('GET', `/containers/${containerName}/stats?stream=false`);
      const memoryStats = data.memory_stats || {};
      const cpuStats = data.cpu_stats || {};
      const precpuStats = data.precpu_stats || {};

      const usedMem = (memoryStats.usage || 0) - (memoryStats.stats?.cache || 0);
      const totalMem = memoryStats.limit || 0;

      // Calculate CPU percentage
      const cpuDelta = (cpuStats.cpu_usage?.total_usage || 0) - (precpuStats.cpu_usage?.total_usage || 0);
      const systemDelta = (cpuStats.system_cpu_usage || 0) - (precpuStats.system_cpu_usage || 0);
      const cpuCount = cpuStats.online_cpus || cpuStats.cpu_usage?.percpu_usage?.length || 1;

      let cpuPercent = 0;
      if (systemDelta > 0 && cpuDelta > 0) {
        cpuPercent = Math.round((cpuDelta / systemDelta) * cpuCount * 10000) / 100;
      }

      return {
        usedMem,
        totalMem,
        memPercent: totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0,
        cpuPercent
      };
    } catch (e) {
      return null;
    }
  }

  inspect(containerName) {
    return this.request('GET', `/containers/${containerName}/json`);
  }

  start(containerName) {
    return this.request('POST', `/containers/${containerName}/start`);
  }

  stop(containerName) {
    return this.request('POST', `/containers/${containerName}/stop?t=15`);
  }

  remove(containerName) {
    return this.request('DELETE', `/containers/${containerName}?force=true&v=false`);
  }

  restart(containerName) {
    return this.request('POST', `/containers/${containerName}/restart?t=15`);
  }

  async exec(containerName, cmdArray) {
    const create = await this.request('POST', `/containers/${containerName}/exec`, {
      AttachStdout: true,
      AttachStderr: true,
      Cmd: cmdArray
    });

    return this.request('POST', `/exec/${create.Id}/start`, {
      Detach: false,
      Tty: false
    });
  }
}

module.exports = DockerClient;
