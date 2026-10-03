/**
 * Players, Whitelist & Bans Controller
 */

const PlayersController = {
  onlinePlayers: [],
  whitelist: [],
  bans: [],

  async load() {
    try {
      const res = await fetch('/api/players');
      const data = await res.json();
      this.onlinePlayers = data.onlinePlayers || [];
      this.whitelist = data.whitelist || [];
      this.bans = data.bans || [];

      this.render();
      this.setupListeners();
    } catch (err) {
      App.toast('Failed to load players: ' + err.message, 'error');
    }
  },

  setupListeners() {
    document.getElementById('btnRefreshPlayers').onclick = () => this.load();

    const searchInput = document.getElementById('whitelistSearch');
    searchInput.oninput = (e) => {
      const q = e.target.value.toLowerCase();
      this.renderWhitelist(q);
    };
  },

  render() {
    this.renderOnline(this.onlinePlayers);
    this.renderWhitelist();
    this.renderBans();
  },

  renderOnline(players) {
    this.onlinePlayers = players || [];
    const container = document.getElementById('onlinePlayersContainer');

    if (this.onlinePlayers.length === 0) {
      container.innerHTML = '<p class="text-muted">No players currently connected to the server.</p>';
      return;
    }

    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'settings-grid';

    for (const username of this.onlinePlayers) {
      const card = document.createElement('div');
      card.className = 'setting-card';
      card.innerHTML = `
        <div class="setting-header">
          <span class="setting-label font-mono">👤 ${username}</span>
          <span class="status-dot online"></span>
        </div>
        <div class="setting-desc">Status: Connected</div>
        <div class="modal-footer" style="margin-top: 10px;">
          <button class="btn btn-warning btn-xs" onclick="PlayersController.kickPlayer('${username}')">Kick</button>
          <button class="btn btn-danger btn-xs" onclick="PlayersController.banPlayer('${username}')">Ban</button>
        </div>
      `;
      grid.appendChild(card);
    }
    container.appendChild(grid);
  },

  renderWhitelist(searchQuery = '') {
    const tbody = document.getElementById('whitelistTableBody');
    tbody.innerHTML = '';

    const filtered = searchQuery
      ? this.whitelist.filter(u => u.username.toLowerCase().includes(searchQuery))
      : this.whitelist;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No registered accounts found in database.</td></tr>`;
      return;
    }

    const roles = ['admin', 'moderator', 'gm', 'overseer', 'observer', 'none'];

    for (const user of filtered) {
      const tr = document.createElement('tr');
      const isBanned = user.isBanned === 1 || user.isBanned === true;

      tr.innerHTML = `
        <td class="font-mono font-bold">${user.username}</td>
        <td>
          <select class="form-select-sm" onchange="PlayersController.changeRole('${user.username}', this.value)">
            ${roles.map(r => `<option value="${r}" ${user.accesslevel === r ? 'selected' : ''}>${r.toUpperCase()}</option>`).join('')}
          </select>
        </td>
        <td>
          ${isBanned ? '<span class="status-dot stopped"></span> Banned' : '<span class="status-dot online"></span> Active'}
        </td>
        <td>
          <button class="btn btn-outline-danger btn-xs" onclick="PlayersController.deleteUser('${user.username}')">Remove</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  },

  renderBans() {
    const tbody = document.getElementById('bansTableBody');
    tbody.innerHTML = '';

    if (this.bans.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No active bans in database.</td></tr>`;
      return;
    }

    for (const b of this.bans) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-mono font-bold">${b.username || '--'}</td>
        <td class="font-mono text-muted">${b.ip || '--'}</td>
        <td class="font-mono text-muted">${b.steamid || '--'}</td>
        <td>${b.reason || 'No reason specified'}</td>
        <td>
          <button class="btn btn-success btn-xs" onclick="PlayersController.unban('${b.username}')">Unban</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  },

  async kickPlayer(username) {
    const reason = prompt(`Reason for kicking "${username}" (optional):`);
    if (reason === null) return;

    try {
      await fetch('/api/players/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, reason })
      });
      App.toast(`Kicked "${username}"`, 'info');
    } catch (e) {
      App.toast('Kick failed: ' + e.message, 'error');
    }
  },

  async banPlayer(username) {
    const reason = prompt(`Reason for banning "${username}":`);
    if (!reason) return;

    try {
      await fetch('/api/players/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, reason, banIp: true })
      });
      App.toast(`Banned "${username}"`, 'info');
      this.load();
    } catch (e) {
      App.toast('Ban failed: ' + e.message, 'error');
    }
  },

  async unban(username) {
    try {
      await fetch('/api/players/unban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      App.toast(`Unbanned "${username}"`, 'success');
      this.load();
    } catch (e) {
      App.toast('Unban failed: ' + e.message, 'error');
    }
  },

  async changeRole(username, accesslevel) {
    try {
      await fetch('/api/players/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, accesslevel })
      });
      App.toast(`Role for "${username}" set to ${accesslevel.toUpperCase()}`, 'success');
    } catch (e) {
      App.toast('Failed to change role: ' + e.message, 'error');
    }
  },

  async deleteUser(username) {
    if (!confirm(`Are you sure you want to remove "${username}" from the whitelist?`)) return;

    try {
      await fetch(`/api/players/${encodeURIComponent(username)}`, { method: 'DELETE' });
      App.toast(`Removed "${username}"`, 'info');
      this.load();
    } catch (e) {
      App.toast('Failed to delete user: ' + e.message, 'error');
    }
  }
};

window.PlayersController = PlayersController;
