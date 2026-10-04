import React, { useState } from 'react';
import { Lock, Radio, KeyRound } from 'lucide-react';
import { authApi } from '../services/api';

export default function LoginModal({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      await authApi.login(password);
      onLoginSuccess();
    } catch (err) {
      setError(err.message || 'Invalid password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-sm p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-glow">
          <KeyRound className="w-6 h-6" />
        </div>

        <h2 className="text-lg font-bold text-white mb-1">Access Server Manager</h2>
        <p className="text-xs text-slate-400 mb-5">
          Enter admin credentials to authenticate
        </p>

        {error && (
          <div className="p-2.5 mb-4 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin Password"
            className="input-text text-sm text-center font-mono"
            autoFocus
            required
          />

          <button
            type="submit"
            disabled={loading || !password}
            className="btn btn-primary w-full"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
