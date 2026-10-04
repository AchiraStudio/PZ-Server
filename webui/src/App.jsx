import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ConsoleTab from './components/ConsoleTab';
import FilesTab from './components/FilesTab';
import ConfigTab from './components/ConfigTab';
import ModsTab from './components/ModsTab';
import PlayersTab from './components/PlayersTab';
import BackupsTab from './components/BackupsTab';
import LoginModal from './components/LoginModal';
import { authApi, serverApi, connectWebSocket } from './services/api';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState('console');

  // Server state & telemetry
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [toasts, setToasts] = useState([]);

  const wsRef = useRef(null);

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Auth verification
  const checkAuthentication = async () => {
    try {
      const res = await authApi.check();
      setAuthenticated(res.authenticated);
    } catch (e) {
      setAuthenticated(false);
    } finally {
      setAuthChecked(true);
    }
  };

  useEffect(() => {
    checkAuthentication();

    const handleUnauthorized = () => {
      setAuthenticated(false);
    };
    window.addEventListener('pz-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('pz-unauthorized', handleUnauthorized);
  }, []);

  // Poll status periodically
  const fetchStatus = async () => {
    try {
      const data = await serverApi.getStatus();
      setStatus(data);
      if (data.onlinePlayers) {
        setOnlinePlayers(data.onlinePlayers);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (!authenticated) return;

    fetchStatus();
    const timer = setInterval(fetchStatus, 5000);
    return () => clearInterval(timer);
  }, [authenticated]);

  // WebSocket Connection for Live Logs & Telemetry
  useEffect(() => {
    if (!authenticated) return;

    wsRef.current = connectWebSocket(
      (msg) => {
        if (msg.type === 'init') {
          if (msg.status) setStatus((prev) => ({ ...(prev || {}), status: msg.status }));
          if (msg.onlinePlayers) setOnlinePlayers(msg.onlinePlayers);
          if (msg.logs) setLogs(msg.logs);
        } else if (msg.type === 'log') {
          setLogs((prev) => [...prev.slice(-2500), msg.log]);
        } else if (msg.type === 'status') {
          setStatus((prev) => ({ ...(prev || {}), status: msg.status }));
        } else if (msg.type === 'players') {
          setOnlinePlayers(msg.onlinePlayers || []);
        }
      },
      () => {
        // Connected
      },
      () => {
        // Disconnected
      }
    );

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [authenticated]);

  // Server control actions
  const handleStart = async () => {
    setIsActionLoading(true);
    try {
      await serverApi.start();
      addToast('Project Zomboid dedicated server starting...', 'success');
      fetchStatus();
    } catch (err) {
      addToast(`Start failed: ${err.message}`, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStop = async () => {
    setIsActionLoading(true);
    try {
      await serverApi.stop();
      addToast('Saving world state and stopping server...', 'success');
      fetchStatus();
    } catch (err) {
      addToast(`Stop failed: ${err.message}`, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRestart = async () => {
    setIsActionLoading(true);
    try {
      await serverApi.restart();
      addToast('Restarting server...', 'success');
      fetchStatus();
    } catch (err) {
      addToast(`Restart failed: ${err.message}`, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    setIsActionLoading(true);
    try {
      await serverApi.update();
      addToast('SteamCMD update triggered on server.', 'success');
    } catch (err) {
      addToast(`Update failed: ${err.message}`, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSyncMods = async () => {
    try {
      await serverApi.syncMods();
      addToast('Mod auto-downloader started.', 'success');
    } catch (err) {
      addToast(`Sync failed: ${err.message}`, 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
      setAuthenticated(false);
    } catch (e) {}
  };

  const handleSendCommand = async (cmd) => {
    const res = await serverApi.sendCommand(cmd);
    if (!res.success && res.error) {
      addToast(`Console: ${res.error}`, 'error');
    }
    return res;
  };

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg-app)] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-xs font-mono">Loading Supervisor Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginModal onLoginSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <div className="app-container">
      {/* Top Header & Navbar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        status={status}
        onStart={handleStart}
        onStop={handleStop}
        onRestart={handleRestart}
        onUpdate={handleUpdate}
        onSyncMods={handleSyncMods}
        onLogout={handleLogout}
        isActionLoading={isActionLoading}
      />

      {/* Main View Area */}
      <main className="main-content">
        {activeTab === 'console' && (
          <ConsoleTab
            logs={logs}
            onSendCommand={handleSendCommand}
            isOnline={status?.status === 'online'}
          />
        )}

        {activeTab === 'files' && <FilesTab />}

        {activeTab === 'config' && <ConfigTab />}

        {activeTab === 'mods' && <ModsTab />}

        {activeTab === 'players' && <PlayersTab onlinePlayers={onlinePlayers} />}

        {activeTab === 'backups' && <BackupsTab isServerOnline={status?.status === 'online'} />}
      </main>

      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
