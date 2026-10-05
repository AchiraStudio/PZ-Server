import React, { useState, useEffect } from 'react';
import {
  Package,
  Layers,
  DownloadCloud,
  Plus,
  Trash2,
  ExternalLink,
  Search,
  Check,
  RefreshCw,
  FolderSync,
  AlertCircle,
  Sparkles,
  Link as LinkIcon,
  ClipboardList,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  GripVertical,
  SlidersHorizontal,
  ArrowUpDown,
  Copy,
  CheckCheck,
  RotateCcw,
  Zap,
  ListOrdered,
  FileCode
} from 'lucide-react';
import { modsApi, serverApi } from '../services/api';

// Known Project Zomboid core frameworks & libraries that should load before content mods
const KNOWN_FRAMEWORKS = [
  'modtemplate',
  'tsarslib',
  'tsarcommonlibrary',
  'trueactions',
  'trueactionsdancing',
  'filibusterrhymesusedcars',
  'filibuster',
  'bettersort',
  'neatui',
  'neatui_framework',
  'itemtweakerapi',
  'spawnmanager',
  'k15',
  'ki5',
  'easyconfig_ch',
  'starlitlibrary',
  'pzgate',
  'equipmentui',
  'automechanics',
  'managecontainers',
  'arsenal26gunfighter',
  'britasweaponpack',
  'britasarmorpack',
  'scs',
  'superb_survivors'
];

