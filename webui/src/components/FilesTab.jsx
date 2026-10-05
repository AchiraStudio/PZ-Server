import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FolderPlus,
  File,
  FileText,
  FileCode,
  FilePlus,
  Upload,
  Download,
  Trash2,
  Edit3,
  RefreshCw,
  ChevronRight,
  Home,
  Save,
  X,
  AlertCircle,
  Archive,
  Database,
  Check,
  CheckSquare,
  Square,
  AlertTriangle
} from 'lucide-react';
import { filesApi } from '../services/api';

export default function FilesTab() {
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Multi-Selection State for Batch Actions
  const [selectedPaths, setSelectedPaths] = useState(new Set());

  // Editor Modal State
  const [editingFile, setEditingFile] = useState(null); // { path, name, content, originalContent }
  const [savingFile, setSavingFile] = useState(false);
  const [deletingInEditor, setDeletingInEditor] = useState(false);
  const [editorNotice, setEditorNotice] = useState(null);

  // Action Modals State
  const [createModal, setCreateModal] = useState({ open: false, type: 'file', name: '' });
  const [renameModal, setRenameModal] = useState({ open: false, oldPath: '', newName: '' });
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    targetPath: '',
    name: '',
    isDir: false,
    isBatch: false,
    batchPaths: []
  });

  const fileInputRef = useRef(null);

  // Load directory items
  const loadDirectory = async (pathToGo = currentPath) => {
    setLoading(true);
    setError(null);
    setSelectedPaths(new Set());
    try {
      const data = await filesApi.list(pathToGo);
      setItems(data.items || []);
      setCurrentPath(data.currentPath || '/');
    } catch (err) {
      console.error('Failed to load directory', err);
      setError(err.message || 'Failed to list directory contents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory(currentPath);
  }, []);

  // Keyboard shortcut Ctrl+S inside editor
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && editingFile) {
        e.preventDefault();
        saveCurrentFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingFile]);

  // Open file for editing
  const openEditor = async (filePath) => {
    setLoading(true);
    try {
      const fileData = await filesApi.read(filePath);
      setEditingFile({
        path: fileData.path,
        name: fileData.name,
        content: fileData.content,
        originalContent: fileData.content,
        size: fileData.size
      });
      setEditorNotice(null);
    } catch (err) {
      alert(`Cannot open file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Save edited file
  const saveCurrentFile = async () => {
    if (!editingFile) return;
    setSavingFile(true);
    try {
      await filesApi.write(editingFile.path, editingFile.content);
      setEditingFile((prev) => ({ ...prev, originalContent: prev.content }));
      setEditorNotice('Saved successfully!');
      setTimeout(() => setEditorNotice(null), 3000);
      loadDirectory(currentPath);
    } catch (err) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSavingFile(false);
    }
  };

  // Delete currently open file in editor
  const handleDeleteCurrentEditingFile = async () => {
    if (!editingFile) return;
    if (!confirm(`Are you sure you want to permanently delete "${editingFile.name}"?`)) return;

    setDeletingInEditor(true);
    try {
      await filesApi.delete(editingFile.path);
      setEditingFile(null);
      setNotice(`Deleted "${editingFile.name}"`);
      setTimeout(() => setNotice(null), 3500);
      loadDirectory(currentPath);
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingInEditor(false);
    }
  };

  // Close editor
  const closeEditor = () => {
    if (editingFile && editingFile.content !== editingFile.originalContent) {
      if (!confirm('You have unsaved changes. Discard them?')) {
        return;
      }
    }
    setEditingFile(null);
  };

  // Multi-selection helpers
  const toggleSelect = (path) => {
    const next = new Set(selectedPaths);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setSelectedPaths(next);
  };

  const isAllSelected = items.length > 0 && items.every((i) => selectedPaths.has(i.path));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(items.map((i) => i.path)));
    }
  };

  // Open single delete modal
  const openSingleDeleteModal = (item) => {
    setDeleteModal({
      open: true,
      targetPath: item.path,
      name: item.name,
      isDir: item.isDir,
      isBatch: false,
      batchPaths: []
    });
  };

  // Open batch delete modal
  const openBatchDeleteModal = () => {
    if (selectedPaths.size === 0) return;
    const pathsArray = Array.from(selectedPaths);
    const hasDir = items.some((i) => selectedPaths.has(i.path) && i.isDir);

    setDeleteModal({
      open: true,
      targetPath: '',
      name: `${pathsArray.length} items`,
      isDir: hasDir,
      isBatch: true,
      batchPaths: pathsArray
    });
  };

  // Delete item or batch items
  const handleDeleteConfirm = async () => {
    try {
      if (deleteModal.isBatch) {
        await filesApi.batchDelete(deleteModal.batchPaths);
        setNotice(`Successfully deleted ${deleteModal.batchPaths.length} item(s)!`);
      } else {
        await filesApi.delete(deleteModal.targetPath);
        setNotice(`Successfully deleted ${deleteModal.isDir ? 'directory' : 'file'} "${deleteModal.name}"!`);
      }
      setTimeout(() => setNotice(null), 3500);
      setDeleteModal({ open: false, targetPath: '', name: '', isDir: false, isBatch: false, batchPaths: [] });
      setSelectedPaths(new Set());
      loadDirectory(currentPath);
    } catch (err) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  // Create file or folder
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const name = createModal.name.trim();
    if (!name) return;

    const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    try {
      if (createModal.type === 'folder') {
        await filesApi.mkdir(fullPath);
        setNotice(`Created folder "${name}"`);
      } else {
        await filesApi.createFile(fullPath);
        setNotice(`Created file "${name}"`);
      }
      setTimeout(() => setNotice(null), 3500);
      setCreateModal({ open: false, type: 'file', name: '' });
      await loadDirectory(currentPath);

      if (createModal.type === 'file') {
        openEditor(fullPath);
      }
    } catch (err) {
      alert(`Failed to create ${createModal.type}: ${err.message}`);
    }
  };

  // Rename item
  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    const newName = renameModal.newName.trim();
    if (!newName) return;

    const parentDir = currentPath === '/' ? '' : currentPath;
    const newPath = `${parentDir}/${newName}`;

    try {
      await filesApi.rename(renameModal.oldPath, newPath);
      setRenameModal({ open: false, oldPath: '', newName: '' });
      setNotice(`Renamed to "${newName}"`);
      setTimeout(() => setNotice(null), 3500);
      loadDirectory(currentPath);
    } catch (err) {
      alert(`Failed to rename: ${err.message}`);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      await filesApi.upload(file, currentPath);
      setNotice(`Uploaded "${file.name}"`);
      setTimeout(() => setNotice(null), 3500);
      loadDirectory(currentPath);
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Format file size
  const formatSize = (bytes) => {
    if (bytes === undefined || bytes === null) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Icon selector by file extension
  const getFileIcon = (item) => {
    if (item.isDir) return <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20" />;
    const ext = item.name.split('.').pop().toLowerCase();
    if (['lua', 'ini', 'cfg', 'json', 'sh', 'js'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-cyan-400" />;
    }
    if (['zip', 'tar', 'gz'].includes(ext)) {
      return <Archive className="w-4 h-4 text-purple-400" />;
    }
    if (['db', 'sqlite'].includes(ext)) {
      return <Database className="w-4 h-4 text-emerald-400" />;
    }
    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  const isEditable = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    return ['ini', 'lua', 'txt', 'json', 'cfg', 'sh', 'log', 'env'].includes(ext);
  };

  // Breadcrumbs builder
  const pathParts = currentPath.split('/').filter(Boolean);
  const breadcrumbs = [
    { label: 'data', path: '/' },
    ...pathParts.map((part, index) => ({
      label: part,
      path: '/' + pathParts.slice(0, index + 1).join('/')
    }))
  ];

  const shortcuts = [
    { label: 'Server Configs', path: '/Zomboid/Server' },
    { label: 'Save Worlds', path: '/Zomboid/Saves' },
    { label: 'Mods', path: '/Zomboid/mods' },
    { label: 'Backups', path: '/backups' },
    { label: 'Root (/data)', path: '/' }
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Top Shortcuts & Primary Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3 rounded-xl shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold mr-1">Shortcuts:</span>
          {shortcuts.map((sc) => (
            <button
              key={sc.path}
              onClick={() => loadDirectory(sc.path)}
              className={`btn btn-sm text-xs py-1 px-2.5 ${
                currentPath === sc.path ? 'btn-primary font-bold shadow-glow' : 'btn-secondary hover:border-emerald-500/40'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-auto">
          {notice && (
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1 rounded-lg animate-fadeIn">
              <Check className="w-3.5 h-3.5" />
              {notice}
            </span>
          )}

          <button
            onClick={() => setCreateModal({ open: true, type: 'file', name: '' })}
            className="btn btn-secondary btn-sm"
          >
            <FilePlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>New File</span>
          </button>

          <button
            onClick={() => setCreateModal({ open: true, type: 'folder', name: '' })}
            className="btn btn-secondary btn-sm"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>New Folder</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary btn-sm"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Upload</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={() => loadDirectory(currentPath)}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Breadcrumb Navigation Path & Bulk Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-primary)] border border-[var(--border-subtle)] px-4 py-2.5 rounded-xl text-xs">
        {/* Left: Breadcrumbs */}
        <div className="flex items-center gap-1.5 font-mono">
          <Home className="w-3.5 h-3.5 text-slate-500" />
          {breadcrumbs.map((b, idx) => (
            <React.Fragment key={b.path}>
              {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-600" />}
              <button
                onClick={() => loadDirectory(b.path)}
                className={`hover:text-emerald-400 transition-colors ${
                  idx === breadcrumbs.length - 1 ? 'text-emerald-400 font-bold' : 'text-slate-400'
                }`}
              >
                {b.label}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Right: Multi-select Action Bar */}
        {selectedPaths.size > 0 && (
          <div className="flex items-center gap-2 bg-rose-950/30 border border-rose-500/30 px-3 py-1 rounded-lg animate-fadeIn">
            <span className="text-xs text-rose-300 font-semibold">
              {selectedPaths.size} item(s) selected
            </span>

            <button
              onClick={() => setSelectedPaths(new Set())}
              className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded"
            >
              Deselect All
            </button>

            <button
              onClick={openBatchDeleteModal}
              className="btn btn-danger btn-sm text-xs py-1 px-2.5 flex items-center gap-1.5 font-bold shadow-sm"
              title="Delete all selected files and folders"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedPaths.size})</span>
            </button>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Directory Contents Table */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-md">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500 cursor-pointer"
                  title="Select / Deselect All"
                />
              </th>
              <th className="py-2.5 px-3">Name</th>
              <th className="py-2.5 px-4 w-28">Size</th>
              <th className="py-2.5 px-4 w-44">Last Modified</th>
              <th className="py-2.5 px-4 w-36 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {/* Go Up Directory Row if not root */}
            {currentPath !== '/' && (
              <tr
                onClick={() => {
                  const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
                  loadDirectory(parent);
                }}
                className="hover:bg-white/[0.03] cursor-pointer text-slate-400"
              >
                <td className="py-2.5 px-3"></td>
                <td colSpan={4} className="py-2.5 px-3 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-amber-400/60" />
                  <span className="font-mono text-xs">.. (Parent Directory)</span>
                </td>
              </tr>
            )}

            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500">
                  This directory is empty.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isSelected = selectedPaths.has(item.path);

                return (
                  <tr
                    key={item.path}
                    className={`hover:bg-white/[0.03] transition-colors group ${
                      isSelected ? 'bg-emerald-500/5' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.path)}
                        className="rounded border-slate-700 bg-slate-900 text-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* Name & Icon */}
                    <td className="py-2.5 px-3">
                      <div
                        onClick={() => {
                          if (item.isDir) {
                            loadDirectory(item.path);
                          } else if (isEditable(item.name)) {
                            openEditor(item.path);
                          }
                        }}
                        className="flex items-center gap-2.5 cursor-pointer"
                      >
                        {getFileIcon(item)}
                        <span
                          className={`font-mono text-slate-200 group-hover:text-emerald-400 transition-colors truncate ${
                            item.isDir ? 'font-semibold' : ''
                          }`}
                        >
                          {item.name}
                        </span>
                      </div>
                    </td>

                    {/* Size */}
                    <td className="py-2.5 px-4 font-mono text-slate-400">
                      {item.isDir ? '<DIR>' : formatSize(item.size)}
                    </td>

                    {/* Last Modified */}
                    <td className="py-2.5 px-4 text-slate-400">
                      {item.mtime ? new Date(item.mtime).toLocaleString() : '-'}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        {!item.isDir && isEditable(item.name) && (
                          <button
                            onClick={() => openEditor(item.path)}
                            className="p-1 hover:text-emerald-400 text-slate-400 rounded hover:bg-white/5"
                            title="Edit File"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {!item.isDir && (
                          <a
                            href={filesApi.getDownloadUrl(item.path)}
                            download={item.name}
                            className="p-1 hover:text-cyan-400 text-slate-400 rounded hover:bg-white/5"
                            title="Download File"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          onClick={() => setRenameModal({ open: true, oldPath: item.path, newName: item.name })}
                          className="p-1 hover:text-amber-400 text-slate-400 rounded hover:bg-white/5"
                          title="Rename"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* DELETE BUTTON (Clear & Red Tint on Hover) */}
                        <button
                          onClick={() => openSingleDeleteModal(item)}
                          className="p-1 hover:text-rose-400 text-slate-400 rounded hover:bg-rose-950/40 transition-colors"
                          title={`Delete ${item.isDir ? 'Folder' : 'File'}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* In-Browser Code Editor Modal */}
      {editingFile && (
        <div className="modal-overlay">
          <div className="modal-content max-w-5xl h-[85vh] flex flex-col">
            {/* Editor Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
              <div className="flex items-center gap-3">
                <FileCode className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white font-mono">{editingFile.name}</h3>
                  <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                    <span>{editingFile.path}</span>
                    <span>•</span>
                    <span>{formatSize(editingFile.size)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {editorNotice && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1 animate-fadeIn">
                    <Check className="w-3.5 h-3.5" />
                    {editorNotice}
                  </span>
                )}

                <button
                  onClick={saveCurrentFile}
                  disabled={savingFile}
                  className="btn btn-primary btn-sm font-semibold"
                  title="Save (Ctrl+S)"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingFile ? 'Saving...' : 'Save (Ctrl+S)'}</span>
                </button>

                {/* Direct Delete from Editor */}
                <button
                  onClick={handleDeleteCurrentEditingFile}
                  disabled={deletingInEditor}
                  className="btn btn-danger btn-sm text-xs font-semibold"
                  title="Delete this file"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deletingInEditor ? 'Deleting...' : 'Delete File'}</span>
                </button>

                <button
                  onClick={closeEditor}
                  className="btn btn-ghost btn-sm text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Editor Textarea */}
            <div className="flex-1 p-2 bg-[#060a12] overflow-hidden flex flex-col">
              <textarea
                value={editingFile.content}
                onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                className="flex-1 w-full bg-transparent text-slate-100 font-mono text-xs leading-relaxed p-3 outline-none resize-none border-none select-text"
                spellCheck="false"
                autoFocus
              />
            </div>

            {/* Editor Footer */}
            <div className="px-4 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[11px] text-slate-400 flex items-center justify-between">
              <span>Lines: {editingFile.content.split('\n').length}</span>
              <span className="text-slate-500 font-mono">UTF-8 • Project Zomboid Dedicated Server File</span>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {createModal.open && (
        <div className="modal-overlay">
          <form onSubmit={handleCreateSubmit} className="modal-content max-w-md p-5">
            <h3 className="text-base font-bold text-white mb-3">
              Create New {createModal.type === 'folder' ? 'Folder' : 'File'}
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Location: <span className="font-mono text-emerald-400">{currentPath}</span>
            </p>
            <input
              type="text"
              value={createModal.name}
              onChange={(e) => setCreateModal({ ...createModal, name: e.target.value })}
              placeholder={createModal.type === 'folder' ? 'folder_name' : 'filename.ini'}
              className="input-text text-sm mb-4"
              autoFocus
              required
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateModal({ open: false, type: 'file', name: '' })}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal.open && (
        <div className="modal-overlay">
          <form onSubmit={handleRenameSubmit} className="modal-content max-w-md p-5">
            <h3 className="text-base font-bold text-white mb-3">Rename Item</h3>
            <input
              type="text"
              value={renameModal.newName}
              onChange={(e) => setRenameModal({ ...renameModal, newName: e.target.value })}
              className="input-text text-sm mb-4"
              autoFocus
              required
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameModal({ open: false, oldPath: '', newName: '' })}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Rename
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal (Supports both single item and batch delete) */}
      {deleteModal.open && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md p-5 border border-rose-500/30">
            <h3 className="text-base font-bold text-rose-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>Confirm Permanent Deletion</span>
            </h3>

            {deleteModal.isBatch ? (
              <div>
                <p className="text-xs text-slate-300 mb-2">
                  Are you sure you want to permanently delete the following <span className="font-bold text-rose-300">{deleteModal.batchPaths.length} items</span>?
                </p>
                {deleteModal.isDir && (
                  <p className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded mb-3">
                    Warning: Some selected items are folders. All contents inside them will also be deleted!
                  </p>
                )}
                <div className="max-h-36 overflow-y-auto bg-black/30 border border-white/10 rounded p-2 text-xs font-mono text-slate-300 divide-y divide-white/5 mb-4">
                  {deleteModal.batchPaths.map((p) => (
                    <div key={p} className="py-1 truncate">
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-300 mb-2">
                  Are you sure you want to permanently delete this {deleteModal.isDir ? 'directory and all its contents' : 'file'}?
                </p>
                <div className="p-2.5 rounded bg-black/30 border border-white/10 font-mono text-xs text-rose-300 break-all mb-4">
                  {deleteModal.targetPath}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteModal({ open: false, targetPath: '', name: '', isDir: false, isBatch: false, batchPaths: [] })}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="btn btn-danger btn-sm font-bold shadow-sm"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
