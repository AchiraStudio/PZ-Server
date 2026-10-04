const fs = require('fs');
const path = require('path');

class FileManager {
  constructor(baseDir) {
    this.baseDir = path.resolve(baseDir);
  }

  // Security: Prevent directory traversal outside baseDir
  resolveSafePath(userPath = '') {
    // Normalize path separators and remove any leading / or \
    let clean = (userPath || '').toString().trim().replace(/\\/g, '/');
    // Strip leading slashes so path.resolve doesn't jump to filesystem root
    clean = clean.replace(/^\/+/, '');
    const safePath = path.resolve(this.baseDir, clean);
    if (safePath !== this.baseDir && !safePath.startsWith(this.baseDir + path.sep)) {
      throw new Error('Access denied: path outside data directory');
    }
    return safePath;
  }

  getRelativePath(fullPath) {
    const rel = path.relative(this.baseDir, fullPath).replace(/\\/g, '/');
    return (!rel || rel === '.') ? '/' : `/${rel}`;
  }


  async list(userPath = '') {
    const targetDir = this.resolveSafePath(userPath);
    if (!fs.existsSync(targetDir)) {
      return { currentPath: this.getRelativePath(targetDir), items: [] };
    }

    const stat = await fs.promises.stat(targetDir);
    if (!stat.isDirectory()) {
      throw new Error('Path is not a directory');
    }

    const entries = await fs.promises.readdir(targetDir, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      const entryPath = path.join(targetDir, entry.name);
      try {
        const itemStat = await fs.promises.stat(entryPath);
        items.push({
          name: entry.name,
          path: this.getRelativePath(entryPath),
          isDir: entry.isDirectory(),
          size: itemStat.size,
          mtime: itemStat.mtime
        });
      } catch (e) {
        // Skip inaccessible entries
      }
    }

    // Sort: directories first, then alphabetically
    items.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });

    return {
      currentPath: this.getRelativePath(targetDir),
      items
    };
  }

  async readFile(userPath) {
    const targetPath = this.resolveSafePath(userPath);
    if (!fs.existsSync(targetPath)) {
      throw new Error('File not found');
    }
    const stat = await fs.promises.stat(targetPath);
    if (stat.isDirectory()) {
      throw new Error('Cannot read directory as file');
    }
    // Limit text editor read size to 5MB
    if (stat.size > 5 * 1024 * 1024) {
      throw new Error('File too large to open in web editor (max 5MB)');
    }
    const content = await fs.promises.readFile(targetPath, 'utf8');
    return {
      name: path.basename(targetPath),
      path: this.getRelativePath(targetPath),
      size: stat.size,
      mtime: stat.mtime,
      content
    };
  }

  async writeFile(userPath, content) {
    const targetPath = this.resolveSafePath(userPath);
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      await fs.promises.mkdir(parentDir, { recursive: true });
    }
    await fs.promises.writeFile(targetPath, content, 'utf8');
    return { success: true, path: this.getRelativePath(targetPath) };
  }

  async createDir(userPath) {
    const targetPath = this.resolveSafePath(userPath);
    if (fs.existsSync(targetPath)) {
      throw new Error('Directory or file already exists');
    }
    await fs.promises.mkdir(targetPath, { recursive: true });
    return { success: true };
  }

  async createFile(userPath) {
    const targetPath = this.resolveSafePath(userPath);
    if (fs.existsSync(targetPath)) {
      throw new Error('File already exists');
    }
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      await fs.promises.mkdir(parentDir, { recursive: true });
    }
    await fs.promises.writeFile(targetPath, '', 'utf8');
    return { success: true, path: this.getRelativePath(targetPath) };
  }


  async delete(userPath) {
    const targetPath = this.resolveSafePath(userPath);
    if (targetPath === this.baseDir) {
      throw new Error('Cannot delete root directory');
    }
    if (!fs.existsSync(targetPath)) {
      throw new Error('Target does not exist');
    }
    const stat = await fs.promises.stat(targetPath);
    if (stat.isDirectory()) {
      await fs.promises.rm(targetPath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(targetPath);
    }
    return { success: true };
  }

  async rename(oldPath, newPath) {
    const src = this.resolveSafePath(oldPath);
    const dest = this.resolveSafePath(newPath);
    if (!fs.existsSync(src)) {
      throw new Error('Source file does not exist');
    }
    if (fs.existsSync(dest)) {
      throw new Error('Destination file already exists');
    }
    await fs.promises.rename(src, dest);
    return { success: true };
  }
}

module.exports = FileManager;
