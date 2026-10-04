import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  UserX,
  Ban,
  CheckCircle,
  RefreshCw,
  Plus,
  AlertTriangle,
  Send
} from 'lucide-react';
import { playersApi, serverApi } from '../services/api';

export default function PlayersTab({ onlinePlayers = [] }) {
  const [whitelist, setWhitelist] = useState([]);
  const [bans, setBans] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [kickModal, setKickModal] = useState({ open: false, username: '', reason: '' });
  const [banModal, setBanModal] = useState({ open: false, username: '', reason: '', banIp: false });
  const [roleModal, setRoleModal] = useState({ open: false, username: '', accesslevel: 'admin' });

  const loadPlayersData = async () => {
    setLoading(true);
    try {
      const data = await playersApi.getPlayers();
      setWhitelist(data.whitelist || []);
      setBans(data.bans || []);
    } catch (err) {
      console.error('Failed to load players data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlayersData();
  }, []);

  const handleKick = async (e) => {
    e.preventDefault();
    try {
      await playersApi.kick(kickModal.username, kickModal.reason);
      setKickModal({ open: false, username: '', reason: '' });
      loadPlayersData();
    } catch (err) {
      alert(`Kick failed: ${err.message}`);
    }
  };

  const handleBan = async (e) => {
    e.preventDefault();
    try {
      await playersApi.ban(banModal.username, banModal.reason, banModal.banIp);
      setBanModal({ open: false, username: '', reason: '', banIp: false });
      loadPlayersData();
    } catch (err) {
      alert(`Ban failed: ${err.message}`);
    }
  };

  const handleSetRole = async (e) => {
    e.preventDefault();
    try {
      await playersApi.setRole(roleModal.username, roleModal.accesslevel);
      setRoleModal({ open: false, username: '', accesslevel: 'admin' });
      loadPlayersData();
    } catch (err) {
      alert(`Set role failed: ${err.message}`);
    }
  };

  const handleUnban = async (username) => {
    try {
      await playersApi.unban(username);
      loadPlayersData();
    } catch (err) {
      alert(`Unban failed: ${err.message}`);
    }
  };

  const handleRemoveWhitelist = async (username) => {
    if (!confirm(`Remove ${username} from whitelist?`)) return;
    try {
      await playersApi.removeWhitelist(username);
      loadPlayersData();
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 1. ONLINE SURVIVORS */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Connected Survivors ({onlinePlayers.length})
            </h3>
          </div>
          <button
            onClick={loadPlayersData}
            disabled={loading}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {onlinePlayers.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No players currently online in Knox County.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {onlinePlayers.map((player) => (
              <div key={player} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-mono text-sm text-slate-100 font-bold">{player}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRoleModal({ open: true, username: player, accesslevel: 'admin' })}
                    className="btn btn-secondary btn-sm text-xs py-1"
                  >
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>Set Role</span>
                  </button>

                  <button
                    onClick={() => setKickModal({ open: true, username: player, reason: '' })}
                    className="btn btn-secondary btn-sm text-xs py-1 text-slate-300 hover:text-amber-400"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Kick</span>
                  </button>

                  <button
                    onClick={() => setBanModal({ open: true, username: player, reason: '', banIp: false })}
                    className="btn btn-danger btn-sm text-xs py-1"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Ban</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid: Whitelist & Bans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* WHITELIST */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Whitelisted Accounts ({whitelist.length})</span>
            </h3>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border-subtle)] text-xs">
            {whitelist.length === 0 ? (
              <p className="py-6 text-center text-slate-500">No whitelisted accounts recorded.</p>
            ) : (
              whitelist.map((user) => (
                <div key={user.username} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-slate-200">{user.username}</span>
                    <span className="ml-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {user.accesslevel || 'Player'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveWhitelist(user.username)}
                    className="text-slate-500 hover:text-rose-400 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* BANS */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Ban className="w-4 h-4 text-rose-400" />
              <span>Banned Accounts & IPs ({bans.length})</span>
            </h3>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border-subtle)] text-xs">
            {bans.length === 0 ? (
              <p className="py-6 text-center text-slate-500">No active bans on server.</p>
            ) : (
              bans.map((b) => (
                <div key={b.username || b.ip} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-rose-300">{b.username || b.ip}</span>
                    {b.reason && <p className="text-[10px] text-slate-500">{b.reason}</p>}
                  </div>
                  <button
                    onClick={() => handleUnban(b.username || b.ip)}
                    className="btn btn-secondary btn-sm text-[11px] py-0.5 px-2 text-emerald-400 hover:border-emerald-500/40"
                  >
                    Unban
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Kick Modal */}
      {kickModal.open && (
        <div className="modal-overlay">
          <form onSubmit={handleKick} className="modal-content max-w-md p-5">
            <h3 className="text-base font-bold text-white mb-2">Kick {kickModal.username}</h3>
            <label className="block text-xs text-slate-400 mb-1">Reason (Optional)</label>
            <input
              type="text"
              value={kickModal.reason}
              onChange={(e) => setKickModal({ ...kickModal, reason: e.target.value })}
              placeholder="Violation of server rules"
              className="input-text text-xs mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setKickModal({ open: false, username: '', reason: '' })}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-warning btn-sm">
                Kick Player
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ban Modal */}
      {banModal.open && (
        <div className="modal-overlay">
          <form onSubmit={handleBan} className="modal-content max-w-md p-5">
            <h3 className="text-base font-bold text-rose-400 mb-2">Ban {banModal.username}</h3>
            <label className="block text-xs text-slate-400 mb-1">Reason</label>
            <input
              type="text"
              value={banModal.reason}
              onChange={(e) => setBanModal({ ...banModal, reason: e.target.value })}
              placeholder="Reason for ban"
              className="input-text text-xs mb-3"
              autoFocus
            />
            <label className="flex items-center gap-2 text-xs text-slate-300 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={banModal.banIp}
                onChange={(e) => setBanModal({ ...banModal, banIp: e.target.checked })}
                className="rounded border-slate-700 bg-slate-900 text-rose-500"
              />
              <span>Also ban player IP address</span>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBanModal({ open: false, username: '', reason: '', banIp: false })}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-danger btn-sm">
                Confirm Ban
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Role Modal */}
      {roleModal.open && (
        <div className="modal-overlay">
          <form onSubmit={handleSetRole} className="modal-content max-w-md p-5">
            <h3 className="text-base font-bold text-white mb-2">Set Access Role: {roleModal.username}</h3>
            <label className="block text-xs text-slate-400 mb-1">Access Level</label>
            <select
              value={roleModal.accesslevel}
              onChange={(e) => setRoleModal({ ...roleModal, accesslevel: e.target.value })}
              className="input-select text-xs mb-4"
            >
              <option value="admin">admin (Full Superuser & RCON)</option>
              <option value="moderator">moderator (Kick, Ban, Mute)</option>
              <option value="gm">gm (Game Master)</option>
              <option value="overseer">overseer</option>
              <option value="observer">observer (Spectate Only)</option>
              <option value="none">none (Standard Player)</option>
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRoleModal({ open: false, username: '', accesslevel: 'admin' })}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Apply Role
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