export default function ModsTab() {
  const [activeWorkshopItems, setActiveWorkshopItems] = useState([]);
  const [activeMods, setActiveMods] = useState([]);
  const [savedMods, setSavedMods] = useState([]);
  const [savedWorkshopItems, setSavedWorkshopItems] = useState([]);
  const [installedMods, setInstalledMods] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedType, setCopiedType] = useState(null);

  // Drag and Drop state
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Importer Mode: 'links' (Quick Fill by links), 'collection', 'single', 'raw'
  const [importMode, setImportMode] = useState('links');

  // Mode 1: Quick Fill by Links
  const [linksText, setLinksText] = useState('');
  const [linksInspected, setLinksInspected] = useState(null);
  const [inspectingLinks, setInspectingLinks] = useState(false);
  const [selectedInspectItems, setSelectedInspectItems] = useState(new Set());

  // Mode 2: Steam Collection
  const [collectionUrl, setCollectionUrl] = useState('');
  const [collectionData, setCollectionData] = useState(null);
  const [fetchingCollection, setFetchingCollection] = useState(false);
  const [selectedCollectionItems, setSelectedCollectionItems] = useState(new Set());

  // Mode 3: Single Item
  const [singleId, setSingleId] = useState('');
  const [singleData, setSingleData] = useState(null);
  const [fetchingSingle, setFetchingSingle] = useState(false);

  // Mode 4: Raw INI string edit
  const [rawWorkshopInput, setRawWorkshopInput] = useState('');
  const [rawModsInput, setRawModsInput] = useState('');
  const [showRawEditor, setShowRawEditor] = useState(false);

  const loadMods = async () => {
    setLoading(true);
    try {
      const data = await modsApi.getMods();
      const ws = data.workshopItems || [];
      const m = data.mods || [];
      setActiveWorkshopItems(ws);
      setActiveMods(m);
      setSavedWorkshopItems([...ws]);
      setSavedMods([...m]);
      setRawWorkshopInput(ws.join(';'));
      setRawModsInput(m.join(';'));
      setInstalledMods(data.installedMods || []);
    } catch (err) {
      console.error('Failed to load mods', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMods();
  }, []);

  // Detect unsaved load order changes
  const hasUnsavedOrder =
    activeMods.length !== savedMods.length ||
    activeMods.some((m, idx) => m !== savedMods[idx]) ||
    activeWorkshopItems.length !== savedWorkshopItems.length ||
    activeWorkshopItems.some((w, idx) => w !== savedWorkshopItems[idx]);

  const saveCurrentMods = async (wsItems = activeWorkshopItems, mods = activeMods) => {
    setSaving(true);
    try {
      await modsApi.saveMods(wsItems, mods);
      setSavedWorkshopItems([...wsItems]);
      setSavedMods([...mods]);
      setRawWorkshopInput(wsItems.join(';'));
      setRawModsInput(mods.join(';'));
      setNotice('Mod configuration & load order saved to server.ini!');
      setTimeout(() => setNotice(null), 3500);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetOrder = () => {
    setActiveMods([...savedMods]);
    setActiveWorkshopItems([...savedWorkshopItems]);
  };

  // Reordering helpers
  const moveMod = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= activeMods.length) return;
    const next = [...activeMods];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setActiveMods(next);
  };

  const moveModToTop = (index) => {
    if (index === 0) return;
    moveMod(index, 0);
  };

  const moveModToBottom = (index) => {
    if (index === activeMods.length - 1) return;
    moveMod(index, activeMods.length - 1);
  };

  const removeMod = (modIdToRemove) => {
    const updated = activeMods.filter((m) => m !== modIdToRemove);
    setActiveMods(updated);
  };

  const removeWorkshopItem = (wsIdToRemove) => {
    const updated = activeWorkshopItems.filter((w) => w !== wsIdToRemove);
    setActiveWorkshopItems(updated);
  };

  // Quick Sort Features
  const sortFrameworksFirst = () => {
    const frameworks = [];
    const others = [];

    const isFramework = (id) => {
      const lower = id.toLowerCase();
      return KNOWN_FRAMEWORKS.some((fw) => lower.includes(fw));
    };

    activeMods.forEach((m) => {
      if (isFramework(m)) {
        frameworks.push(m);
      } else {
        others.push(m);
      }
    });

    // Sort frameworks in order of priority from KNOWN_FRAMEWORKS
    frameworks.sort((a, b) => {
      const lowerA = a.toLowerCase();
      const lowerB = b.toLowerCase();
      const idxA = KNOWN_FRAMEWORKS.findIndex((fw) => lowerA.includes(fw));
      const idxB = KNOWN_FRAMEWORKS.findIndex((fw) => lowerB.includes(fw));
      return (idxA >= 0 ? idxA : 999) - (idxB >= 0 ? idxB : 999);
    });

    setActiveMods([...frameworks, ...others]);
    setNotice(`Auto-sorted! ${frameworks.length} core framework(s) placed at the top.`);
    setTimeout(() => setNotice(null), 3500);
  };

  const sortAlphabetical = (ascending = true) => {
    const next = [...activeMods].sort((a, b) =>
      ascending ? a.localeCompare(b, undefined, { sensitivity: 'base' }) : b.localeCompare(a, undefined, { sensitivity: 'base' })
    );
    setActiveMods(next);
    setNotice(`Sorted mods ${ascending ? 'A to Z' : 'Z to A'}.`);
    setTimeout(() => setNotice(null), 3000);
  };

  const deduplicateMods = () => {
    const uniqueMods = [...new Set(activeMods)];
    const uniqueWs = [...new Set(activeWorkshopItems)];
    const removedMods = activeMods.length - uniqueMods.length;
    const removedWs = activeWorkshopItems.length - uniqueWs.length;

    setActiveMods(uniqueMods);
    setActiveWorkshopItems(uniqueWs);
    setNotice(`Cleaned up ${removedMods} duplicate mod(s) and ${removedWs} duplicate workshop item(s).`);
    setTimeout(() => setNotice(null), 3500);
  };

  // Drag and Drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent drag ghost preview support
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    moveMod(draggedIndex, index);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Sync Mods Trigger
  const handleSyncMods = async () => {
    setSyncing(true);
    try {
      await serverApi.syncMods();
      alert('Workshop mod synchronization started on dedicated server!');
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Copy helper
  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  // ==========================================
  // IMPORTER 1: QUICK FILL BY LINKS (Direct user request)
  // ==========================================
  const detectedLinksCount = (linksText.match(/(?:id=|\/item\/|\b)(\d{6,})/gi) || []).length;

  const handleInspectLinks = async () => {
    if (!linksText.trim()) return;
    setInspectingLinks(true);
    setLinksInspected(null);
    setSelectedInspectItems(new Set());

    try {
      const res = await modsApi.parseBulk(linksText);
      setLinksInspected(res);
      // Pre-select all items
      if (res.items && res.items.length > 0) {
        setSelectedInspectItems(new Set(res.items.map((i) => i.workshopId)));
      }
    } catch (err) {
      alert(`Inspect failed: ${err.message}`);
    } finally {
      setInspectingLinks(false);
    }
  };

  const toggleSelectInspectItem = (wsId) => {
    const next = new Set(selectedInspectItems);
    if (next.has(wsId)) next.delete(wsId);
    else next.add(wsId);
    setSelectedInspectItems(next);
  };

  const applyInspectedLinks = async () => {
    if (!linksInspected) return;
    const toImport = [];

    if (linksInspected.items && linksInspected.items.length > 0) {
      for (const item of linksInspected.items) {
        if (selectedInspectItems.has(item.workshopId)) {
          if (item.modIds && item.modIds.length > 0) {
            for (const mId of item.modIds) {
              toImport.push({ workshopId: item.workshopId, modId: mId });
            }
          } else {
            toImport.push({ workshopId: item.workshopId, modId: '' });
          }
        }
      }
    } else {
      for (const wsId of linksInspected.workshopIds) {
        toImport.push({ workshopId: wsId, modId: '' });
      }
      for (const modId of linksInspected.modIds) {
        toImport.push({ workshopId: '', modId });
      }
    }

    try {
      await modsApi.bulkAdd(toImport);
      setNotice(`Successfully imported ${toImport.length} mods to server!`);
      setTimeout(() => setNotice(null), 3500);
      setLinksInspected(null);
      setLinksText('');
      loadMods();
    } catch (err) {
      alert(`Bulk add failed: ${err.message}`);
    }
  };

  // Direct fast add without Steam Web lookup
  const handleDirectAddLinks = async () => {
    if (!linksText.trim()) return;
    const matches = [...linksText.matchAll(/(?:id=|\/item\/|\b)(\d{6,})/gi)].map((m) => m[1]);
    const uniqueIds = [...new Set(matches)];
    if (uniqueIds.length === 0) {
      alert('No valid Workshop IDs found in pasted text.');
      return;
    }

    const toImport = uniqueIds.map((wsId) => ({ workshopId: wsId, modId: '' }));
    try {
      await modsApi.bulkAdd(toImport);
      setNotice(`Added ${uniqueIds.length} Workshop Item(s) directly!`);
      setTimeout(() => setNotice(null), 3500);
      setLinksText('');
      loadMods();
    } catch (err) {
      alert(`Direct add failed: ${err.message}`);
    }
  };

  // ==========================================
  // IMPORTER 2: STEAM COLLECTION
  // ==========================================
  const handleFetchCollection = async (e) => {
    e.preventDefault();
    if (!collectionUrl.trim()) return;
    setFetchingCollection(true);
    setCollectionData(null);
    setSelectedCollectionItems(new Set());
    try {
      const res = await modsApi.fetchCollection(collectionUrl);
      setCollectionData(res);
      setSelectedCollectionItems(new Set(res.items.map((i) => i.workshopId)));
    } catch (err) {
      alert(`Failed to fetch collection: ${err.message}`);
    } finally {
      setFetchingCollection(false);
    }
  };

  const importSelectedFromCollection = async () => {
    if (!collectionData) return;
    const toImport = [];
    for (const item of collectionData.items) {
      if (selectedCollectionItems.has(item.workshopId)) {
        if (item.modIds && item.modIds.length > 0) {
          for (const mId of item.modIds) {
            toImport.push({ workshopId: item.workshopId, modId: mId });
          }
        } else {
          toImport.push({ workshopId: item.workshopId, modId: '' });
        }
      }
    }

    try {
      await modsApi.bulkAdd(toImport);
      setNotice(`Added ${toImport.length} mods from collection!`);
      setTimeout(() => setNotice(null), 3500);
      setCollectionData(null);
      setCollectionUrl('');
      loadMods();
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
  };

  // ==========================================
  // IMPORTER 3: SINGLE LOOKUP
  // ==========================================
  const handleFetchSingle = async (e) => {
    e.preventDefault();
    if (!singleId.trim()) return;
    setFetchingSingle(true);
    setSingleData(null);
    try {
      const res = await modsApi.fetchItem(singleId);
      setSingleData(res);
    } catch (err) {
      alert(`Failed to fetch item: ${err.message}`);
    } finally {
      setFetchingSingle(false);
    }
  };

  const addSingleMod = async (modId) => {
    if (!singleData) return;
    const toImport = [{ workshopId: singleData.workshopId, modId: modId || '' }];
    try {
      await modsApi.bulkAdd(toImport);
      setNotice(`Added mod ${singleData.title}!`);
      setTimeout(() => setNotice(null), 3500);
      setSingleData(null);
      setSingleId('');
      loadMods();
    } catch (err) {
      alert(`Add failed: ${err.message}`);
    }
  };

  // ==========================================
  // RAW INI STRING SAVE
  // ==========================================
  const applyRawIniEdit = () => {
    const ws = rawWorkshopInput.split(';').map((s) => s.trim()).filter(Boolean);
    const m = rawModsInput.split(';').map((s) => s.trim()).filter(Boolean);
    setActiveWorkshopItems(ws);
    setActiveMods(m);
    saveCurrentMods(ws, m);
    setShowRawEditor(false);
  };

  // Filtered list
  const filteredMods = activeMods.map((modId, originalIndex) => ({ modId, originalIndex })).filter(({ modId }) =>
    modId.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Top Header & Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">Workshop & Mod Load Order</h2>
              {hasUnsavedOrder && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                  Unsaved Order
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Active Mods: <span className="font-mono text-cyan-400 font-bold">{activeMods.length}</span> • Workshop Items: <span className="font-mono text-emerald-400 font-bold">{activeWorkshopItems.length}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {notice && (
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1 rounded-lg animate-fadeIn">
              <Check className="w-3.5 h-3.5" />
              {notice}
            </span>
          )}

          {hasUnsavedOrder && (
            <>
              <button
                onClick={handleResetOrder}
                className="btn btn-secondary btn-sm text-slate-400 hover:text-white"
                title="Discard uncommitted reordering"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Revert</span>
              </button>

              <button
                onClick={() => saveCurrentMods(activeWorkshopItems, activeMods)}
                disabled={saving}
                className="btn btn-primary btn-sm shadow-glow text-white font-bold"
                title="Save current load order to server.ini"
              >
                <Check className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
                <span>Save Load Order</span>
              </button>
            </>
          )}

          <button
            onClick={handleSyncMods}
            disabled={syncing}
            className="btn btn-secondary btn-sm text-cyan-400 hover:text-cyan-300"
            title="Trigger workshop download on dedicated server"
          >
            <FolderSync className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>Sync Mods</span>
          </button>

          <button
            onClick={loadMods}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            title="Reload from server.ini"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: MOD IMPORTERS & FILL TOOL (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 shadow-sm flex flex-col gap-4">
            {/* Mode Navigation Tabs */}
            <div className="flex items-center gap-1 border-b border-[var(--border-subtle)] pb-3 overflow-x-auto">
              <button
                onClick={() => setImportMode('links')}
                className={`btn btn-sm ${importMode === 'links' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Fill by Links</span>
              </button>

              <button
                onClick={() => setImportMode('collection')}
                className={`btn btn-sm ${importMode === 'collection' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Collection</span>
              </button>

              <button
                onClick={() => setImportMode('single')}
                className={`btn btn-sm ${importMode === 'single' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Lookup</span>
              </button>

              <button
                onClick={() => setImportMode('raw')}
                className={`btn btn-sm ${importMode === 'raw' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Raw INI</span>
              </button>
            </div>

            {/* MODE 1: FILL BY LINKS (Direct User Request) */}
            {importMode === 'links' && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-200 block mb-1">
                    Paste Steam Workshop Links or IDs:
                  </label>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Paste one link per line. We will automatically parse the Workshop IDs, lookup their titles, and detect the required Mod IDs.
                  </p>
                  <textarea
                    value={linksText}
                    onChange={(e) => setLinksText(e.target.value)}
                    placeholder={`https://steamcommunity.com/sharedfiles/filedetails/?id=2875848298\nhttps://steamcommunity.com/sharedfiles/filedetails/?id=2392709985\nhttps://steamcommunity.com/sharedfiles/filedetails/?id=2688809268\n2463184726`}
                    rows={6}
                    className="input-textarea text-xs font-mono w-full leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-slate-400 font-mono">
                    {detectedLinksCount > 0 ? (
                      <span className="text-emerald-400 font-semibold">{detectedLinksCount} item(s) detected</span>
                    ) : (
                      'Paste links above'
                    )}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDirectAddLinks}
                      disabled={detectedLinksCount === 0}
                      className="btn btn-secondary btn-sm text-xs"
                      title="Directly append workshop IDs without Steam lookup"
                    >
                      <span>Direct Add</span>
                    </button>

                    <button
                      onClick={handleInspectLinks}
                      disabled={inspectingLinks || detectedLinksCount === 0}
                      className="btn btn-primary btn-sm text-xs shadow-glow"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${inspectingLinks ? 'animate-spin' : ''}`} />
                      <span>{inspectingLinks ? 'Resolving Mods...' : 'Inspect & Auto-Fill'}</span>
                    </button>
                  </div>
                </div>

                {/* Inspected Preview List */}
                {linksInspected && (
                  <div className="border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3.5 rounded-xl flex flex-col gap-3 mt-1 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <CheckCheck className="w-4 h-4 text-emerald-400" />
                          <span>Resolved {linksInspected.items?.length || linksInspected.workshopIds?.length || 0} Workshop Item(s)</span>
                        </h4>
                        <span className="text-[11px] text-slate-400">
                          {selectedInspectItems.size} selected to add
                        </span>
                      </div>

                      <button
                        onClick={applyInspectedLinks}
                        className="btn btn-primary btn-sm text-xs font-bold shadow-glow"
                      >
                        Add {selectedInspectItems.size} to Server
                      </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border-subtle)] text-xs pr-1">
                      {linksInspected.items?.map((item) => (
                        <div key={item.workshopId} className="py-2.5 flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={selectedInspectItems.has(item.workshopId)}
                            onChange={() => toggleSelectInspectItem(item.workshopId)}
                            className="mt-1 rounded border-slate-700 bg-slate-900 text-emerald-500 cursor-pointer"
                          />
                          {item.previewUrl && (
                            <img src={item.previewUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-200 truncate">{item.title}</div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                              <span>ID: {item.workshopId}</span>
                              <a
                                href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${item.workshopId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-400 hover:underline"
                              >
                                <ExternalLink className="w-2.5 h-2.5 inline" />
                              </a>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.modIds?.map((mId) => (
                                <span key={mId} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/50 text-cyan-300 border border-cyan-800/40">
                                  {mId}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODE 2: STEAM COLLECTION */}
            {importMode === 'collection' && (
              <div className="flex flex-col gap-3">
                <form onSubmit={handleFetchCollection} className="flex gap-2">
                  <input
                    type="text"
                    value={collectionUrl}
                    onChange={(e) => setCollectionUrl(e.target.value)}
                    placeholder="Enter Steam Workshop Collection URL or ID..."
                    className="input-text text-xs flex-1"
                  />
                  <button
                    type="submit"
                    disabled={fetchingCollection || !collectionUrl.trim()}
                    className="btn btn-primary btn-sm"
                  >
                    <DownloadCloud className={`w-3.5 h-3.5 ${fetchingCollection ? 'animate-spin' : ''}`} />
                    <span>{fetchingCollection ? 'Fetching...' : 'Fetch'}</span>
                  </button>
                </form>

                {collectionData && (
                  <div className="border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 rounded-xl flex flex-col gap-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white">{collectionData.title}</h4>
                        <span className="text-[11px] text-slate-400">
                          {collectionData.itemCount} items detected
                        </span>
                      </div>
                      <button
                        onClick={importSelectedFromCollection}
                        className="btn btn-primary btn-sm text-xs font-bold"
                      >
                        Add {selectedCollectionItems.size} Mods
                      </button>
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border-subtle)] text-xs">
                      {collectionData.items?.map((item) => (
                        <div key={item.workshopId} className="py-2 flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={selectedCollectionItems.has(item.workshopId)}
                              onChange={() => {
                                const next = new Set(selectedCollectionItems);
                                if (next.has(item.workshopId)) next.delete(item.workshopId);
                                else next.add(item.workshopId);
                                setSelectedCollectionItems(next);
                              }}
                              className="rounded border-slate-700 bg-slate-900 text-emerald-500"
                            />
                            {item.previewUrl && (
                              <img src={item.previewUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-slate-200 truncate">{item.title}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">
                                ID: {item.workshopId} • {item.modIds?.join(', ') || 'Auto'}
                              </div>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODE 3: SINGLE LOOKUP */}
            {importMode === 'single' && (
              <div className="flex flex-col gap-3">
                <form onSubmit={handleFetchSingle} className="flex gap-2">
                  <input
                    type="text"
                    value={singleId}
                    onChange={(e) => setSingleId(e.target.value)}
                    placeholder="Enter Workshop ID or item URL..."
                    className="input-text text-xs flex-1"
                  />
                  <button
                    type="submit"
                    disabled={fetchingSingle || !singleId.trim()}
                    className="btn btn-primary btn-sm"
                  >
                    <span>{fetchingSingle ? 'Searching...' : 'Lookup'}</span>
                  </button>
                </form>

                {singleData && (
                  <div className="border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 rounded-xl flex items-center gap-3 animate-fadeIn">
                    {singleData.previewUrl && (
                      <img src={singleData.previewUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="flex-1 text-xs min-w-0">
                      <h4 className="font-bold text-white text-sm truncate">{singleData.title}</h4>
                      <p className="text-slate-400 font-mono text-[11px] mb-2">Workshop ID: {singleData.workshopId}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {singleData.modIds && singleData.modIds.length > 0 ? (
                          singleData.modIds.map((mId) => (
                            <button
                              key={mId}
                              onClick={() => addSingleMod(mId)}
                              className="btn btn-primary btn-sm text-[11px] py-0.5 px-2"
                            >
                              + Add {mId}
                            </button>
                          ))
                        ) : (
                          <button
                            onClick={() => addSingleMod('')}
                            className="btn btn-primary btn-sm text-[11px]"
                          >
                            + Add to Server
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODE 4: RAW INI STRING EDIT */}
            {importMode === 'raw' && (
              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-300">WorkshopItems=</span>
                    <button
                      onClick={() => copyToClipboard(rawWorkshopInput, 'ws')}
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                    >
                      {copiedType === 'ws' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <textarea
                    value={rawWorkshopInput}
                    onChange={(e) => setRawWorkshopInput(e.target.value)}
                    rows={3}
                    className="input-textarea text-xs font-mono w-full"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-300">Mods= (Load Order)</span>
                    <button
                      onClick={() => copyToClipboard(rawModsInput, 'mods')}
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                    >
                      {copiedType === 'mods' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <textarea
                    value={rawModsInput}
                    onChange={(e) => setRawModsInput(e.target.value)}
                    rows={4}
                    className="input-textarea text-xs font-mono w-full"
                  />
                </div>

                <button
                  onClick={applyRawIniEdit}
                  className="btn btn-primary btn-sm font-bold mt-1"
                >
                  Apply & Save INI Values
                </button>
              </div>
            )}
          </div>

          {/* Configured Workshop IDs Pill Box */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 shadow-sm flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Configured Workshop IDs ({activeWorkshopItems.length})</span>
              </span>
              <button
                onClick={() => copyToClipboard(activeWorkshopItems.join(';'), 'ws_pills')}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                title="Copy all Workshop IDs"
              >
                {copiedType === 'ws_pills' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>Copy All</span>
              </button>
            </div>

            <div className="max-h-36 overflow-y-auto flex flex-wrap gap-1.5 p-1 bg-[var(--bg-card-inner)] border border-[var(--border-subtle)] rounded-lg">
              {activeWorkshopItems.length === 0 ? (
                <div className="text-slate-500 text-xs py-2 px-1">No Workshop IDs configured.</div>
              ) : (
                activeWorkshopItems.map((wsId) => (
                  <span
                    key={wsId}
                    className="inline-flex items-center gap-1 text-[11px] font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded text-slate-300 hover:border-emerald-500/40 transition-colors"
                  >
                    <a
                      href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${wsId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-emerald-400 flex items-center gap-0.5"
                      title="Open in Steam Workshop"
                    >
                      <span>{wsId}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                    <button
                      onClick={() => removeWorkshopItem(wsId)}
                      className="text-slate-500 hover:text-rose-400 ml-0.5"
                      title="Remove workshop item"
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE MODS LOAD ORDER & SORTING (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 shadow-sm flex flex-col h-[760px]">
            {/* Top Toolbar: Search + Quick Sort Tools */}
            <div className="flex flex-col gap-3 mb-3 border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Mod Load Order ({activeMods.length})
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter active mods..."
                    className="input-text text-xs py-1.5 pl-8 pr-3 w-48"
                  />
                </div>
              </div>

              {/* Sorting Actions Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={sortFrameworksFirst}
                    className="btn btn-secondary btn-sm text-[11px] text-amber-300 hover:text-amber-200 border-amber-500/30 bg-amber-500/10"
                    title="Automatically move core frameworks (TsarLib, TrueActions, etc.) to the top"
                  >
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>Frameworks First</span>
                  </button>

                  <button
                    onClick={() => sortAlphabetical(true)}
                    className="btn btn-secondary btn-sm text-[11px]"
                    title="Sort A to Z"
                  >
                    <span>A → Z</span>
                  </button>

                  <button
                    onClick={() => sortAlphabetical(false)}
                    className="btn btn-secondary btn-sm text-[11px]"
                    title="Sort Z to A"
                  >
                    <span>Z → A</span>
                  </button>

                  <button
                    onClick={deduplicateMods}
                    className="btn btn-secondary btn-sm text-[11px] text-slate-300 hover:text-white"
                    title="Remove any duplicate mod IDs"
                  >
                    <span>Deduplicate</span>
                  </button>
                </div>

                <span className="text-[11px] text-slate-400">
                  Drag items or use ▲/▼ to order
                </span>
              </div>
            </div>

            {/* Draggable Active Mods List */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1">
              {filteredMods.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs">
                  {searchFilter ? 'No mods match your filter.' : 'No active mods configured in server.ini.'}
                </div>
              ) : (
                filteredMods.map(({ modId, originalIndex }) => {
                  const isFramework = KNOWN_FRAMEWORKS.some((fw) => modId.toLowerCase().includes(fw));
                  const isDragging = draggedIndex === originalIndex;
                  const isDragOver = dragOverIndex === originalIndex;

                  return (
                    <div
                      key={`${modId}-${originalIndex}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, originalIndex)}
                      onDragOver={(e) => handleDragOver(e, originalIndex)}
                      onDrop={(e) => handleDrop(e, originalIndex)}
                      onDragEnd={handleDragEnd}
                      className={`mod-item-row group flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg border text-xs bg-[var(--bg-primary)] ${
                        isDragging ? 'is-dragging' : ''
                      } ${isDragOver ? 'is-drag-over' : 'border-[var(--border-subtle)]'} hover:border-slate-600/60`}
                    >
                      {/* Left: Drag Grip + Position # + Mod ID */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="cursor-grab active:cursor-grabbing text-slate-600 group-hover:text-slate-400">
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>

                        <span className="font-mono text-[11px] text-slate-500 w-6 text-right shrink-0">
                          #{originalIndex + 1}
                        </span>

                        <span className="font-mono text-slate-200 font-medium truncate">
                          {modId}
                        </span>

                        {isFramework && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                            Framework
                          </span>
                        )}
                      </div>

                      {/* Right: Reorder Buttons + Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => moveModToTop(originalIndex)}
                          disabled={originalIndex === 0}
                          className="p-1 hover:text-cyan-400 text-slate-500 disabled:opacity-20 rounded"
                          title="Move to Top"
                        >
                          <ChevronsUp className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => moveMod(originalIndex, originalIndex - 1)}
                          disabled={originalIndex === 0}
                          className="p-1 hover:text-cyan-400 text-slate-500 disabled:opacity-20 rounded"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => moveMod(originalIndex, originalIndex + 1)}
                          disabled={originalIndex === activeMods.length - 1}
                          className="p-1 hover:text-cyan-400 text-slate-500 disabled:opacity-20 rounded"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => moveModToBottom(originalIndex)}
                          disabled={originalIndex === activeMods.length - 1}
                          className="p-1 hover:text-cyan-400 text-slate-500 disabled:opacity-20 rounded"
                          title="Move to Bottom"
                        >
                          <ChevronsDown className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => removeMod(modId)}
                          className="p-1 hover:text-rose-400 text-slate-600 hover:bg-rose-950/30 rounded ml-1"
                          title="Remove Mod"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Sticky Save Prompt */}
            {hasUnsavedOrder && (
              <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between bg-amber-500/5 -mx-4 -mb-4 p-3 rounded-b-xl border-amber-500/20">
                <span className="text-xs text-amber-300 flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  Load order modified. Don't forget to save!
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetOrder}
                    className="btn btn-secondary btn-sm text-xs"
                  >
                    Discard
                  </button>
                  <button
                    onClick={() => saveCurrentMods(activeWorkshopItems, activeMods)}
                    disabled={saving}
                    className="btn btn-primary btn-sm text-xs font-bold shadow-glow"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
