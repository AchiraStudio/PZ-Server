const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { spawn } = require('child_process');

class BackupManager {
  constructor(dataDir, serverName) {
    this.dataDir = path.resolve(dataDir);
    this.serverName = serverName;
    this.backupDir = path.join(this.dataDir, 'backups');
    const upperSaves = path.join(this.dataDir, 'Zomboid', 'Saves', 'Multiplayer');
    const lowerSaves = path.join(this.dataDir, 'Zomboid', 'saves', 'Multiplayer');
    this.savesDir = fs.existsSync(upperSaves) ? upperSaves : (fs.existsSync(lowerSaves) ? lowerSaves : upperSaves);
  }

  getActualSavesDir() {
    const upperSaves = path.join(this.dataDir, 'Zomboid', 'Saves', 'Multiplayer');
    const lowerSaves = path.join(this.dataDir, 'Zomboid', 'saves', 'Multiplayer');
    return fs.existsSync(upperSaves) ? upperSaves : (fs.existsSync(lowerSaves) ? lowerSaves : upperSaves);
  }

  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  getWorldPath(name = this.serverName) {
    return path.join(this.getActualSavesDir(), name);
  }

  async pruneBackups(maxKeep = 5) {
    const backups = await this.listBackups();
    if (backups.length > maxKeep) {
      const toRemove = backups.slice(maxKeep);
      for (const b of toRemove) {
        try {
          if (fs.existsSync(b.path)) {
            await fs.promises.unlink(b.path);
          }
        } catch (e) {}
      }
    }
  }

  async listWorlds() {
    if (!fs.existsSync(this.savesDir)) {
      return [];
    }
    const entries = await fs.promises.readdir(this.savesDir, { withFileTypes: true });
    const worlds = [];
    for (const ent of entries) {
      if (ent.isDirectory()) {
        const worldPath = path.join(this.savesDir, ent.name);
        const stat = await fs.promises.stat(worldPath);
        worlds.push({
          name: ent.name,
          isCurrent: ent.name === this.serverName,
          lastModified: stat.mtime
        });
      }
    }
    return worlds;
  }

  async listBackups() {
    this.ensureBackupDir();
    const files = await fs.promises.readdir(this.backupDir);
    const backups = [];

    for (const file of files) {
      if (file.endsWith('.tar.gz') || file.endsWith('.zip')) {
        const fullPath = path.join(this.backupDir, file);
        const stat = await fs.promises.stat(fullPath);
        backups.push({
          filename: file,
          size: stat.size,
          createdAt: stat.birthtime || stat.mtime,
          path: fullPath
        });
      }
    }

    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return backups;
  }

  async createBackup(worldName = this.serverName) {
    this.ensureBackupDir();
    const targetWorldDir = this.getWorldPath(worldName);

    if (!fs.existsSync(targetWorldDir)) {
      throw new Error(`World save "${worldName}" does not exist at ${targetWorldDir}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-${worldName}-${timestamp}.tar.gz`;
    const outputPath = path.join(this.backupDir, backupFileName);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('tar', {
        gzip: true,
        gzipOptions: { level: 6 }
      });

      output.on('close', () => {
        resolve({
          filename: backupFileName,
          size: archive.pointer(),
          path: outputPath
        });
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.directory(targetWorldDir, worldName);
      archive.finalize();
    });
  }

  async deleteBackup(filename) {
    this.ensureBackupDir();
    // Prevent directory traversal
    const safeFile = path.basename(filename);
    const target = path.join(this.backupDir, safeFile);
    if (!fs.existsSync(target)) {
      throw new Error('Backup file not found');
    }
    await fs.promises.unlink(target);
    return { success: true };
  }

  async wipeWorld(worldName = this.serverName) {
    const targetWorldDir = this.getWorldPath(worldName);
    if (fs.existsSync(targetWorldDir)) {
      await fs.promises.rm(targetWorldDir, { recursive: true, force: true });
    }
    return { success: true };
  }
}

module.exports = BackupManager;
