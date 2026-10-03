/**
 * Sandbox Settings Visual Editor Controller
 */

const SandboxController = {
  data: {},
  schema: {},
  rawLua: '',
  activeCategory: 'all',
  searchQuery: '',
  isRawMode: false,

  async load() {
    try {
      const res = await fetch('/api/config/sandbox');
      const json = await res.json();
      this.data = json.data || {};
      this.schema = json.schema || {};
      this.rawLua = json.raw || '';

      document.getElementById('sandboxRawTextarea').value = this.rawLua;
      this.render();
      this.setupListeners();
    } catch (err) {
      App.toast('Failed to load sandbox settings: ' + err.message, 'error');
    }
  },

  setupListeners() {
    // Category pills
    const pills = document.querySelectorAll('#sandboxCategories .cat-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeCategory = pill.getAttribute('data-cat');
        this.render();
      });
    });

    // Search
    const searchInput = document.getElementById('sandboxSearch');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.render();
    });

    // Preset selector
    const presetSelect = document.getElementById('sandboxPresetSelect');
    presetSelect.addEventListener('change', async (e) => {
      const presetKey = e.target.value;
      if (!presetKey) return;
      try {
        const res = await fetch('/api/config/presets');
        const presets = await res.json();
        const selected = presets[presetKey];
        if (selected && selected.data) {
          this.applyPreset(selected.data);
          App.toast(`Loaded preset: ${selected.name}`, 'info');
        }
      } catch (err) {
        App.toast('Failed to load presets: ' + err.message, 'error');
      }
    });

    // Toggle Raw
    const btnToggleRaw = document.getElementById('btnToggleRawSandbox');
    btnToggleRaw.addEventListener('click', () => {
      this.isRawMode = !this.isRawMode;
      const rawContainer = document.getElementById('sandboxRawContainer');
      const formContainer = document.getElementById('sandboxFormContainer');
      const filterBar = document.querySelector('.filter-bar');

      if (this.isRawMode) {
        rawContainer.classList.remove('hidden');
        formContainer.classList.add('hidden');
        filterBar.classList.add('hidden');
        btnToggleRaw.textContent = 'Toggle Visual GUI';
      } else {
        rawContainer.classList.add('hidden');
        formContainer.classList.remove('hidden');
        filterBar.classList.remove('hidden');
        btnToggleRaw.textContent = 'Toggle Raw Lua';
      }
    });

    // Save
    const btnSave = document.getElementById('btnSaveSandbox');
    btnSave.addEventListener('click', () => this.save());
  },

  applyPreset(presetData) {
    // Deep merge preset values into this.data
    const merge = (target, src) => {
      for (const k in src) {
        if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k])) {
          if (!target[k]) target[k] = {};
          merge(target[k], src[k]);
        } else {
          target[k] = src[k];
        }
      }
    };
    merge(this.data, presetData);
    this.render();
  },

  getValueByPath(obj, path) {
    const parts = path.split('.');
    let curr = obj;
    for (const p of parts) {
      if (curr === undefined || curr === null) return undefined;
      curr = curr[p];
    }
    return curr;
  },

  setValueByPath(obj, path, val) {
    const parts = path.split('.');
    let curr = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!curr[p] || typeof curr[p] !== 'object') {
        curr[p] = {};
      }
      curr = curr[p];
    }
    curr[parts[parts.length - 1]] = val;
  },

  render() {
    const container = document.getElementById('sandboxFormContainer');
    container.innerHTML = '';

    const keys = Object.keys(this.schema);

    for (const key of keys) {
      const def = this.schema[key];

      // Category filter
      if (this.activeCategory !== 'all' && def.category !== this.activeCategory) {
        continue;
      }

      // Search query filter
      if (this.searchQuery) {
        const match = def.label.toLowerCase().includes(this.searchQuery) ||
                      key.toLowerCase().includes(this.searchQuery) ||
                      (def.description && def.description.toLowerCase().includes(this.searchQuery));
        if (!match) continue;
      }

      const val = this.getValueByPath(this.data, key);
      const card = this.createSettingCard(key, def, val);
      container.appendChild(card);
    }
  },

  createSettingCard(key, def, val) {
    const card = document.createElement('div');
    card.className = 'setting-card';

    const header = document.createElement('div');
    header.className = 'setting-header';
    header.innerHTML = `
      <span class="setting-label">${def.label}</span>
      <span class="setting-category-tag">${def.category}</span>
    `;

    const desc = document.createElement('div');
    desc.className = 'setting-desc';
    desc.textContent = def.description || '';

    const inputWrap = document.createElement('div');
    inputWrap.className = 'form-group mt-2';

    if (def.type === 'select') {
      const select = document.createElement('select');
      select.className = 'form-select';
      for (const opt of def.options) {
        const optionEl = document.createElement('option');
        optionEl.value = opt.value;
        optionEl.textContent = opt.label;
        if (Number(val) === Number(opt.value)) {
          optionEl.selected = true;
        }
        select.appendChild(optionEl);
      }

      select.addEventListener('change', (e) => {
        this.setValueByPath(this.data, key, Number(e.target.value));
      });
      inputWrap.appendChild(select);
    } else if (def.type === 'number') {
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'form-input';
      input.step = def.step || '1';
      input.min = def.min !== undefined ? def.min : '';
      input.max = def.max !== undefined ? def.max : '';
      input.value = val !== undefined ? val : 1;

      input.addEventListener('input', (e) => {
        const num = parseFloat(e.target.value);
        this.setValueByPath(this.data, key, isNaN(num) ? 0 : num);
      });
      inputWrap.appendChild(input);
    }

    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(inputWrap);
    return card;
  },

  async save() {
    try {
      let payload = {};
      if (this.isRawMode) {
        const raw = document.getElementById('sandboxRawTextarea').value;
        payload = { raw };
      } else {
        payload = { data: this.data };
      }

      const res = await fetch('/api/config/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        App.toast('Sandbox settings saved successfully! (Changes apply on server restart)', 'success');
      } else {
        App.toast('Save failed: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      App.toast('Failed to save sandbox settings: ' + err.message, 'error');
    }
  }
};

window.SandboxController = SandboxController;
