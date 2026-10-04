const net = require('net');
const EventEmitter = require('events');

const PACKET_TYPE_RESPONSE = 0;
const PACKET_TYPE_EXECCOMMAND = 2;
const PACKET_TYPE_AUTH_RESPONSE = 2;
const PACKET_TYPE_AUTH = 3;

class RconClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.host = options.host || '127.0.0.1';
    this.port = parseInt(options.port || '27015', 10);
    this.password = options.password || '';
    this.timeout = options.timeout || 8000;

    this.socket = null;
    this.authenticated = false;
    this.connected = false;
    this.connecting = false;
    this.reqId = 1;
    this.pendingRequests = new Map();
    this.buffer = Buffer.alloc(0);
    this.reconnectTimer = null;
  }

  connect() {
    if (this.connected || this.connecting) return;
    this.connecting = true;

    this.socket = new net.Socket();
    this.socket.setKeepAlive(true, 15000);

    this.socket.on('connect', () => {
      this.connecting = false;
      this.connected = true;
      this.emit('connect');
      this._authenticate();
    });

    this.socket.on('data', (data) => {
      this._handleData(data);
    });

    this.socket.on('error', (err) => {
      this.emit('error', err);
    });

    this.socket.on('close', () => {
      this.connected = false;
      this.connecting = false;
      this.authenticated = false;
      this.emit('disconnect');
      this._rejectAllPending(new Error('RCON connection closed'));
      this._scheduleReconnect();
    });

    this.socket.connect(this.port, this.host);
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 5000);
  }

  _authenticate() {
    const id = this.reqId++;
    const packet = this._createPacket(id, PACKET_TYPE_AUTH, this.password);
    this.pendingRequests.set(id, {
      resolve: () => {
        this.authenticated = true;
        this.emit('authenticated');
      },
      reject: (err) => {
        this.emit('error', err);
      }
    });
    this.socket.write(packet);
  }

  send(command) {
    return new Promise((resolve, reject) => {
      // If not authenticated, attempt connect and wait briefly
      if (!this.connected || !this.authenticated) {
        if (!this.connecting) {
          this.connect();
        }
        const authTimer = setTimeout(() => {
          this.removeListener('authenticated', onAuth);
          reject(new Error('RCON not ready (server booting or starting)'));
        }, 5000);

        const onAuth = () => {
          clearTimeout(authTimer);
          this.send(command).then(resolve).catch(reject);
        };
        this.once('authenticated', onAuth);
        return;
      }

      const id = this.reqId++;
      const packet = this._createPacket(id, PACKET_TYPE_EXECCOMMAND, command);
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('RCON command timed out'));
      }, 10000);

      this.pendingRequests.set(id, {
        resolve: (resp) => {
          clearTimeout(timer);
          resolve(resp);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        }
      });

      try {
        this.socket.write(packet);
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }


  _createPacket(id, type, body) {
    const bodyBuffer = Buffer.from(body, 'utf8');
    const length = 4 + 4 + bodyBuffer.length + 2; // id (4) + type (4) + body + 2 null bytes
    const buffer = Buffer.alloc(4 + length);

    buffer.writeInt32LE(length, 0);
    buffer.writeInt32LE(id, 4);
    buffer.writeInt32LE(type, 8);
    bodyBuffer.copy(buffer, 12);
    buffer.writeInt8(0, 12 + bodyBuffer.length);
    buffer.writeInt8(0, 13 + bodyBuffer.length);

    return buffer;
  }

  _handleData(data) {
    this.buffer = Buffer.concat([this.buffer, data]);

    while (this.buffer.length >= 4) {
      const length = this.buffer.readInt32LE(0);
      if (this.buffer.length < 4 + length) {
        break; // Wait for full packet
      }

      const packetBuffer = this.buffer.slice(0, 4 + length);
      this.buffer = this.buffer.slice(4 + length);

      const id = packetBuffer.readInt32LE(4);
      const type = packetBuffer.readInt32LE(8);
      const body = packetBuffer.slice(12, packetBuffer.length - 2).toString('utf8');

      if (id === -1) {
        // Auth failed
        const req = Array.from(this.pendingRequests.values())[0];
        if (req) req.reject(new Error('RCON Authentication failed: Invalid password'));
        this.pendingRequests.clear();
        return;
      }

      const pending = this.pendingRequests.get(id);
      if (pending) {
        this.pendingRequests.delete(id);
        pending.resolve(body);
      } else {
        this.emit('message', body);
      }
    }
  }

  _rejectAllPending(err) {
    for (const [id, req] of this.pendingRequests.entries()) {
      req.reject(err);
    }
    this.pendingRequests.clear();
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    this.authenticated = false;
  }
}

module.exports = RconClient;
