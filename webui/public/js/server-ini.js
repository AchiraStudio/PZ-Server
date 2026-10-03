/**
 * Server Configuration (server.ini) Controller
 */

const ServerIniController = {
  data: {},
  raw: '',
  isRawMode: false,

  async load() {
    try {
      const res = await fetch('/api/config/server-ini');
      const json = await res.json();
      this.data = json.data || {};
      this.raw = json.raw || '';

      document.getElementById('iniRawTextarea').value = this.raw;
      this.render();
      this.setupListeners();
    } catch (err) {
      App.toast('Failed to load server.ini: ' + err.message, 'error');
    }
  },

  setupListeners() {
    // Toggle Raw
    const btnToggle = document.getElementById('btnToggleRawIni');
    btnToggle.onclick = () => {
      this.isRawMode = !this.isRawMode;
      const rawContainer = document.getElementById('iniRawContainer');
      const formContainer = document.getElementById('iniFormContainer');

      if (this.isRawMode) {
        rawContainer.classList.remove('hidden');
        formContainer.classList.add('hidden');
        btnToggle.textContent = 'Toggle Visual GUI';
      } else {
        rawContainer.classList.add('hidden');
        formContainer.classList.remove('hidden');
        btnToggle.textContent = 'Toggle Raw INI';
      }
    };

    // Save
    const btnSave = document.getElementById('btnSaveServerIni');
    btnSave.onclick = () => this.save();
  },

  render() {
    const container = document.getElementById('iniFormContainer');
    container.innerHTML = '';

    const priorityFields = [
      { key: 'PublicName', label: 'Public Server Name', type: 'text', desc: 'Display name in server browser' },
      { key: 'PublicDescription', label: 'Server Description', type: 'text', desc: 'Summary shown in server list' },
      { key: 'ServerWelcomeMessage', label: 'Welcome Message', type: 'text', desc: 'Message greeted upon joining' },
      { key: 'MaxPlayers', label: 'Max Players', type: 'number', min: 1, max: 128, desc: 'Maximum concurrent players' },
      { key: 'Public', label: 'Show in Public Browser', type: 'boolean', desc: 'Advertise in in-game server list' },
      { key: 'Open', label: 'Open Registration', type: 'boolean', desc: 'Allow any player to join without whitelist' },
      { key: 'PauseEmpty', label: 'Pause When Empty', type: 'boolean', desc: 'Pauses time and decay if 0 players' },
      { key: 'PVP', label: 'Enable PvP', type: 'boolean', desc: 'Allow player vs player combat' },
      { key: 'GlobalChat', label: 'Global Chat', type: 'boolean', desc: 'Allow cross-map global chatting' },
      { key: 'SleepAllowed', label: 'Allow Sleep', type: 'boolean', desc: 'Enables sleep mechanics in multiplayer' },
      { key: 'PingLimit', label: 'Ping Limit (ms)', type: 'number', min: 100, max: 2000, desc: 'Max ping before disconnect' },
      { key: 'SteamVAC', label: 'Steam VAC Anti-Cheat', type: 'boolean', desc: 'Enables Valve Anti-Cheat protection' }
    ];

    for (const f of priorityFields) {
      const val = this.data[f.key] !== undefined ? this.data[f.key] : '';
      const card = document.createElement('div');
      card.className = 'setting-card';

      const header = document.createElement('div');
      header.className = 'setting-header';
      header.innerHTML = `
        <span class="setting-label">${f.label}</span>
        <span class="setting-category-tag font-mono">${f.key}</span>
      `;

      const desc = document.createElement('div');
      desc.className = 'setting-desc';
      desc.textContent = f.desc;

      const inputWrap = document.createElement('div');
      inputWrap.className = 'form-group mt-2';

      if (f.type === 'boolean') {
        const select = document.createElement('select');
        select.className = 'form-select';
        select.innerHTML = `
          <option value="true" ${val === 'true' || val === true ? 'selected' : ''}>Enabled (true)</option>
          <option value="false" ${val === 'false' || val === false ? 'selected' : ''}>Disabled (false)</option>
        `;
        select.onchange = (e) => {
          this.data[f.key] = e.target.value;
        };
        inputWrap.appendChild(select);
      } else if (f.type === 'number') {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'form-input';
        input.value = val;
        input.oninput = (e) => {
          this.data[f.key] = e.target.value;
        };
        inputWrap.appendChild(input);
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-input';
        input.value = val;
        input.oninput = (e) => {
          this.data[f.key] = e.target.value;
        };
        inputWrap.appendChild(input);
      }

      card.appendChild(header);
      card.appendChild(desc);
      card.appendChild(inputWrap);
      container.appendChild(card);
    }
  },

  async save() {
    try {
      let payload = {};
      if (this.isRawMode) {
        payload = { raw: document.getElementById('iniRawTextarea').value };
      } else {
        payload = { data: this.data };
      }

      const res = await fetch('/api/config/server-ini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        App.toast('server.ini configuration saved!', 'success');
      } else {
        App.toast('Save failed: ' + result.error, 'error');
      }
    } catch (err) {
      App.toast('Failed to save server.ini: ' + err.message, 'error');
    }
  }
};

window.ServerIniController = ServerIniController;
