/**
 * Steam Workshop & Mods Manager Controller
 * Supports Single Mod (with auto-detect), Steam Collections, and Bulk Text Import.
 */

const ModsController = {
  workshopItems: [],
  mods: [],
  installedMods: [],
  collectionItems: [],

  async load() {
    try {
      const res = await fetch('/api/mods');
      const data = await res.json();
      this.workshopItems = data.workshopItems || [];
      this.mods = data.mods || [];
      this.installedMods = data.installedMods || [];

      this.render();
      this.setupListeners();
    } catch (err) {
      App.toast('Failed to load mods: ' + err.message, 'error');
    }
  },

  setupListeners() {
    // Mode Switcher Tabs
    const tabBtns = document.querySelectorAll('.mod-tab-btn');
    tabBtns.forEach(btn => {
      btn.onclick = () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const targetTab = btn.getAttribute('data-modtab');
        document.querySelectorAll('.mod-tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById(`modtab-${targetTab}`)?.classList.remove('hidden');
      };
    });

    // 1. Auto-Detect Mod ID for Single Mod
    const btnAutoDetect = document.getElementById('btnAutoDetectMod');
    btnAutoDetect.onclick = async () => {
      const wsInput = document.getElementById('newWorkshopId');
      const statusEl = document.getElementById('singleModDetectStatus');
      const val = wsInput.value.trim();
      if (!val) {
        App.toast('Please enter a Workshop ID or URL first', 'error');
        return;
      }

      btnAutoDetect.disabled = true;
      btnAutoDetect.textContent = 'Detecting...';
      statusEl.classList.remove('hidden');
      statusEl.textContent = 'Contacting Steam Workshop...';

      try {
        const res = await fetch('/api/mods/fetch-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workshopId: val })
        });
        const details = await res.json();
        if (details.error) {
          statusEl.textContent = `Warning: ${details.error}`;
        } else {
          document.getElementById('newModId').value = details.primaryModId;
          statusEl.innerHTML = `Found: <strong>${details.title}</strong> (Mod ID: <code>${details.primaryModId}</code>)`;
          if (details.modIds.length > 1) {
            statusEl.innerHTML += `<br><span style="color:var(--color-yellow)">Note: Mod contains ${details.modIds.length} sub-mod IDs: ${details.modIds.join(', ')}</span>`;
          }
          App.toast(`Detected: ${details.title}`, 'info');
        }
      } catch (err) {
        statusEl.textContent = `Detection failed: ${err.message}`;
      } finally {
        btnAutoDetect.disabled = false;
        btnAutoDetect.textContent = '🔍 Auto-Detect';
      }
    };

    // Single Add Mod
    const btnAddMod = document.getElementById('btnAddMod');
    btnAddMod.onclick = () => {
      const wsInput = document.getElementById('newWorkshopId');
      const modInput = document.getElementById('newModId');

      let wsVal = wsInput.value.trim();
      let modVal = modInput.value.trim();

      const urlMatch = wsVal.match(/id=(\d+)/);
      if (urlMatch) wsVal = urlMatch[1];

      if (!wsVal && !modVal) {
        App.toast('Please provide at least a Workshop ID or Mod ID', 'error');
        return;
      }

      if (!wsVal) wsVal = modVal;
      if (!modVal) modVal = wsVal;

      if (!this.workshopItems.includes(wsVal)) this.workshopItems.push(wsVal);
      if (!this.mods.includes(modVal)) this.mods.push(modVal);

      wsInput.value = '';
      modInput.value = '';
      document.getElementById('singleModDetectStatus').classList.add('hidden');
      this.render();
      App.toast(`Added mod "${modVal}"`, 'success');
    };

    // 2. Steam Collection Importer
    const btnFetchCollection = document.getElementById('btnFetchCollection');
    btnFetchCollection.onclick = async () => {
      const input = document.getElementById('steamCollectionInput').value.trim();
      if (!input) {
        App.toast('Please enter a Steam Collection URL or ID', 'error');
        return;
      }

      const btnText = document.getElementById('btnFetchCollectionText');
      const spinner = document.getElementById('btnFetchCollectionSpinner');
      btnFetchCollection.disabled = true;
      btnText.textContent = 'Fetching Collection...';
      spinner.classList.remove('hidden');

      try {
        App.toast('Querying Steam Collection & retrieving mod descriptions...', 'info');
        const res = await fetch('/api/mods/fetch-collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collectionUrl: input })
        });
        const data = await res.json();

        if (data.error) {
          App.toast(`Collection error: ${data.error}`, 'error');
          return;
        }

        this.collectionItems = data.items || [];
        this.renderCollectionPreview(data);
        App.toast(`Loaded collection: ${data.title} (${this.collectionItems.length} items)`, 'success');
      } catch (err) {
        App.toast('Failed to fetch collection: ' + err.message, 'error');
      } finally {
        btnFetchCollection.disabled = false;
        btnText.textContent = 'Fetch Collection';
        spinner.classList.add('hidden');
      }
    };

    // Collection Select/Deselect All
    document.getElementById('btnCollectionSelectAll').onclick = () => {
      document.querySelectorAll('#collectionItemsBody .collection-check').forEach(c => c.checked = true);
      this.updateCollectionSelectedCount();
    };

    document.getElementById('btnCollectionDeselectAll').onclick = () => {
      document.querySelectorAll('#collectionItemsBody .collection-check').forEach(c => c.checked = false);
      this.updateCollectionSelectedCount();
    };

    document.getElementById('checkCollectionMaster').onchange = (e) => {
      document.querySelectorAll('#collectionItemsBody .collection-check').forEach(c => c.checked = e.target.checked);
      this.updateCollectionSelectedCount();
    };

    // Import Selected Collection Mods
    document.getElementById('btnImportCollectionMods').onclick = async () => {
      const checks = document.querySelectorAll('#collectionItemsBody .collection-check:checked');
      if (checks.length === 0) {
        App.toast('No mods selected to import', 'error');
        return;
      }

      const itemsToAdd = [];
      checks.forEach(chk => {
        const idx = parseInt(chk.getAttribute('data-idx'), 10);
        const item = this.collectionItems[idx];
        if (item) {
          const modInput = document.getElementById(`collModIdInput_${idx}`);
          const chosenModId = modInput ? modInput.value.trim() : item.primaryModId;
          itemsToAdd.push({
            workshopId: item.workshopId,
            modId: chosenModId || item.primaryModId
          });
        }
      });

      try {
        App.toast(`Importing ${itemsToAdd.length} mods to server.ini...`, 'info');
        const res = await fetch('/api/mods/bulk-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsToAdd })
        });
        const result = await res.json();
        if (result.success) {
          App.toast(`Successfully imported ${result.addedCount} new mods from collection!`, 'success');
          // Hide preview and refresh
          document.getElementById('collectionPreviewWrap').classList.add('hidden');
          document.getElementById('steamCollectionInput').value = '';
          this.load();
        } else {
          App.toast('Import failed: ' + result.error, 'error');
        }
      } catch (err) {
        App.toast('Import error: ' + err.message, 'error');
      }
    };

    // 3. Bulk Text Importer
    const btnProcessBulk = document.getElementById('btnProcessBulkPaste');
    btnProcessBulk.onclick = async () => {
      const text = document.getElementById('bulkPasteTextarea').value.trim();
      if (!text) {
        App.toast('Please paste your WorkshopItems/Mods text first', 'error');
        return;
      }

      const btnText = document.getElementById('btnProcessBulkText');
      const spinner = document.getElementById('btnProcessBulkSpinner');
      const statusEl = document.getElementById('bulkStatusMsg');

      btnProcessBulk.disabled = true;
      btnText.textContent = 'Processing...';
      spinner.classList.remove('hidden');
      statusEl.classList.remove('hidden');
      statusEl.textContent = 'Parsing and analyzing pasted content...';

      try {
        const res = await fetch('/api/mods/parse-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const parsed = await res.json();

        // Build list of items to add
        const itemsToAdd = [];
        const maxLen = Math.max(parsed.workshopIds.length, parsed.modIds.length, parsed.items.length);

        if (parsed.items && parsed.items.length > 0) {
          for (let i = 0; i < parsed.items.length; i++) {
            const item = parsed.items[i];
            const modId = parsed.modIds[i] || item.primaryModId || `Mod_${item.workshopId}`;
            itemsToAdd.push({
              workshopId: item.workshopId,
              modId: modId
            });
          }
        } else {
          for (let i = 0; i < maxLen; i++) {
            itemsToAdd.push({
              workshopId: parsed.workshopIds[i] || parsed.modIds[i],
              modId: parsed.modIds[i] || parsed.workshopIds[i]
            });
          }
        }

        if (itemsToAdd.length === 0) {
          statusEl.textContent = 'No valid Workshop IDs or Mod IDs detected in text.';
          return;
        }

        const addRes = await fetch('/api/mods/bulk-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsToAdd })
        });
        const addResult = await addRes.json();

        if (addResult.success) {
          statusEl.innerHTML = `<span style="color:var(--color-green)">Import complete! Added ${addResult.addedCount} new mods (Total: ${addResult.totalMods} mods).</span>`;
          App.toast(`Bulk import successful: +${addResult.addedCount} mods`, 'success');
          document.getElementById('bulkPasteTextarea').value = '';
          this.load();
        } else {
          statusEl.textContent = 'Import error: ' + addResult.error;
        }
      } catch (err) {
        statusEl.textContent = 'Bulk processing failed: ' + err.message;
      } finally {
        btnProcessBulk.disabled = false;
        btnText.textContent = 'Parse & Import Mods';
        spinner.classList.add('hidden');
      }
    };

    // Save Mods
    const btnSave = document.getElementById('btnSaveMods');
    btnSave.onclick = () => this.save();

    // Sync Mods
    const btnSync = document.getElementById('btnSyncModsTab');
    btnSync.onclick = async () => {
      try {
        App.toast('Starting SteamCMD workshop mod download...', 'info');
        const res = await fetch('/api/server/sync-mods', { method: 'POST' });
        const data = await res.json();
        if (data.error) App.toast(data.error, 'error');
      } catch (err) {
        App.toast('Sync failed: ' + err.message, 'error');
      }
    };
  },

  renderCollectionPreview(data) {
    const wrap = document.getElementById('collectionPreviewWrap');
    wrap.classList.remove('hidden');

    document.getElementById('collectionPreviewTitle').textContent = `📚 ${data.title}`;
    document.getElementById('collectionPreviewCount').textContent = `${data.items.length} workshop mods ready to import`;

    const tbody = document.getElementById('collectionItemsBody');
    tbody.innerHTML = '';

    data.items.forEach((item, idx) => {
      const tr = document.createElement('tr');
      const thumb = item.previewUrl
        ? `<img src="${item.previewUrl}" class="mod-thumb-img" alt="thumbnail">`
        : `<div class="mod-thumb-img flex items-center justify-center">📦</div>`;

      // Select or input for Mod ID if multiple detected
      let modIdInputHtml = '';
      if (item.modIds && item.modIds.length > 1) {
        modIdInputHtml = `
          <select id="collModIdInput_${idx}" class="form-select-sm font-mono">
            ${item.modIds.map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
        `;
      } else {
        modIdInputHtml = `
          <input type="text" id="collModIdInput_${idx}" class="form-input-sm font-mono" value="${item.primaryModId || ''}">
        `;
      }

      tr.innerHTML = `
        <td><input type="checkbox" class="collection-check" data-idx="${idx}" checked></td>
        <td>${thumb}</td>
        <td>
          <div class="font-bold">${item.title}</div>
          <a href="https://steamcommunity.com/sharedfiles/filedetails/?id=${item.workshopId}" target="_blank" class="text-dim font-mono" style="font-size:11px;">View on Steam ↗</a>
        </td>
        <td class="font-mono text-muted">${item.workshopId}</td>
        <td>${modIdInputHtml}</td>
      `;
      tbody.appendChild(tr);
    });

    // Add change listeners to checkboxes
    document.querySelectorAll('#collectionItemsBody .collection-check').forEach(chk => {
      chk.onchange = () => this.updateCollectionSelectedCount();
    });

    this.updateCollectionSelectedCount();
  },

  updateCollectionSelectedCount() {
    const total = document.querySelectorAll('#collectionItemsBody .collection-check').length;
    const checked = document.querySelectorAll('#collectionItemsBody .collection-check:checked').length;
    document.getElementById('collectionSelectedCount').textContent = checked;
    const master = document.getElementById('checkCollectionMaster');
    if (master) master.checked = checked === total && total > 0;
  },

  render() {
    const tbody = document.getElementById('modsTableBody');
    tbody.innerHTML = '';

    const maxLen = Math.max(this.mods.length, this.workshopItems.length);

    if (maxLen === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No mods added yet. Add a single mod, collection, or bulk paste above.</td></tr>`;
      return;
    }

    for (let i = 0; i < maxLen; i++) {
      const modId = this.mods[i] || '';
      const wsId = this.workshopItems[i] || '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-mono text-muted">${i + 1}</td>
        <td class="font-mono font-bold">${modId || '<span class="text-dim">--</span>'}</td>
        <td class="font-mono">${wsId || '<span class="text-dim">--</span>'}</td>
        <td>
          ${wsId ? `<a href="https://steamcommunity.com/sharedfiles/filedetails/?id=${wsId}" target="_blank" class="btn btn-outline btn-xs">Steam Page ↗</a>` : '<span class="text-dim">--</span>'}
        </td>
        <td><span class="status-dot online"></span> Enabled</td>
        <td>
          <button class="btn btn-outline btn-xs" onclick="ModsController.moveMod(${i}, -1)" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button class="btn btn-outline btn-xs" onclick="ModsController.moveMod(${i}, 1)" ${i === maxLen - 1 ? 'disabled' : ''}>▼</button>
          <button class="btn btn-outline-danger btn-xs" onclick="ModsController.deleteMod(${i})">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    // Render local mods
    const localContainer = document.getElementById('localModsList');
    localContainer.innerHTML = '';
    if (this.installedMods.length === 0) {
      localContainer.innerHTML = `<span class="text-muted">No local folders in /data/Zomboid/mods</span>`;
    } else {
      for (const name of this.installedMods) {
        const tag = document.createElement('span');
        tag.className = 'mod-tag';
        tag.textContent = name;
        tag.style.cursor = 'pointer';
        tag.title = 'Click to add to active mods';
        tag.onclick = () => {
          if (!this.mods.includes(name)) {
            this.mods.push(name);
            this.render();
            App.toast(`Added local mod "${name}" to load order`, 'info');
          }
        };
        localContainer.appendChild(tag);
      }
    }
  },

  moveMod(index, direction) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= Math.max(this.mods.length, this.workshopItems.length)) return;

    if (this.mods[index] && this.mods[targetIdx]) {
      const temp = this.mods[index];
      this.mods[index] = this.mods[targetIdx];
      this.mods[targetIdx] = temp;
    }
    if (this.workshopItems[index] && this.workshopItems[targetIdx]) {
      const temp = this.workshopItems[index];
      this.workshopItems[index] = this.workshopItems[targetIdx];
      this.workshopItems[targetIdx] = temp;
    }

    this.render();
  },

  deleteMod(index) {
    if (index < this.mods.length) this.mods.splice(index, 1);
    if (index < this.workshopItems.length) this.workshopItems.splice(index, 1);
    this.render();
    App.toast('Mod removed from config', 'info');
  },

  async save() {
    try {
      const res = await fetch('/api/mods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workshopItems: this.workshopItems,
          mods: this.mods
        })
      });
      const data = await res.json();
      if (data.success) {
        App.toast('Mod configuration saved to server.ini!', 'success');
      } else {
        App.toast('Save failed: ' + data.error, 'error');
      }
    } catch (err) {
      App.toast('Failed to save mods: ' + err.message, 'error');
    }
  }
};

window.ModsController = ModsController;
