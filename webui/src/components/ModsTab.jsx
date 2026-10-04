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
  Link,
  ClipboardList
} from 'lucide-react';
import { modsApi, serverApi } from '../services/api';

export default function ModsTab() {
  const [activeWorkshopItems, setActiveWorkshopItems] = useState([]);
  const [activeMods, setActiveMods] = useState([]);
  const [installedMods, setInstalledMods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Importer Mode: 'collection', 'single', 'bulk'
  const [importMode, setImportMode] = useState('collection');

  // Mode 1: Collection
  const [collectionUrl, setCollectionUrl] = useState('');
  const [collectionData, setCollectionData] = useState(null);
  const [fetchingCollection, setFetchingCollection] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());

  // Mode 2: Single Item
  const [singleId, setSingleId] = useState('');
  const [singleData, setSingleData] = useState(null);
  const [fetchingSingle, setFetchingSingle] = useState(false);

  // Mode 3: Bulk Text
  const [bulkText, setBulkText] = useState('');
  const [bulkParsed, setBulkParsed] = useState(null);
  const [parsingBulk, setParsingBulk] = useState(false);

  const loadMods = async () => {
    setLoading(true);
    try {
      const data = await modsApi.getMods();
      setActiveWorkshopItems(data.workshopItems || []);
      setActiveMods(data.mods || []);
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

  const saveCurrentMods = async (wsItems = activeWorkshopItems, mods = activeMods) => {
    setSaving(true);
    try {
      await modsApi.saveMods(wsItems, mods);
      setNotice('Mod configuration saved to server.ini!');
      setTimeout(() => setNotice(null), 3000);
      loadMods();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const removeMod = (modIdToRemove) => {
    const updated = activeMods.filter((m) => m !== modIdToRemove);
    setActiveMods(updated);
    saveCurrentMods(activeWorkshopItems, updated);
  };

  const removeWorkshopItem = (wsIdToRemove) => {
    const updated = activeWorkshopItems.filter((w) => w !== wsIdToRemove);
    setActiveWorkshopItems(updated);
    saveCurrentMods(updated, activeMods);
  };

  const handleSyncMods = async () => {
    setSyncing(true);
    try {
      await serverApi.syncMods();
      alert('Mod synchronization started on server!');
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // 1. Fetch Steam Collection
  const handleFetchCollection = async (e) => {
    e.preventDefault();
    if (!collectionUrl.trim()) return;
    setFetchingCollection(true);
    setCollectionData(null);
    setSelectedItems(new Set());
    try {
      const res = await modsApi.fetchCollection(collectionUrl);
      setCollectionData(res);
      // Pre-select all items by default
      const allIds = new Set(res.items.map((i) => i.workshopId));
      setSelectedItems(allIds);
    } catch (err) {
      alert(`Failed to fetch collection: ${err.message}`);
    } finally {
      setFetchingCollection(false);
    }
  };

  const toggleSelectItem = (id) => {
    const next = new Set(selectedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItems(next);
  };

  const importSelectedFromCollection = async () => {
    if (!collectionData) return;
    const toImport = [];
    for (const item of collectionData.items) {
      if (selectedItems.has(item.workshopId)) {
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
      setNotice(`Added ${toImport.length} mods to server!`);
      setTimeout(() => setNotice(null), 3000);
      setCollectionData(null);
      setCollectionUrl('');
      loadMods();
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
  };

  // 2. Fetch Single Item
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
      setTimeout(() => setNotice(null), 3000);
      setSingleData(null);
      setSingleId('');
      loadMods();
    } catch (err) {
      alert(`Add failed: ${err.message}`);
    }
  };

  // 3. Bulk Text Parse
  const handleParseBulk = async () => {
    if (!bulkText.trim()) return;
    setParsingBulk(true);
    try {
      const res = await modsApi.parseBulk(bulkText);
      setBulkParsed(res);
    } catch (err) {
      alert(`Parse failed: ${err.message}`);
    } finally {
      setParsingBulk(false);
    }
  };

  const applyBulkParsed = async () => {
    if (!bulkParsed) return;
    const toImport = [];

    // Pair items if details available
    if (bulkParsed.items && bulkParsed.items.length > 0) {
      for (const item of bulkParsed.items) {
        if (item.modIds && item.modIds.length > 0) {
          for (const mId of item.modIds) {
            toImport.push({ workshopId: item.workshopId, modId: mId });
          }
        } else {
          toImport.push({ workshopId: item.workshopId, modId: '' });
        }
      }
    } else {
      // Just raw IDs
      for (const wsId of bulkParsed.workshopIds) {
        toImport.push({ workshopId: wsId, modId: '' });
      }
      for (const modId of bulkParsed.modIds) {
        toImport.push({ workshopId: '', modId });
      }
    }

    try {
      await modsApi.bulkAdd(toImport);
      setNotice(`Imported bulk items!`);
      setTimeout(() => setNotice(null), 3000);
      setBulkParsed(null);
      setBulkText('');
      loadMods();
    } catch (err) {
      alert(`Bulk add failed: ${err.message}`);
    }
  };

  const filteredMods = activeMods.filter((m) =>
    m.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Top Header & Sync Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3.5 rounded-xl">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" />
              <span>Workshop & Mod Manager</span>
            </div>
            <p className="text-xs text-slate-400">
              Active Workshop Items: <span className="font-mono text-emerald-400 font-bold">{activeWorkshopItems.length}</span> • Active Mods: <span className="font-mono text-cyan-400 font-bold">{activeMods.length}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {notice && (
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 animate-fadeIn">
              <Check className="w-3.5 h-3.5" />
              {notice}
            </span>
          )}

          <button
            onClick={handleSyncMods}
            disabled={syncing}
            className="btn btn-secondary btn-sm text-cyan-400 hover:text-cyan-300"
            title="Download mods on server"
          >
            <FolderSync className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>Sync Mods</span>
          </button>

          <button
            onClick={loadMods}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid: Left = Importer / Right = Active Mods */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: MOD IMPORTERS (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 shadow-sm">
            {/* Importer Mode Tabs */}
            <div className="flex items-center gap-2 mb-4 border-b border-[var(--border-subtle)] pb-3">
              <button
                onClick={() => setImportMode('collection')}
                className={`btn btn-sm ${importMode === 'collection' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Steam Collection</span>
              </button>

              <button
                onClick={() => setImportMode('single')}
                className={`btn btn-sm ${importMode === 'single' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Single Mod</span>
              </button>

              <button
                onClick={() => setImportMode('bulk')}
                className={`btn btn-sm ${importMode === 'bulk' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Bulk Paste</span>
              </button>
            </div>

            {/* 1. STEAM COLLECTION IMPORTER */}
            {importMode === 'collection' && (
              <div>
                <form onSubmit={handleFetchCollection} className="flex gap-2 mb-3">
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
                    <span>{fetchingCollection ? 'Fetching...' : 'Fetch Collection'}</span>
                  </button>
                </form>

                {collectionData && (
                  <div className="border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 rounded-xl flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white">{collectionData.title}</h4>
                        <span className="text-[11px] text-slate-400">
                          {collectionData.itemCount} items detected
                        </span>
                      </div>
                      <button
                        onClick={importSelectedFromCollection}
                        className="btn btn-primary btn-sm text-xs"
                      >
                        Add {selectedItems.size} Selected Mods
                      </button>
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border-subtle)] text-xs">
                      {collectionData.items.map((item) => (
                        <div key={item.workshopId} className="py-2 flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={selectedItems.has(item.workshopId)}
                              onChange={() => toggleSelectItem(item.workshopId)}
                              className="rounded border-slate-700 bg-slate-900 text-emerald-500"
                            />
                            {item.previewUrl && (
                              <img src={item.previewUrl} alt="" className="w-7 h-7 rounded object-cover" />
                            )}
                            <div>
                              <div className="font-semibold text-slate-200">{item.title}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                ID: {item.workshopId} • ModIDs: {item.modIds?.join(', ') || 'Auto'}
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

            {/* 2. SINGLE MOD IMPORTER */}
            {importMode === 'single' && (
              <div>
                <form onSubmit={handleFetchSingle} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={singleId}
                    onChange={(e) => setSingleId(e.target.value)}
                    placeholder="Enter Workshop ID or Workshop URL..."
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
                  <div className="border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 rounded-xl flex items-center gap-3">
                    {singleData.previewUrl && (
                      <img src={singleData.previewUrl} alt="" className="w-14 h-14 rounded-lg object-cover" />
                    )}
                    <div className="flex-1 text-xs">
                      <h4 className="font-bold text-white text-sm">{singleData.title}</h4>
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

            {/* 3. BULK PASTE IMPORTER */}
            {importMode === 'bulk' && (
              <div>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="Paste raw text containing Workshop ID: 123456 or Mod ID: MyModName..."
                  rows={4}
                  className="input-textarea text-xs font-mono mb-2"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={handleParseBulk}
                    disabled={parsingBulk || !bulkText.trim()}
                    className="btn btn-secondary btn-sm"
                  >
                    <span>Parse Text</span>
                  </button>

                  {bulkParsed && (
                    <button
                      onClick={applyBulkParsed}
                      className="btn btn-primary btn-sm"
                    >
                      <span>Add {bulkParsed.workshopIds?.length || 0} Workshop Items & {bulkParsed.modIds?.length || 0} Mods</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE MODS LIST (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 shadow-sm flex flex-col h-[600px]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Configured Mod IDs ({activeMods.length})
              </span>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search active mods..."
                className="input-text text-xs py-1 px-2.5 w-44"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
              {filteredMods.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No active mods matching filter.
                </div>
              ) : (
                filteredMods.map((modId) => (
                  <div key={modId} className="py-2 px-1 flex items-center justify-between gap-2 hover:bg-white/[0.02]">
                    <span className="font-mono text-xs text-slate-200">{modId}</span>
                    <button
                      onClick={() => removeMod(modId)}
                      className="p-1 hover:text-rose-400 text-slate-500 rounded"
                      title="Remove Mod"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Workshop IDs section */}
            <div className="border-t border-[var(--border-subtle)] pt-3 mt-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                Configured Workshop IDs ({activeWorkshopItems.length})
              </span>
              <div className="max-h-28 overflow-y-auto flex flex-wrap gap-1.5">
                {activeWorkshopItems.map((wsId) => (
                  <span
                    key={wsId}
                    className="inline-flex items-center gap-1 text-[11px] font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded text-slate-300"
                  >
                    <span>{wsId}</span>
                    <button
                      onClick={() => removeWorkshopItem(wsId)}
                      className="text-slate-500 hover:text-rose-400"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
