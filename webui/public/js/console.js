/**
 * Interactive Terminal & Console Controller
 */

const ConsoleController = {
  screen: null,
  input: null,
  form: null,
  history: [],
  historyIndex: -1,
  allLogs: [],
  filterQuery: '',

  init() {
    this.screen = document.getElementById('terminalScreen');
    this.input = document.getElementById('consoleInput');
    this.form = document.getElementById('consoleForm');

    this.setupListeners();
  },

  setupListeners() {
    // Submit command
    this.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cmd = this.input.value.trim();
      if (!cmd) return;

      this.history.push(cmd);
      this.historyIndex = this.history.length;
      this.input.value = '';

      try {
        const res = await fetch('/api/server/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd })
        });
        const data = await res.json();
        if (data.error) {
          App.toast(data.error, 'error');
        }
      } catch (err) {
        App.toast('Failed to send command: ' + err.message, 'error');
      }
    });

    // Arrow Up / Down command history
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.input.value = this.history[this.historyIndex] || '';
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          this.input.value = this.history[this.historyIndex] || '';
        } else {
          this.historyIndex = this.history.length;
          this.input.value = '';
        }
      }
    });

    // Quick Command Chips
    document.querySelectorAll('.cmd-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const cmd = chip.getAttribute('data-cmd');
        this.input.value = cmd;
        this.form.dispatchEvent(new Event('submit'));
      });
    });

    // Filter
    const filterInput = document.getElementById('terminalFilter');
    filterInput.addEventListener('input', (e) => {
      this.filterQuery = e.target.value.toLowerCase();
      this.renderFilteredLogs();
    });

    // Clear
    document.getElementById('btnClearConsole').addEventListener('click', () => {
      this.allLogs = [];
      this.screen.innerHTML = '';
      App.toast('Console cleared', 'info');
    });

    // Copy
    document.getElementById('btnCopyLogs').addEventListener('click', () => {
      const text = this.allLogs.map(l => `[${l.timestamp}] [${l.source.toUpperCase()}] ${l.text}`).join('\n');
      navigator.clipboard.writeText(text).then(() => {
        App.toast('All logs copied to clipboard', 'success');
      });
    });
  },

  initLogs(logs) {
    this.allLogs = logs;
    this.renderFilteredLogs();
  },

  appendLog(log) {
    this.allLogs.push(log);
    if (this.allLogs.length > 3000) {
      this.allLogs.shift();
    }

    if (this.filterQuery && !log.text.toLowerCase().includes(this.filterQuery)) {
      return;
    }

    const lineEl = this.createLogElement(log);
    this.screen.appendChild(lineEl);

    const autoScroll = document.getElementById('autoScrollCheck').checked;
    if (autoScroll) {
      this.screen.scrollTop = this.screen.scrollHeight;
    }
  },

  renderFilteredLogs() {
    this.screen.innerHTML = '';
    const filtered = this.filterQuery
      ? this.allLogs.filter(l => l.text.toLowerCase().includes(this.filterQuery))
      : this.allLogs;

    for (const log of filtered) {
      this.screen.appendChild(this.createLogElement(log));
    }

    const autoScroll = document.getElementById('autoScrollCheck').checked;
    if (autoScroll) {
      this.screen.scrollTop = this.screen.scrollHeight;
    }
  },

  createLogElement(log) {
    const div = document.createElement('div');
    div.className = `log-line log-${log.source}`;

    // Highlight keywords
    let text = this.escapeHtml(log.text);
    if (log.source === 'input') {
      text = `<span style="color:#e3b341">&gt; ${text}</span>`;
    }

    div.innerHTML = text;
    return div;
  },

  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
};

window.ConsoleController = ConsoleController;
window.addEventListener('DOMContentLoaded', () => ConsoleController.init());
