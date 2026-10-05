import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Send,
  Download,
  Search,
  ArrowDown,
  HelpCircle,
  Save,
  Users,
  Volume2,
  Megaphone,
  Timer,
  AlertTriangle,
  CloudRain,
  Radio,
  X,
  Play,
  Check
} from 'lucide-react';
import { serverApi } from '../services/api';

export default function ConsoleTab({ logs, onSendCommand, isOnline, restartInfo }) {
  const [command, setCommand] = useState('');
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [sending, setSending] = useState(false);
  const logContainerRef = useRef(null);

  // Broadcast state
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastNotice, setBroadcastNotice] = useState(null);

  // Safe restart modal state
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [restartDuration, setRestartDuration] = useState(60); // 60s default
  const [restartReason, setRestartReason] = useState('Scheduled server maintenance');
  const [scheduling, setScheduling] = useState(false);

  // Auto scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleSend = async (cmdToSend) => {
    const cmd = (cmdToSend || command).trim();
    if (!cmd) return;

    // Add to history
    setHistory((prev) => [cmd, ...prev.filter((h) => h !== cmd)].slice(0, 50));
    setHistoryIndex(-1);
    setCommand('');
    setSending(true);

    try {
      await onSendCommand(cmd);
    } catch (err) {
      console.error('Failed to send command', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setCommand(history[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const prevIndex = historyIndex - 1;
        setHistoryIndex(prevIndex);
        setCommand(history[prevIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  const handleBroadcast = async (e) => {
    if (e) e.preventDefault();
    const msg = broadcastMsg.trim();
    if (!msg) return;

    setBroadcasting(true);
    try {
      await serverApi.broadcast(msg);
      setBroadcastNotice('Announcement sent to all online survivors!');
      setTimeout(() => setBroadcastNotice(null), 3000);
      setBroadcastMsg('');
    } catch (err) {
      alert(`Broadcast failed: ${err.message}`);
    } finally {
      setBroadcasting(false);
    }
  };

  const handleScheduleRestart = async () => {
    setScheduling(true);
    try {
      await serverApi.scheduleRestart(restartDuration, restartReason);
      setShowRestartModal(false);
    } catch (err) {
      alert(`Failed to schedule restart: ${err.message}`);
    } finally {
      setScheduling(false);
    }
  };

  const handleCancelRestart = async () => {
    try {
      await serverApi.cancelRestart();
    } catch (err) {
      alert(`Cancel failed: ${err.message}`);
    }
  };

  const downloadLogs = () => {
    const text = logs.map((l) => `[${l.timestamp || ''}] [${l.source || 'server'}] ${l.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pz-server-logs-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Colorize log text based on content
  const formatLogLine = (log) => {
    const text = log.text || '';
    const source = log.source || 'server';

    if (source === 'input') {
      return <span className="text-yellow-400 font-semibold">{text}</span>;
    }

    if (text.includes('ERROR') || text.includes('FAIL') || text.includes('Exception')) {
      return <span className="text-rose-400 bg-rose-950/30 px-1 rounded">{text}</span>;
    }
    if (text.includes('WARN') || text.includes('warning')) {
      return <span className="text-amber-400">{text}</span>;
    }
    if (text.includes('SERVER STARTED') || text.includes('Ready for commands') || text.includes('Authenticated successfully')) {
      return <span className="text-emerald-400 font-bold bg-emerald-950/30 px-1 rounded">{text}</span>;
    }
    if (text.includes('[ALIFE')) {
      return <span className="text-purple-400/90">{text}</span>;
    }
    if (text.includes('LOG  : Lua')) {
      return <span className="text-cyan-400/90">{text}</span>;
    }
    if (text.includes('Network') || text.includes('RakNet') || text.includes('Steam')) {
      return <span className="text-blue-400">{text}</span>;
    }
    if (source === 'supervisor') {
      return <span className="text-emerald-400/90 font-medium">{text}</span>;
    }

    return <span className="text-slate-300">{text}</span>;
  };

  const filteredLogs = logs.filter((l) => {
    if (!filter) return true;
    return (l.text || '').toLowerCase().includes(filter.toLowerCase());
  });

  const presets = [
    { label: 'players', icon: Users, cmd: 'players', title: 'List connected players' },
    { label: 'save', icon: Save, cmd: 'save', title: 'Save world state to disk' },
    { label: 'chopper', icon: Volume2, cmd: 'chopper', title: 'Trigger in-game helicopter event' },
    { label: 'gunshot', icon: Volume2, cmd: 'gunshot', title: 'Trigger ambient gunshot sound' },
    { label: 'rain', icon: CloudRain, cmd: 'startrain', title: 'Trigger thunderstorm rain' },
    { label: 'help', icon: HelpCircle, cmd: 'help', title: 'List all commands' }
  ];

  const broadcastPresets = [
    'Server restarting in 5 minutes! Please find safe shelter.',
    'Scheduled maintenance starting soon. Log out safely.',
    'Welcome new survivors! Check the safehouse guidelines.',
    'Warning: Helicopter detected in the area! Stay indoors.'
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-3">
      {/* 1. Active Countdown Alert Banner */}
      {restartInfo?.active && (
        <div className="flex items-center justify-between gap-3 bg-amber-500/15 border border-amber-500/40 px-4 py-2.5 rounded-xl shadow-lg animate-pulse">
          <div className="flex items-center gap-3">
            <Timer className="w-5 h-5 text-amber-400 animate-spin" />
            <div>
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider mr-2">
                Safe Restart in Progress:
              </span>
              <span className="font-mono text-white text-sm font-bold">
                {restartInfo.countdown >= 60
                  ? `${Math.floor(restartInfo.countdown / 60)}m ${restartInfo.countdown % 60}s remaining`
                  : `${restartInfo.countdown}s remaining`}
              </span>
              {restartInfo.reason && (
                <span className="text-xs text-amber-200/80 ml-2 hidden sm:inline">
                  ("{restartInfo.reason}")
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleCancelRestart}
            className="btn btn-danger btn-sm text-xs py-1 px-3 shadow"
          >
            Cancel Restart
          </button>
        </div>
      )}

      {/* 2. Top Interactive Toolbar: Broadcast Bar + Search + Quick Controls */}
      <div className="flex flex-col gap-2.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3 rounded-xl">
        {/* Broadcast Announcement Bar */}
        <form onSubmit={handleBroadcast} className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-emerald-500/30 flex-1">
            <Megaphone className="w-4 h-4 text-emerald-400 shrink-0" />
            <input
              type="text"
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="Broadcast in-game banner to all players (/servermsg)..."
              className="bg-transparent border-none text-xs text-slate-100 outline-none w-full placeholder:text-slate-500"
            />
            {broadcastNotice && (
              <span className="text-[11px] text-emerald-400 font-semibold shrink-0 flex items-center gap-1 animate-fadeIn">
                <Check className="w-3.5 h-3.5" />
                Sent
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={broadcasting || !broadcastMsg.trim()}
            className="btn btn-primary btn-sm text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-glow"
            title="Broadcast announcement to all online players in real time"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Broadcast</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRestartModal(true)}
            className="btn btn-secondary btn-sm text-xs py-1.5 px-3 flex items-center gap-1.5 hover:border-amber-500/40 text-amber-300"
            title="Safe countdown restart with automated in-game warning broadcasts"
          >
            <Timer className="w-3.5 h-3.5 text-amber-400" />
            <span>Safe Countdown</span>
          </button>
        </form>

        {/* Second Row: Filters, Presets, Export */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[var(--border-subtle)]">
          {/* Search / Filter input */}
          <div className="flex items-center gap-2 bg-[var(--bg-primary)] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter console logs..."
              className="bg-transparent border-none text-xs text-slate-200 outline-none w-full"
            />
            {filter && (
              <button onClick={() => setFilter('')} className="text-xs text-slate-500 hover:text-slate-300">
                ✕
              </button>
            )}
          </div>

          {/* Preset command shortcuts */}
          <div className="hidden lg:flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mr-1">Presets:</span>
            {presets.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.cmd}
                  onClick={() => handleSend(p.cmd)}
                  title={p.title}
                  className="btn btn-secondary btn-sm text-xs py-1 px-2.5 flex items-center gap-1 hover:border-emerald-500/40"
                >
                  <Icon className="w-3 h-3 text-emerald-400" />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* Toolbar controls */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`btn btn-sm ${
                autoScroll ? 'btn-primary text-xs py-1 px-2.5' : 'btn-secondary text-xs py-1 px-2.5'
              }`}
              title="Auto-scroll to latest log entries"
            >
              <ArrowDown className={`w-3.5 h-3.5 ${autoScroll ? 'animate-bounce' : ''}`} />
              <span>Follow</span>
            </button>

            <button
              onClick={downloadLogs}
              className="btn btn-secondary btn-sm text-xs py-1 px-2.5"
              title="Download full log file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Terminal Window Container */}
      <div className="flex-1 flex flex-col bg-[#070b14] border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-lg">
        {/* Terminal Header Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#0d1322] border-b border-[var(--border-subtle)] text-xs text-slate-400 select-none">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
            <span className="ml-2 font-mono text-[11px] text-slate-400">pzserver@dedicated:~/live-log</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-slate-500">Port 16261 / RCON 27015</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 font-semibold">{filteredLogs.length} lines</span>
          </div>
        </div>

        {/* Terminal Log Output Area */}
        <div
          ref={logContainerRef}
          className="flex-1 p-4 overflow-y-auto font-mono text-[12.5px] leading-relaxed select-text"
          style={{ scrollBehavior: 'smooth' }}
        >
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
              <Terminal className="w-8 h-8 opacity-40 text-emerald-500" />
              <p className="text-sm">Waiting for server logs...</p>
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div key={index} className="py-0.5 hover:bg-white/[0.02] flex items-start gap-2">
                <span className="text-slate-600 select-none text-[10px] w-20 shrink-0">
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                </span>
                <div className="break-all flex-1">{formatLogLine(log)}</div>
              </div>
            ))
          )}
        </div>

        {/* Terminal Command Input Prompt */}
        <div className="flex items-center gap-2 bg-[#090e18] border-t border-[var(--border-subtle)] px-3 py-2.5">
          <div className="text-emerald-400 font-mono pl-1 text-sm select-none font-bold">&gt;</div>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type an in-game console command (e.g. setaccesslevel Achira admin, save, help)..."
            className="flex-1 bg-transparent border-none outline-none text-slate-100 font-mono text-xs px-2"
            autoFocus
          />
          <button
            onClick={() => handleSend()}
            disabled={sending || !command.trim()}
            className="btn btn-primary btn-sm px-4"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </div>
      </div>

      {/* 4. Safe Restart Countdown Modal */}
      {showRestartModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Schedule Safe Restart</h3>
              </div>
              <button
                onClick={() => setShowRestartModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Safe restart broadcasts automated countdown warnings to all players in-game, automatically saves the world state, and reboots the container cleanly.
            </p>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Countdown Duration:</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '30s', val: 30 },
                    { label: '1 Min', val: 60 },
                    { label: '2 Min', val: 120 },
                    { label: '5 Min', val: 300 }
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setRestartDuration(preset.val)}
                      className={`btn btn-sm ${
                        restartDuration === preset.val ? 'btn-primary font-bold' : 'btn-secondary'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Reason / Announcement:</label>
                <input
                  type="text"
                  value={restartReason}
                  onChange={(e) => setRestartReason(e.target.value)}
                  className="input-text text-xs"
                  placeholder="e.g. Scheduled maintenance, Mod update..."
                />
              </div>

              <div>
                <span className="block text-[11px] text-slate-400 mb-1">Quick Presets:</span>
                <div className="flex flex-col gap-1">
                  {broadcastPresets.map((bp, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRestartReason(bp)}
                      className="text-left text-[11px] text-slate-400 hover:text-emerald-400 truncate py-0.5"
                    >
                      • {bp}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setShowRestartModal(false)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleScheduleRestart}
                disabled={scheduling}
                className="btn btn-primary btn-sm font-bold shadow-glow text-white"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start {restartDuration}s Countdown</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
