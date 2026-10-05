import React, { useState, useEffect } from 'react';
import {
  Archive,
  Download,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Plus,
  FileArchive,
  Clock,
  ShieldCheck,
  Check,
  Save,
  Radio,
  Sliders
} from 'lucide-react';
import { backupsApi } from '../services/api';

export default function BackupsTab({ isServerOnline }) {
  const [worlds, setWorlds] = useState([]);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [wipeModal, setWipeModal] = useState({ open: false, worldName: '' });

  // Automated backup & crash recovery settings
  const [settings, setSettings] = useState({
    enabled: true,
    intervalHours: 6,
    maxKeep: 10,
    lastBackup: null,
    nextBackup: null,
    crashRecovery: true
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const [worldsRes, settingsRes] = await Promise.all([
        backupsApi.getWorlds(),
        backupsApi.getSettings().catch(() => null)
      ]);
      setWorlds(worldsRes.worlds || []);
      setBackups(worldsRes.backups || []);
      if (settingsRes) {
        setSettings(settingsRes);
      }
    } catch (err) {
      console.error('Failed to load worlds and backups', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateBackup = async (worldName) => {
    setCreating(true);
    try {
      await backupsApi.createBackup(worldName);
      loadBackups();
    } catch (err) {
      alert(`Backup failed: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBackup = async (filename) => {
    if (!confirm(`Delete backup ${filename}?`)) return;
    try {
      await backupsApi.deleteBackup(filename);
      loadBackups();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleWipeConfirm = async () => {
    try {
      await backupsApi.wipeWorld(wipeModal.worldName);
      setWipeModal({ open: false, worldName: '' });
      loadBackups();
      alert('World wiped successfully.');
    } catch (err) {
      alert(`Wipe failed: ${err.message}`);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await backupsApi.saveSettings({
        enabled: settings.enabled,
        intervalHours: settings.intervalHours,
        maxKeep: settings.maxKeep
      });
      setNotice('Backup & recovery settings updated successfully!');
      setTimeout(() => setNotice(null), 3000);
      loadBackups();
    } catch (err) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatTime = (ts) => {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleString();
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 1. AUTOMATED BACKUPS & CRASH RECOVERY CARD */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span>Automated World Backups & Crash Recovery</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Supervisor Active
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Periodic world saves with auto-pruning plus 24/7 container crash recovery probe.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {notice && (
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1 rounded-lg animate-fadeIn">
                <Check className="w-3.5 h-3.5" />
                {notice}
              </span>
            )}
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="btn btn-primary btn-sm text-xs font-bold shadow-glow"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Schedule Settings</span>
            </button>
          </div>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Toggle Auto Backup */}
          <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] p-3 rounded-lg flex flex-col justify-between gap-2">
            <div>
              <label className="font-semibold text-slate-200 block mb-1">Periodic Backups</label>
              <p className="text-[11px] text-slate-400 leading-tight">
                Automatically saves world via RCON before archiving to prevent rollback.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="autoBackupEnabled"
                checked={settings.enabled}
                onChange={(e) => setSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="rounded border-slate-700 bg-slate-900 text-emerald-500 cursor-pointer"
              />
              <label htmlFor="autoBackupEnabled" className="text-slate-300 font-semibold cursor-pointer">
                {settings.enabled ? 'Enabled' : 'Disabled'}
              </label>
            </div>
          </div>

          {/* Backup Interval */}
          <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] p-3 rounded-lg flex flex-col justify-between gap-2">
            <div>
              <label className="font-semibold text-slate-200 block mb-1">Backup Interval</label>
              <p className="text-[11px] text-slate-400 leading-tight">
                Frequency of automated periodic backups.
              </p>
            </div>
            <select
              value={settings.intervalHours}
              onChange={(e) => setSettings((prev) => ({ ...prev, intervalHours: parseInt(e.target.value, 10) }))}
              disabled={!settings.enabled}
              className="input-select text-xs mt-1"
            >
              <option value={1}>Every 1 Hour</option>
              <option value={3}>Every 3 Hours</option>
              <option value={6}>Every 6 Hours (Recommended)</option>
              <option value={12}>Every 12 Hours</option>
              <option value={24}>Every 24 Hours (Daily)</option>
            </select>
          </div>

          {/* Retention Limit */}
          <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] p-3 rounded-lg flex flex-col justify-between gap-2">
            <div>
              <label className="font-semibold text-slate-200 block mb-1">Retention Limit</label>
              <p className="text-[11px] text-slate-400 leading-tight">
                Maximum archives to keep before auto-deleting oldest.
              </p>
            </div>
            <select
              value={settings.maxKeep}
              onChange={(e) => setSettings((prev) => ({ ...prev, maxKeep: parseInt(e.target.value, 10) }))}
              disabled={!settings.enabled}
              className="input-select text-xs mt-1"
            >
              <option value={3}>Keep Last 3 Backups</option>
              <option value={5}>Keep Last 5 Backups</option>
              <option value={10}>Keep Last 10 Backups (Recommended)</option>
              <option value={15}>Keep Last 15 Backups</option>
              <option value={20}>Keep Last 20 Backups</option>
            </select>
          </div>

          {/* Crash Auto-Recovery Status */}
          <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] p-3 rounded-lg flex flex-col justify-between gap-2">
            <div>
              <label className="font-semibold text-slate-200 block mb-1">Crash Auto-Recovery</label>
              <p className="text-[11px] text-slate-400 leading-tight">
                Monitors container exit status every 15s and auto-recovers.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs pt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>Monitoring 24/7 (Active)</span>
            </div>
          </div>
        </div>

        {/* Telemetry info row */}
        {settings.enabled && (
          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 bg-[var(--bg-primary)]/50 px-3 py-2 rounded-lg border border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Last Scheduled Backup: <span className="font-mono text-slate-200">{formatTime(settings.lastBackup)}</span></span>
            </div>
            {settings.nextBackup && (
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Next Scheduled Backup: <span className="font-mono text-slate-200">{formatTime(settings.nextBackup)}</span></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. WORLDS & ACTIVE SAVES */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Detected World Saves ({worlds.length})
            </h3>
          </div>
          <button
            onClick={loadBackups}
            disabled={loading}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {worlds.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No save games found in /data/Zomboid/Saves.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {worlds.map((world) => (
              <div key={world.name} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-mono text-sm font-bold text-slate-100">{world.name}</h4>
                  <p className="text-xs text-slate-400">
                    Mode: {world.gameMode} • Modified: {world.mtime ? new Date(world.mtime).toLocaleString() : '-'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCreateBackup(world.name)}
                    disabled={creating}
                    className="btn btn-primary btn-sm text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{creating ? 'Archiving...' : 'Create Backup'}</span>
                  </button>

                  <button
                    onClick={() => setWipeModal({ open: true, worldName: world.name })}
                    disabled={isServerOnline}
                    className="btn btn-danger btn-sm text-xs"
                    title={isServerOnline ? 'Stop server first to wipe world' : 'Wipe World'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Wipe</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. BACKUPS ARCHIVE */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileArchive className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Backup Archives (/data/backups) ({backups.length})
            </h3>
          </div>
        </div>

        {backups.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">
            No backup tar.gz archives generated yet.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {backups.map((bk) => (
              <div key={bk.filename} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-mono text-xs font-bold text-slate-200">{bk.filename}</h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Size: {formatSize(bk.size)} • Created: {bk.createdAt ? new Date(bk.createdAt).toLocaleString() : '-'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`/api/files/download?path=${encodeURIComponent(`/backups/${bk.filename}`)}`}
                    download={bk.filename}
                    className="btn btn-secondary btn-sm text-xs py-1"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Download</span>
                  </a>

                  <button
                    onClick={() => handleDeleteBackup(bk.filename)}
                    className="p-1 hover:text-rose-400 text-slate-500 rounded"
                    title="Delete Backup"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Wipe Confirmation Modal */}
      {wipeModal.open && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md p-5">
            <h3 className="text-base font-bold text-rose-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Confirm World Wipe
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              Are you sure you want to permanently wipe world <span className="font-mono font-bold text-white">{wipeModal.worldName}</span>?
              All player buildings, map changes, and zombie positions will be deleted.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setWipeModal({ open: false, worldName: '' })}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleWipeConfirm}
                className="btn btn-danger btn-sm"
              >
                Yes, Wipe World
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
