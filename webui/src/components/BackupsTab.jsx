import React, { useState, useEffect } from 'react';
import {
  HardDriveDownload,
  Archive,
  Download,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Plus,
  CheckCircle,
  FileArchive
} from 'lucide-react';
import { backupsApi } from '../services/api';

export default function BackupsTab({ isServerOnline }) {
  const [worlds, setWorlds] = useState([]);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [wipeModal, setWipeModal] = useState({ open: false, worldName: '' });

  const loadBackups = async () => {
    setLoading(true);
    try {
      const data = await backupsApi.getWorlds();
      setWorlds(data.worlds || []);
      setBackups(data.backups || []);
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

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 1. WORLDS & ACTIVE SAVES */}
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

      {/* 2. BACKUPS ARCHIVE */}
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
            No backup zip archives generated yet.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {backups.map((bk) => (
              <div key={bk.filename} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-mono text-xs font-bold text-slate-200">{bk.filename}</h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Size: {formatSize(bk.size)} • Created: {bk.mtime ? new Date(bk.mtime).toLocaleString() : '-'}
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
