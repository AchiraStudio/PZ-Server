const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class DbManager {
  constructor(dataDir, serverName) {
    this.dataDir = dataDir;
    this.serverName = serverName;
  }

  getDbPath() {
    return path.join(this.dataDir, 'Zomboid', 'db', `${this.serverName}.db`);
  }

  getDb() {
    const dbPath = this.getDbPath();
    if (!fs.existsSync(dbPath)) {
      return null;
    }
    return new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE);
  }

  async getAllUsers() {
    const db = this.getDb();
    if (!db) return [];

    return new Promise((resolve, reject) => {
      db.all("SELECT name as username, accesslevel, isBanned FROM whitelist ORDER BY name ASC", [], (err, rows) => {
        db.close();
        if (err) {
          // Table might not exist yet if fresh server
          if (err.message.includes('no such table')) return resolve([]);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  async getAllBans() {
    const db = this.getDb();
    if (!db) return [];

    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM bans ORDER BY username ASC", [], (err, rows) => {
        db.close();
        if (err) {
          if (err.message.includes('no such table')) return resolve([]);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  async updateUserRole(username, accesslevel) {
    const db = this.getDb();
    if (!db) throw new Error('Database file does not exist yet. Start the server once to initialize.');

    return new Promise((resolve, reject) => {
      db.run("UPDATE whitelist SET accesslevel = ? WHERE name = ?", [accesslevel, username], function (err) {
        db.close();
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  }

  async removeUser(username) {
    const db = this.getDb();
    if (!db) throw new Error('Database file does not exist yet.');

    return new Promise((resolve, reject) => {
      db.run("DELETE FROM whitelist WHERE name = ?", [username], function (err) {
        db.close();
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  }

  async unbanUser(username) {
    const db = this.getDb();
    if (!db) throw new Error('Database file does not exist yet.');

    return new Promise((resolve, reject) => {
      db.run("DELETE FROM bans WHERE username = ?", [username], function (err) {
        if (err) {
          db.close();
          return reject(err);
        }
        // Also clear isBanned in whitelist if exists
        db.run("UPDATE whitelist SET isBanned = 0 WHERE name = ?", [username], (err2) => {
          db.close();
          if (err2) return reject(err2);
          resolve(true);
        });
      });
    });
  }
}

module.exports = DbManager;
