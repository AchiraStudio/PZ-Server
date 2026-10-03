/**
 * Worlds & Save Backups Controller
 */

const WorldsController = {
  worlds: [],
  backups: [],

  async load() {
    try {
      const res = await fetch('/api/worlds');
      const data = await res.json();
      this.worlds = data.worlds || [];
      this.backups = data.backups || [];

      this.render();
      this.setupListeners();
    } catch (err) {
      App.toast('Failed to load worlds: ' + err.message, 'error');
    }
  },

  setupListeners() {
    const btnCreate = document.getElementById('btnCreateBackupTab');
    btnCreate.onclick = () => this.createBackup();

    const btnWipe = document.getElementById('btnWipeWorld');
    btnWipe.onclick = () => this.wipeWorld();
  },

  render() {
    // Render Worlds
    const worldsContainer = document.getElementById('worldsListContainer');
    worldsContainer.innerHTML = '';

    if (this.worlds.length === 0) {
      worldsContainer.innerHTML = '<p class="text-muted">No world saves generated yet. Launch the server to generate a world.</p>';
    } else {
      for (const w of this.worlds) {
        const card = document.createElement('div');
        card.className = 'setting-card';
        card.innerHTML = `
          <div class="setting-header">
            <span class="setting-label font-mono">🗺️ ${w.name}</span>
            ${w.isCurrent ? '<span class="status-dot online" title="Active Server World"></span>' : ''}
          </div>
          <div class="setting-desc">Last Modified: ${new Date(w.lastModified).toLocaleString()}</div>
          <div class="modal-footer" style="margin-top: 12px;">
            <button class="btn btn-outline btn-xs" onclick="WorldsController.createBackup('${w.name}')">Backup World</button>
          </div>
        `;
        worldsContainer.appendChild(card);
      }
    }

    // Render Backups
    const tbody = document.getElementById('backupsTableBody');
    tbody.innerHTML = '';

    if (this.backups.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No archives found. Click "Create New World Backup" to create one.</td></tr>';
      return;
    }

    for (const b of this.backups) {
      const tr = document.createElement('tr');
      const sizeMb = (b.size / (1024 * 1024)).toFixed(2);
      tr.innerHTML = `
        <td class="font-mono font-bold">${b.filename}</td>
        <td class="font-mono">${sizeMb} MB</td>
        <td>${new Date(b.createdAt).toLocaleString()}</td>
        <td>
          <a href="/api/files/download?path=backups/${b.filename}" class="btn btn-outline btn-xs">Download</a>
          <button class="btn btn-outline-danger btn-xs" onclick="WorldsController.deleteBackup('${b.filename}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  },

  async createBackup(worldName) {
    try {
      App.toast('Compressing world save into tar.gz archive...', 'info');
      const res = await fetch('/api/worlds/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worldName })
      });
      const data = await res.json();
      if (data.error) {
        App.toast('Backup failed: ' + data.error, 'error');
      } else {
        App.toast(`Backup created: ${data.filename}`, 'success');
        this.load();
      }
    } catch (e) {
      App.toast('Backup error: ' + e.message, 'error');
    }
  },

  async deleteBackup(filename) {
    if (!confirm(`Delete archive "${filename}"? This cannot be undone.`)) return;

    try {
      await fetch(`/api/worlds/backup/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      App.toast('Backup deleted', 'info');
      this.load();
    } catch (e) {
      App.toast('Delete failed: ' + e.message, 'error');
    }
  },

  async wipeWorld() {
    if (App.currentStatus === 'online' || App.currentStatus === 'starting') {
      alert('Please stop the server before wiping the world save.');
      return;
    }

    const conf = prompt('DANGER: To confirm wiping all multiplayer map progress and structures, type "WIPE":');
    if (conf !== 'WIPE') {
      App.toast('Wipe cancelled', 'info');
      return;
    }

    try {
      await fetch('/api/worlds/wipe', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      App.toast('World save has been wiped. A fresh world will generate next startup.', 'success');
      this.load();
    } catch (e) {
      App.toast('Wipe failed: ' + e.message, 'error');
    }
  }
};

window.WorldsController = WorldsController;
