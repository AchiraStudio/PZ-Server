import React, { useState } from 'react';
import {
  Terminal,
  FolderTree,
  Sliders,
  Package,
  Users,
  HardDriveDownload,
  Play,
  Square,
  RotateCw,
  DownloadCloud,
  Layers,
  LogOut,
  Cpu,
  HardDrive,
  Clock,
  Radio,
  RefreshCw
} from 'lucide-react';

export default function Header({
  activeTab,
  setActiveTab,
  status,
  onStart,
  onStop,
  onRestart,
  onUpdate,
  onSyncMods,
  onLogout,
  isActionLoading
}) {
  const [confirmStop, setConfirmStop] = useState(false);

  const formatUptime = (seconds) => {
    if (!seconds) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 GB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const navItems = [
    { id: 'console', label: 'Console', icon: Terminal },
    { id: 'files', label: 'Files', icon: FolderTree },
    { id: 'config', label: 'Config & Sandbox', icon: Sliders },
    { id: 'mods', label: 'Mods', icon: Package },
    { id: 'players', label: 'Players', icon: Users },
    { id: 'backups', label: 'Backups', icon: HardDriveDownload }
  ];

  const serverState = status?.status || 'starting';
  const isOnline = serverState === 'online';
  const isStarting = serverState === 'starting';
  const isStopped = serverState === 'stopped';

  return (
    <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 backdrop-blur-md sticky top-0 z-50">
      {/* Top Banner: Brand, Status, Telemetry & Server Controls */}
      <div className="max-w-[1440px] mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Server Status */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-glow">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white">Project Zomboid</h1>
              <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-400 font-mono">
                {status?.serverName || 'server'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`pulse-dot ${serverState}`} />
              <span className={`text-xs font-semibold uppercase tracking-wider ${
                isOnline ? 'text-emerald-400' : isStarting ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {serverState}
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400 font-mono">
                Build: stable (B42)
              </span>
            </div>
          </div>
        </div>

        {/* Live Metrics Telemetry */}
        <div className="hidden lg:flex items-center gap-6 bg-slate-900/60 border border-white/5 px-4 py-1.5 rounded-xl text-xs">
          {/* CPU Metric */}
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-slate-400">CPU Usage</div>
              <div className="font-mono font-medium text-slate-200">
                {status?.system?.cpuPercent ? `${status.system.cpuPercent.toFixed(1)}%` : '0.0%'}
              </div>
            </div>
          </div>

          <div className="w-px h-6 bg-white/10" />

          {/* RAM Metric */}
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-slate-400">Memory (RAM)</div>
              <div className="font-mono font-medium text-slate-200">
                {formatBytes(status?.system?.usedMem)} / {formatBytes(status?.system?.totalMem)}
                <span className="text-slate-500 ml-1">({status?.system?.memPercent || 0}%)</span>
              </div>
            </div>
          </div>

          <div className="w-px h-6 bg-white/10" />

          {/* Uptime */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-slate-400">Uptime</div>
              <div className="font-mono font-medium text-slate-200">
                {formatUptime(status?.uptime)}
              </div>
            </div>
          </div>

          <div className="w-px h-6 bg-white/10" />

          {/* Online Players */}
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <div>
              <div className="text-slate-400">Survivors</div>
              <div className="font-mono font-medium text-slate-200">
                {status?.onlinePlayersCount || 0} online
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action Controls */}
        <div className="flex items-center gap-2">
          {isStopped ? (
            <button
              onClick={onStart}
              disabled={isActionLoading}
              className="btn btn-primary btn-sm"
              title="Start Project Zomboid Server"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start</span>
            </button>
          ) : (
            <div className="relative">
              {confirmStop ? (
                <div className="flex items-center gap-1.5 animate-fadeIn">
                  <button
                    onClick={() => {
                      setConfirmStop(false);
                      onStop();
                    }}
                    disabled={isActionLoading}
                    className="btn btn-danger btn-sm"
                  >
                    Confirm Stop
                  </button>
                  <button
                    onClick={() => setConfirmStop(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmStop(true)}
                  disabled={isActionLoading}
                  className="btn btn-secondary btn-sm text-rose-400 hover:text-rose-300 hover:border-rose-500/30"
                  title="Stop Server Gracefully (save & quit)"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop</span>
                </button>
              )}
            </div>
          )}

          <button
            onClick={onRestart}
            disabled={isActionLoading}
            className="btn btn-secondary btn-sm"
            title="Restart Dedicated Server"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isActionLoading ? 'animate-spin' : ''}`} />
            <span>Restart</span>
          </button>

          <button
            onClick={onUpdate}
            disabled={isActionLoading}
            className="btn btn-secondary btn-sm text-cyan-400 hover:text-cyan-300"
            title="Update Server via SteamCMD"
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Update</span>
          </button>

          <button
            onClick={onLogout}
            className="btn btn-ghost btn-sm text-slate-400 hover:text-slate-200"
            title="Log Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="max-w-[1440px] mx-auto px-4 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
