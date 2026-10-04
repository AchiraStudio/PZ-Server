import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Send,
  Trash2,
  Download,
  Search,
  ArrowDown,
  Sparkles,
  HelpCircle,
  Save,
  Users,
  Volume2
} from 'lucide-react';
import { serverApi } from '../services/api';

export default function ConsoleTab({ logs, onSendCommand, isOnline }) {
  const [command, setCommand] = useState('');
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [sending, setSending] = useState(false);
  const logContainerRef = useRef(null);

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
      return <span className="text-emerald-500/80 italic">{text}</span>;
    }

    return <span className="text-slate-300">{text}</span>;
  };

  const filteredLogs = logs.filter((l) => {
    if (!filter) return true;
    return (l.text || '').toLowerCase().includes(filter.toLowerCase());
  });

  const presets = [
    { label: 'players', icon: Users, cmd: 'players', title: 'List connected players' },
    { label: 'save', icon: Save, cmd: 'save', title: 'Save world state' },
    { label: 'help', icon: HelpCircle, cmd: 'help', title: 'List all in-game commands' },
    { label: 'chopper', icon: Volume2, cmd: 'chopper', title: 'Trigger helicopter event' },
    { label: 'gunshot', icon: Volume2, cmd: 'gunshot', title: 'Trigger ambient gunshot sound' }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-3">
      {/* Top Console Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-2.5 rounded-xl">
        {/* Search / Filter input */}
        <div className="flex items-center gap-2 bg-[var(--bg-primary)] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter logs (e.g. error, Lua)..."
            className="bg-transparent border-none text-xs text-slate-200 outline-none w-full"
          />
          {filter && (
            <button onClick={() => setFilter('')} className="text-xs text-slate-500 hover:text-slate-300">
              ✕
            </button>
          )}
        </div>

        {/* Preset command shortcuts */}
        <div className="hidden md:flex items-center gap-1.5">
          <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mr-1">Presets:</span>
          {presets.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.cmd}
                onClick={() => handleSend(p.cmd)}
                title={p.title}
                className="btn btn-secondary btn-sm text-xs py-1 px-2.5 flex items-center gap-1.5 hover:border-emerald-500/40"
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

      {/* Terminal Window Container */}
      <div className="flex-1 flex flex-col bg-[#070b14] border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-lg">
        {/* Terminal Window Header Bar */}
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
    </div>
  );
}
