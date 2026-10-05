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
  ChevronUp,
  MapPin,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  AlertTriangle,
  Layers,
  Sparkles
} from 'lucide-react';
import { configApi } from '../services/api';

export default function ConfigTab() {
  const [subTab, setSubTab] = useState('sandbox'); // 'sandbox', 'server_ini', 'maps', 'raw'
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

  // Map Order state
  const [mapsList, setMapsList] = useState(['Muldraugh, KY']);
  const [savedMapsList, setSavedMapsList] = useState(['Muldraugh, KY']);
  const [detectedMaps, setDetectedMaps] = useState([]);
  const [popularCustomMaps, setPopularCustomMaps] = useState([]);
  const [newMapInput, setNewMapInput] = useState('');
  const [selectedPresetMap, setSelectedPresetMap] = useState('');

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
      const [sbRes, iniRes, presetsRes, mapsRes] = await Promise.all([
        configApi.getSandbox(),
        configApi.getServerIni(),
        configApi.getPresets().catch(() => ({})),
        configApi.getMaps().catch(() => ({}))
      ]);

      setSandboxData(sbRes.data || {});
      setRawSandbox(sbRes.raw || '');
      setIniData(iniRes.data || {});
      setRawIni(iniRes.raw || '');
      setPresets(presetsRes || {});
      if (mapsRes?.currentMaps) {
        setMapsList(mapsRes.currentMaps);
        setSavedMapsList([...mapsRes.currentMaps]);
      }
      if (mapsRes?.detectedMaps) setDetectedMaps(mapsRes.detectedMaps);
      if (mapsRes?.popularCustomMaps) setPopularCustomMaps(mapsRes.popularCustomMaps);
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

  const saveMaps = async (listToSave = mapsList) => {
    setSaving(true);
    try {
      const res = await configApi.saveMaps(listToSave);
      setMapsList(res.maps);
      setSavedMapsList([...res.maps]);
      setNotice('Map load order saved to server.ini!');
      setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      alert(`Save maps failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const autoSortMaps = () => {
    const custom = mapsList.filter((m) => m !== 'Muldraugh, KY');
    const sorted = [...custom, 'Muldraugh, KY'];
    setMapsList(sorted);
    setNotice('Custom maps ordered first. Muldraugh, KY placed at bottom.');
    setTimeout(() => setNotice(null), 3000);
  };

  const moveMap = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= mapsList.length) return;
    const next = [...mapsList];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setMapsList(next);
  };

  const addMap = (name) => {
    const trimmed = (name || newMapInput).trim();
    if (!trimmed) return;
    if (mapsList.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
      alert(`Map "${trimmed}" is already in the list.`);
      return;
    }
    const muldraughIdx = mapsList.indexOf('Muldraugh, KY');
    const next = [...mapsList];
    if (muldraughIdx >= 0) {
      next.splice(muldraughIdx, 0, trimmed);
    } else {
      next.push(trimmed);
      next.push('Muldraugh, KY');
    }
    setMapsList(next);
    setNewMapInput('');
    setSelectedPresetMap('');
  };

  const removeMap = (mapName) => {
    if (mapName === 'Muldraugh, KY') {
      alert('Cannot remove vanilla baseline "Muldraugh, KY". It is required by the game engine.');
      return;
    }
    setMapsList(mapsList.filter((m) => m !== mapName));
  };

  const hasUnsavedMaps =
    mapsList.length !== savedMapsList.length ||
    mapsList.some((m, idx) => m !== savedMapsList[idx]);

  const muldraughIsLast = mapsList.length > 0 && mapsList[mapsList.length - 1] === 'Muldraugh, KY';

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
            onClick={() => setSubTab('maps')}
            className={`btn btn-sm ${subTab === 'maps' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Map Order & Custom Maps</span>
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

      {/* TAB 3: CUSTOM MAPS & MAP= ORDER */}
      {subTab === 'maps' && (
        <div className="flex flex-col gap-4">
          {/* Explanation Card */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Map Priority & Cell Overwrite Manager (Map= in server.ini)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Custom maps <span className="text-cyan-400 font-semibold">(Raven Creek, Blackwood, Grapeseed, etc.)</span> MUST load BEFORE vanilla Kentucky. Vanilla <span className="text-emerald-400 font-semibold">Muldraugh, KY</span> must always stay at the absolute bottom.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={autoSortMaps}
                className="btn btn-secondary btn-sm text-amber-300 hover:text-amber-200 border-amber-500/30 bg-amber-500/10 text-xs"
                title="Automatically sort custom maps first and lock Muldraugh, KY to the bottom"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Auto-Order (Custom First, Vanilla Last)</span>
              </button>

              <button
                onClick={() => saveMaps()}
                disabled={saving}
                className="btn btn-primary btn-sm text-xs font-bold shadow-glow"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Map Order</span>
              </button>
            </div>
          </div>

          {/* Validation Warning Alert if Muldraugh is not at the end */}
          {!muldraughIsLast && (
            <div className="bg-rose-500/15 border border-rose-500/40 p-3.5 rounded-xl flex items-center justify-between gap-3 text-rose-300 animate-pulse shadow-md">
              <div className="flex items-center gap-2.5 text-xs">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <span className="font-bold">CRITICAL WARNING:</span> Vanilla "Muldraugh, KY" is not at the bottom of the map list! Custom maps loaded after Muldraugh will crash on connect or have their buildings overwritten.
                </div>
              </div>
              <button
                onClick={autoSortMaps}
                className="btn btn-primary btn-sm text-xs font-bold text-white shrink-0 shadow-glow"
              >
                Fix Order Now
              </button>
            </div>
          )}

          {/* 2-Column Maps Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Add Map (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 rounded-xl flex flex-col gap-3 shadow-sm">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Add Map Mod</span>
                </h4>

                <div>
                  <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                    Detected in /mods or Popular Maps:
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedPresetMap}
                      onChange={(e) => setSelectedPresetMap(e.target.value)}
                      className="input-select text-xs flex-1"
                    >
                      <option value="">-- Choose installed or popular map --</option>
                      {detectedMaps.length > 0 && (
                        <optgroup label="Detected in Server Mods Folder">
                          {detectedMaps.map((dm) => (
                            <option key={dm} value={dm}>{dm} (Local Mod)</option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Popular Custom Maps">
                        {popularCustomMaps.map((pm) => (
                          <option key={pm} value={pm}>{pm}</option>
                        ))}
                      </optgroup>
                    </select>
                    <button
                      type="button"
                      onClick={() => addMap(selectedPresetMap)}
                      disabled={!selectedPresetMap}
                      className="btn btn-primary btn-sm text-xs"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)]">
                  <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                    Or Enter Map Name Directly:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMapInput}
                      onChange={(e) => setNewMapInput(e.target.value)}
                      placeholder="e.g. RavenCreek, Grapeseed..."
                      className="input-text text-xs flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addMap(newMapInput);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => addMap(newMapInput)}
                      disabled={!newMapInput.trim()}
                      className="btn btn-primary btn-sm text-xs"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                  Note: The map name must match the exact directory name in the mod's <code className="text-cyan-400">media/maps/&lt;MapName&gt;</code> folder.
                </p>
              </div>
            </div>

            {/* Right: Map Order List (8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-3">
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 rounded-xl flex flex-col gap-3 shadow-sm min-h-[450px]">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Active Map Order ({mapsList.length})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Top = Highest Priority (Loaded First)
                  </span>
                </div>

                <div className="flex flex-col gap-2 overflow-y-auto max-h-[500px] pr-1">
                  {mapsList.map((mapName, idx) => {
                    const isMuldraugh = mapName === 'Muldraugh, KY';
                    const isVanilla = isMuldraugh || ['Riverside, KY', 'Rosewood, KY', 'West Point, KY'].includes(mapName);

                    return (
                      <div
                        key={`${mapName}-${idx}`}
                        className={`flex items-center justify-between gap-3 p-3 rounded-lg border text-xs bg-[var(--bg-primary)] ${
                          isMuldraugh
                            ? 'border-emerald-500/40 bg-emerald-950/10'
                            : isVanilla
                            ? 'border-blue-500/30'
                            : 'border-[var(--border-subtle)] hover:border-slate-600/60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-slate-500 text-xs w-6 text-right font-bold shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="font-semibold text-slate-100 text-sm truncate">
                            {mapName}
                          </span>
                          {isMuldraugh ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                              Vanilla Base Anchor (Required Last)
                            </span>
                          ) : isVanilla ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                              Vanilla Base Map
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                              Custom Mod Map
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {!isMuldraugh && (
                            <>
                              <button
                                onClick={() => moveMap(idx, 0)}
                                disabled={idx === 0}
                                className="p-1 hover:text-cyan-400 text-slate-500 disabled:opacity-20 rounded"
                                title="Move to Top"
                              >
                                <ChevronsUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => moveMap(idx, idx - 1)}
                                disabled={idx === 0}
                                className="p-1 hover:text-cyan-400 text-slate-500 disabled:opacity-20 rounded"
                                title="Move Up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => moveMap(idx, idx + 1)}
                                disabled={idx === mapsList.length - 1 || (idx === mapsList.length - 2 && muldraughIsLast)}
                                className="p-1 hover:text-cyan-400 text-slate-500 disabled:opacity-20 rounded"
                                title="Move Down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => removeMap(mapName)}
                                className="p-1 hover:text-rose-400 text-slate-500 hover:bg-rose-950/30 rounded ml-1"
                                title="Remove map"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hasUnsavedMaps && (
                  <div className="mt-auto pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between bg-amber-500/5 -mx-4 -mb-4 p-3 rounded-b-xl border-amber-500/20">
                    <span className="text-xs text-amber-300 flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      Map order has unsaved changes!
                    </span>
                    <button
                      onClick={() => saveMaps()}
                      disabled={saving}
                      className="btn btn-primary btn-sm text-xs font-bold shadow-glow"
                    >
                      Save Map Order
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RAW EDITORS */}
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
