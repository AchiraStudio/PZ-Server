import React, { useState, useEffect } from 'react';
import {
  Sliders,
  FileCode,
  Save,
  Check,
  RotateCcw,
  Zap,
  Shield,
  Skull,
  Clock,
  PackageCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { configApi } from '../services/api';

export default function ConfigTab() {
  const [subTab, setSubTab] = useState('sandbox'); // 'sandbox', 'server_ini', 'raw'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  // Sandbox state
  const [sandboxData, setSandboxData] = useState({});
  const [rawSandbox, setRawSandbox] = useState('');
  const [presets, setPresets] = useState({});

  // Server.ini state
  const [iniData, setIniData] = useState({});
  const [rawIni, setRawIni] = useState('');

  // Accordion open/close state
  const [openSections, setOpenSections] = useState({
    zombies: true,
    population: true,
    world: true,
    loot: false
  });

  const toggleSection = (sec) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const [sbRes, iniRes, presetsRes] = await Promise.all([
        configApi.getSandbox(),
        configApi.getServerIni(),
        configApi.getPresets().catch(() => ({}))
      ]);

      setSandboxData(sbRes.data || {});
      setRawSandbox(sbRes.raw || '');
      setIniData(iniRes.data || {});
      setRawIni(iniRes.raw || '');
      setPresets(presetsRes || {});
    } catch (err) {
      console.error('Failed to load configs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const saveSandbox = async (dataToSave = sandboxData) => {
    setSaving(true);
    try {
      await configApi.saveSandbox({ data: dataToSave });
      setNotice('Sandbox configuration saved successfully!');
      setTimeout(() => setNotice(null), 3000);
      loadConfigs();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveServerIni = async (dataToSave = iniData) => {
    setSaving(true);
    try {
      await configApi.saveServerIni({ data: dataToSave });
      setNotice('Server settings saved successfully!');
      setTimeout(() => setNotice(null), 3000);
      loadConfigs();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveRaw = async (type) => {
    setSaving(true);
    try {
      if (type === 'sandbox') {
        await configApi.saveSandbox({ raw: rawSandbox });
      } else {
        await configApi.saveServerIni({ raw: rawIni });
      }
      setNotice('Raw configuration file saved!');
      setTimeout(() => setNotice(null), 3000);
      loadConfigs();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (presetKey) => {
    const preset = presets[presetKey];
    if (!preset || !preset.data) return;

    const merged = { ...sandboxData, ...preset.data };
    if (preset.data.ZombieLore) {
      merged.ZombieLore = { ...sandboxData.ZombieLore, ...preset.data.ZombieLore };
    }
    setSandboxData(merged);
    saveSandbox(merged);
  };

  const updateSandbox = (key, val) => {
    setSandboxData((prev) => ({ ...prev, [key]: val }));
  };

  const updateZombieLore = (key, val) => {
    setSandboxData((prev) => ({
      ...prev,
      ZombieLore: {
        ...(prev.ZombieLore || {}),
        [key]: parseInt(val, 10)
      }
    }));
  };

  const updateZombieConfig = (key, val) => {
    setSandboxData((prev) => ({
      ...prev,
      ZombieConfig: {
        ...(prev.ZombieConfig || {}),
        [key]: parseFloat(val)
      }
    }));
  };

  const updateIni = (key, val) => {
    setIniData((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Sub Tabs Bar */}
      <div className="flex items-center justify-between bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-2.5 rounded-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('sandbox')}
            className={`btn btn-sm ${subTab === 'sandbox' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Sandbox Variables (Gameplay)</span>
          </button>

          <button
            onClick={() => setSubTab('server_ini')}
            className={`btn btn-sm ${subTab === 'server_ini' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Server Settings (server.ini)</span>
          </button>

          <button
            onClick={() => setSubTab('raw')}
            className={`btn btn-sm ${subTab === 'raw' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Raw File Editors</span>
          </button>
        </div>

        {notice && (
          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 animate-fadeIn">
            <Check className="w-4 h-4" />
            {notice}
          </span>
        )}
      </div>

      {/* TAB 1: VISUAL SANDBOX EDITOR */}
      {subTab === 'sandbox' && (
        <div className="flex flex-col gap-4">
          {/* Presets Bar */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Quick Presets
              </div>
              <p className="text-[11px] text-slate-400">Click a preset to quickly apply standard gameplay balance:</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => applyPreset('apocalypse')}
                className="btn btn-secondary btn-sm text-xs hover:border-amber-500/40"
              >
                Apocalypse (Hardcore)
              </button>
              <button
                onClick={() => applyPreset('survivor')}
                className="btn btn-secondary btn-sm text-xs hover:border-emerald-500/40"
              >
                Survivor (Standard)
              </button>
              <button
                onClick={() => applyPreset('builder')}
                className="btn btn-secondary btn-sm text-xs hover:border-cyan-500/40"
              >
                Builder (Casual)
              </button>
              <button
                onClick={() => applyPreset('sprinters')}
                className="btn btn-secondary btn-sm text-xs text-rose-400 hover:border-rose-500/40"
              >
                28 Days Later (Sprinters)
              </button>
            </div>
          </div>

          {/* Section 1: Zombie Lore */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-sm">
            <div
              onClick={() => toggleSection('zombies')}
              className="flex items-center justify-between px-4 py-3 bg-slate-900/60 cursor-pointer hover:bg-slate-900/80 transition-colors"
            >
              <div className="flex items-center gap-2.5 font-bold text-sm text-white">
                <Skull className="w-4 h-4 text-rose-400" />
                <span>Zombie Characteristics & Lore</span>
              </div>
              {openSections.zombies ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            {openSections.zombies && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Speed</label>
                  <select
                    value={sandboxData.ZombieLore?.Speed ?? 2}
                    onChange={(e) => updateZombieLore('Speed', e.target.value)}
                    className="input-select"
                  >
                    <option value={1}>Sprinters (Fast Running)</option>
                    <option value={2}>Fast Shamblers (Standard)</option>
                    <option value={3}>Shamblers (Slow)</option>
                    <option value={4}>Randomized</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Strength</label>
                  <select
                    value={sandboxData.ZombieLore?.Strength ?? 2}
                    onChange={(e) => updateZombieLore('Strength', e.target.value)}
                    className="input-select"
                  >
                    <option value={1}>Superhuman</option>
                    <option value={2}>Normal</option>
                    <option value={3}>Weak</option>
                    <option value={4}>Random</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Toughness</label>
                  <select
                    value={sandboxData.ZombieLore?.Toughness ?? 2}
                    onChange={(e) => updateZombieLore('Toughness', e.target.value)}
                    className="input-select"
                  >
                    <option value={1}>Tough</option>
                    <option value={2}>Normal</option>
                    <option value={3}>Fragile</option>
                    <option value={4}>Random</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Infection Transmission</label>
                  <select
                    value={sandboxData.ZombieLore?.Transmission ?? 1}
                    onChange={(e) => updateZombieLore('Transmission', e.target.value)}
                    className="input-select"
                  >
                    <option value={1}>Blood + Saliva (Bites & Lacerations)</option>
                    <option value={2}>Saliva Only (Bites Only)</option>
                    <option value={3}>Everyone's Infected</option>
                    <option value={4}>None (Infection Disabled)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Cognition (Door Opening)</label>
                  <select
                    value={sandboxData.ZombieLore?.Cognition ?? 3}
                    onChange={(e) => updateZombieLore('Cognition', e.target.value)}
                    className="input-select"
                  >
                    <option value={1}>Navigate + Open Doors</option>
                    <option value={2}>Navigate</option>
                    <option value={3}>Basic Navigation</option>
                    <option value={4}>Random</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Memory Span</label>
                  <select
                    value={sandboxData.ZombieLore?.Memory ?? 2}
                    onChange={(e) => updateZombieLore('Memory', e.target.value)}
                    className="input-select"
                  >
                    <option value={1}>Long</option>
                    <option value={2}>Normal</option>
                    <option value={3}>Short</option>
                    <option value={4}>None</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Population & Respawn */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-sm">
            <div
              onClick={() => toggleSection('population')}
              className="flex items-center justify-between px-4 py-3 bg-slate-900/60 cursor-pointer hover:bg-slate-900/80 transition-colors"
            >
              <div className="flex items-center gap-2.5 font-bold text-sm text-white">
                <Skull className="w-4 h-4 text-amber-400" />
                <span>Zombie Population & Respawn Multipliers</span>
              </div>
              {openSections.population ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            {openSections.population && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Population Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={sandboxData.ZombieConfig?.PopulationMultiplier ?? 1.0}
                    onChange={(e) => updateZombieConfig('PopulationMultiplier', e.target.value)}
                    className="input-text"
                  />
                  <span className="text-[10px] text-slate-500">1.0 = Normal, 2.0 = High, 4.0 = Insane</span>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Peak Day Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={sandboxData.ZombieConfig?.PopulationPeakMultiplier ?? 1.5}
                    onChange={(e) => updateZombieConfig('PopulationPeakMultiplier', e.target.value)}
                    className="input-text"
                  />
                  <span className="text-[10px] text-slate-500">Max population cap reached on peak day</span>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Peak Day</label>
                  <input
                    type="number"
                    min="1"
                    value={sandboxData.ZombieConfig?.PopulationPeakDay ?? 28}
                    onChange={(e) => updateZombieConfig('PopulationPeakDay', e.target.value)}
                    className="input-text"
                  />
                  <span className="text-[10px] text-slate-500">Day when peak population is reached</span>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Respawn Hours</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={sandboxData.ZombieConfig?.RespawnHours ?? 72.0}
                    onChange={(e) => updateZombieConfig('RespawnHours', e.target.value)}
                    className="input-text"
                  />
                  <span className="text-[10px] text-slate-500">Hours before zombies respawn in unseen chunks (0 = no respawn)</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: World & Environment */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-sm">
            <div
              onClick={() => toggleSection('world')}
              className="flex items-center justify-between px-4 py-3 bg-slate-900/60 cursor-pointer hover:bg-slate-900/80 transition-colors"
            >
              <div className="flex items-center gap-2.5 font-bold text-sm text-white">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>World, Time & Utilities Shutoff</span>
              </div>
              {openSections.world ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            {openSections.world && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Day Length</label>
                  <select
                    value={sandboxData.DayLength ?? 3}
                    onChange={(e) => updateSandbox('DayLength', parseInt(e.target.value, 10))}
                    className="input-select"
                  >
                    <option value={1}>30 Minutes</option>
                    <option value={2}>1 Hour (Standard)</option>
                    <option value={3}>2 Hours</option>
                    <option value={4}>3 Hours</option>
                    <option value={5}>4 Hours</option>
                    <option value={6}>5 Hours</option>
                    <option value={12}>12 Hours</option>
                    <option value={24}>24 Hours (Real Time)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Water Shutoff</label>
                  <select
                    value={sandboxData.WaterShut ?? 2}
                    onChange={(e) => updateSandbox('WaterShut', parseInt(e.target.value, 10))}
                    className="input-select"
                  >
                    <option value={1}>Instant (Day 0)</option>
                    <option value={2}>0 - 30 Days (Standard)</option>
                    <option value={3}>0 - 2 Months</option>
                    <option value={4}>0 - 6 Months</option>
                    <option value={5}>0 - 1 Year</option>
                    <option value={6}>0 - 5 Years</option>
                    <option value={7}>Never</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Electricity Shutoff</label>
                  <select
                    value={sandboxData.ElecShut ?? 2}
                    onChange={(e) => updateSandbox('ElecShut', parseInt(e.target.value, 10))}
                    className="input-select"
                  >
                    <option value={1}>Instant (Day 0)</option>
                    <option value={2}>0 - 30 Days (Standard)</option>
                    <option value={3}>0 - 2 Months</option>
                    <option value={4}>0 - 6 Months</option>
                    <option value={5}>0 - 1 Year</option>
                    <option value={6}>0 - 5 Years</option>
                    <option value={7}>Never</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">XP Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={sandboxData.XpMultiplier ?? 1.0}
                    onChange={(e) => updateSandbox('XpMultiplier', parseFloat(e.target.value))}
                    className="input-text"
                  />
                  <span className="text-[10px] text-slate-500">Global character experience gain rate</span>
                </div>
              </div>
            )}
          </div>

          {/* Save Sandbox Button */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => saveSandbox()}
              disabled={saving}
              className="btn btn-primary"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Sandbox Settings...' : 'Save Sandbox Changes'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: SERVER.INI SETTINGS */}
      {subTab === 'server_ini' && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Public Server Name</label>
              <input
                type="text"
                value={iniData.PublicName || ''}
                onChange={(e) => updateIni('PublicName', e.target.value)}
                className="input-text"
                placeholder="My Dedicated Server"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Max Players</label>
              <input
                type="number"
                min="1"
                max="128"
                value={iniData.MaxPlayers || '32'}
                onChange={(e) => updateIni('MaxPlayers', e.target.value)}
                className="input-text"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Ping Limit (ms)</label>
              <input
                type="number"
                min="100"
                value={iniData.PingLimit || '400'}
                onChange={(e) => updateIni('PingLimit', e.target.value)}
                className="input-text"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Pause When Empty</label>
              <select
                value={iniData.PauseEmpty || 'true'}
                onChange={(e) => updateIni('PauseEmpty', e.target.value)}
                className="input-select"
              >
                <option value="true">True (Stop time when 0 players online)</option>
                <option value="false">False (Time continues always)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-400 font-semibold mb-1">Server Welcome Message</label>
              <textarea
                value={iniData.ServerWelcomeMessage || ''}
                onChange={(e) => updateIni('ServerWelcomeMessage', e.target.value)}
                rows={2}
                className="input-textarea"
                placeholder="Welcome to Project Zomboid!"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-400 font-semibold mb-1">Public Description</label>
              <textarea
                value={iniData.PublicDescription || ''}
                onChange={(e) => updateIni('PublicDescription', e.target.value)}
                rows={2}
                className="input-textarea"
                placeholder="Survival awaits..."
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              onClick={() => saveServerIni()}
              disabled={saving}
              className="btn btn-primary"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save server.ini Settings'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: RAW EDITORS */}
      {subTab === 'raw' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Raw server.ini */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl flex flex-col h-[650px] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/60 border-b border-[var(--border-subtle)]">
              <span className="font-mono text-xs font-bold text-white">server.ini (Raw)</span>
              <button
                onClick={() => saveRaw('ini')}
                disabled={saving}
                className="btn btn-primary btn-sm py-1"
              >
                <Save className="w-3 h-3" />
                <span>Save</span>
              </button>
            </div>
            <textarea
              value={rawIni}
              onChange={(e) => setRawIni(e.target.value)}
              className="flex-1 bg-[#060a12] p-3 text-slate-100 font-mono text-xs leading-relaxed outline-none resize-none select-text"
              spellCheck="false"
            />
          </div>

          {/* Raw server_SandboxVars.lua */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl flex flex-col h-[650px] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/60 border-b border-[var(--border-subtle)]">
              <span className="font-mono text-xs font-bold text-white">server_SandboxVars.lua (Raw)</span>
              <button
                onClick={() => saveRaw('sandbox')}
                disabled={saving}
                className="btn btn-primary btn-sm py-1"
              >
                <Save className="w-3 h-3" />
                <span>Save</span>
              </button>
            </div>
            <textarea
              value={rawSandbox}
              onChange={(e) => setRawSandbox(e.target.value)}
              className="flex-1 bg-[#060a12] p-3 text-slate-100 font-mono text-xs leading-relaxed outline-none resize-none select-text"
              spellCheck="false"
            />
          </div>
        </div>
      )}
    </div>
  );
}
