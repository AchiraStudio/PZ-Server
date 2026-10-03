/**
 * File Explorer and Code Editor Controller
 */

const FilesController = {
  currentPath: '',
  currentOpenFile: null,
  isDirty: false,

  async load(path = '') {
    try {
      const res = await fetch(`/api/files/list?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      this.currentPath = data.currentPath || '/';
      this.renderBreadcrumbs(this.currentPath);
      this.renderList(data.items || []);
      this.setupListeners();
    } catch (err) {
      App.toast('Failed to load file list: ' + err.message, 'error');
    }
  },

  setupListeners() {
    // Refresh
    document.getElementById('btnRefreshFiles').onclick = () => this.load(this.currentPath);

    // New File
    document.getElementById('btnNewFile').onclick = async () => {
      const name = prompt('Enter new file name:');
      if (!name) return;
      const targetPath = `${this.currentPath}/${name}`.replace(/\/+/g, '/');
      try {
        await fetch('/api/files/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: targetPath, content: '' })
        });
        App.toast(`Created file "${name}"`, 'success');
        this.load(this.currentPath);
        this.openFile(targetPath);
      } catch (e) {
        App.toast('Failed to create file: ' + e.message, 'error');
      }
    };

    // New Folder
    document.getElementById('btnNewFolder').onclick = async () => {
      const name = prompt('Enter new folder name:');
      if (!name) return;
      const targetPath = `${this.currentPath}/${name}`.replace(/\/+/g, '/');
      try {
        await fetch('/api/files/mkdir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: targetPath })
        });
        App.toast(`Created folder "${name}"`, 'success');
        this.load(this.currentPath);
      } catch (e) {
        App.toast('Failed to create folder: ' + e.message, 'error');
      }
    };

    // Upload
    const uploadInput = document.getElementById('fileUploadInput');
    document.getElementById('btnUploadFile').onclick = () => uploadInput.click();

    uploadInput.onchange = async () => {
      if (!uploadInput.files || uploadInput.files.length === 0) return;
      const file = uploadInput.files[0];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetDir', this.currentPath);

      try {
        App.toast(`Uploading "${file.name}"...`, 'info');
        const res = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.success) {
          App.toast(`Uploaded "${file.name}" successfully`, 'success');
          this.load(this.currentPath);
        } else {
          App.toast('Upload error: ' + data.error, 'error');
        }
      } catch (e) {
        App.toast('Upload failed: ' + e.message, 'error');
      }
      uploadInput.value = '';
    };

    // Quick Shortcuts
    document.querySelectorAll('.shortcut-file').forEach(btn => {
      btn.onclick = () => {
        const fileRel = btn.getAttribute('data-file');
        this.openFile(fileRel);
      };
    });

    // Save File
    const btnSave = document.getElementById('btnSaveFile');
    btnSave.onclick = () => this.saveCurrentFile();

    // Editor textarea interactions
    const textarea = document.getElementById('fileEditorTextarea');
    textarea.oninput = () => {
      if (!this.isDirty) {
        this.isDirty = true;
        document.getElementById('editorDirtyFlag').classList.remove('hidden');
      }
    };

    // Handle Tab key in editor
    textarea.onkeydown = (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 4;
        textarea.dispatchEvent(new Event('input'));
      }
    };

    // Download current file
    document.getElementById('btnDownloadCurrentFile').onclick = () => {
      if (this.currentOpenFile) {
        window.open(`/api/files/download?path=${encodeURIComponent(this.currentOpenFile)}`, '_blank');
      }
    };
  },

  renderBreadcrumbs(pathStr) {
    const el = document.getElementById('fileBreadcrumbs');
    el.innerHTML = '';

    const rootBtn = document.createElement('span');
    rootBtn.style.cursor = 'pointer';
    rootBtn.textContent = '/data';
    rootBtn.onclick = () => this.load('');
    el.appendChild(rootBtn);

    const parts = pathStr.split('/').filter(Boolean);
    let accum = '';
    for (const p of parts) {
      accum += '/' + p;
      const sep = document.createElement('span');
      sep.textContent = ' / ';
      sep.className = 'text-dim';
      el.appendChild(sep);

      const partBtn = document.createElement('span');
      partBtn.textContent = p;
      partBtn.style.cursor = 'pointer';
      const target = accum;
      partBtn.onclick = () => this.load(target);
      el.appendChild(partBtn);
    }
  },

  renderList(items) {
    const container = document.getElementById('fileList');
    container.innerHTML = '';

    // "Up one level" folder if not in root
    if (this.currentPath && this.currentPath !== '/') {
      const upItem = document.createElement('div');
      upItem.className = 'file-item';
      upItem.innerHTML = `
        <div class="file-item-left">
          <span>📁</span>
          <span class="font-bold">..</span>
        </div>
      `;
      upItem.onclick = () => {
        const parent = this.currentPath.split('/').slice(0, -1).join('/') || '';
        this.load(parent);
      };
      container.appendChild(upItem);
    }

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'p-4 text-center text-muted font-mono';
      empty.textContent = '(Empty directory)';
      container.appendChild(empty);
      return;
    }

    for (const item of items) {
      const div = document.createElement('div');
      div.className = 'file-item';
      if (this.currentOpenFile === item.path) {
        div.classList.add('active');
      }

      const icon = item.isDir ? '📁' : this.getFileIcon(item.name);
      const sizeStr = item.isDir ? '' : ` (${(item.size / 1024).toFixed(1)} KB)`;

      div.innerHTML = `
        <div class="file-item-left">
          <span>${icon}</span>
          <span class="file-item-name font-mono">${item.name}${sizeStr}</span>
        </div>
        <div class="file-item-actions">
          ${!item.isDir ? `<a href="/api/files/download?path=${encodeURIComponent(item.path)}" class="btn btn-outline btn-xs" title="Download">⬇️</a>` : ''}
          <button class="btn btn-outline-danger btn-xs" onclick="event.stopPropagation(); FilesController.deleteItem('${item.path}')" title="Delete">🗑️</button>
        </div>
      `;

      div.onclick = () => {
        if (item.isDir) {
          this.load(item.path);
        } else {
          this.openFile(item.path);
        }
      };

      container.appendChild(div);
    }
  },

  getFileIcon(filename) {
    if (filename.endsWith('.lua')) return '🌙';
    if (filename.endsWith('.ini') || filename.endsWith('.cfg')) return '⚙️';
    if (filename.endsWith('.db') || filename.endsWith('.sqlite')) return '🗄️';
    if (filename.endsWith('.tar.gz') || filename.endsWith('.zip')) return '📦';
    if (filename.endsWith('.json')) return '📋';
    if (filename.endsWith('.txt') || filename.endsWith('.log')) return '📜';
    return '📄';
  },

  async openFile(pathStr) {
    if (this.isDirty) {
      if (!confirm('You have unsaved changes in the editor. Discard them?')) return;
    }

    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(pathStr)}`);
      const data = await res.json();
      if (data.error) {
        App.toast('Cannot open file: ' + data.error, 'error');
        return;
      }

      this.currentOpenFile = pathStr;
      this.isDirty = false;

      document.getElementById('editorCurrentFile').textContent = data.path;
      document.getElementById('editorDirtyFlag').classList.add('hidden');
      document.getElementById('btnSaveFile').disabled = false;
      document.getElementById('btnDownloadCurrentFile').disabled = false;

      const textarea = document.getElementById('fileEditorTextarea');
      textarea.value = data.content;
      textarea.scrollTop = 0;

      // Update active highlight in file list
      document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
    } catch (e) {
      App.toast('Error opening file: ' + e.message, 'error');
    }
  },

  async saveCurrentFile() {
    if (!this.currentOpenFile) return;

    const content = document.getElementById('fileEditorTextarea').value;
    try {
      const res = await fetch('/api/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: this.currentOpenFile, content })
      });
      const data = await res.json();
      if (data.success) {
        this.isDirty = false;
        document.getElementById('editorDirtyFlag').classList.add('hidden');
        App.toast(`File saved: ${this.currentOpenFile}`, 'success');
      } else {
        App.toast('Save failed: ' + data.error, 'error');
      }
    } catch (e) {
      App.toast('Save error: ' + e.message, 'error');
    }
  },

  async deleteItem(pathStr) {
    if (!confirm(`Are you sure you want to delete "${pathStr}"?`)) return;

    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(pathStr)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        App.toast('Deleted successfully', 'info');
        if (this.currentOpenFile === pathStr) {
          this.currentOpenFile = null;
          document.getElementById('editorCurrentFile').textContent = 'Select a file to view or edit';
          document.getElementById('fileEditorTextarea').value = '';
          document.getElementById('btnSaveFile').disabled = true;
          document.getElementById('btnDownloadCurrentFile').disabled = true;
        }
        this.load(this.currentPath);
      } else {
        App.toast('Delete failed: ' + data.error, 'error');
      }
    } catch (e) {
      App.toast('Delete error: ' + e.message, 'error');
    }
  }
};

window.FilesController = FilesController;
