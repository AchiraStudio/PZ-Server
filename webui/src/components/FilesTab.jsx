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
  Check
} from 'lucide-react';
import { filesApi } from '../services/api';

export default function FilesTab() {
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Editor Modal State
  const [editingFile, setEditingFile] = useState(null); // { path, name, content, originalContent }
  const [savingFile, setSavingFile] = useState(false);
  const [editorNotice, setEditorNotice] = useState(null);

  // Action Modals State
  const [createModal, setCreateModal] = useState({ open: false, type: 'file', name: '' });
  const [renameModal, setRenameModal] = useState({ open: false, oldPath: '', newName: '' });
  const [deleteModal, setDeleteModal] = useState({ open: false, targetPath: '', isDir: false });
  const fileInputRef = useRef(null);

  // Load directory items
  const loadDirectory = async (pathToGo = currentPath) => {
    setLoading(true);
    setError(null);
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

  // Close editor
  const closeEditor = () => {
    if (editingFile && editingFile.content !== editingFile.originalContent) {
      if (!confirm('You have unsaved changes. Discard them?')) {
        return;
      }
    }
    setEditingFile(null);
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
      } else {
        await filesApi.createFile(fullPath);
      }
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
      loadDirectory(currentPath);
    } catch (err) {
      alert(`Failed to rename: ${err.message}`);
    }
  };

  // Delete item
  const handleDeleteConfirm = async () => {
    try {
      await filesApi.delete(deleteModal.targetPath);
      setDeleteModal({ open: false, targetPath: '', isDir: false });
      loadDirectory(currentPath);
    } catch (err) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      await filesApi.upload(file, currentPath);
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
      {/* Top Shortcuts Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3 rounded-xl">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold mr-1">Shortcuts:</span>
          {shortcuts.map((sc) => (
            <button
              key={sc.path}
              onClick={() => loadDirectory(sc.path)}
              className={`btn btn-sm text-xs py-1 px-2.5 ${
                currentPath === sc.path
                  ? 'btn-primary'
                  : 'btn-secondary hover:border-emerald-500/40'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-auto">
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

      {/* Breadcrumb Navigation Path */}
      <div className="flex items-center gap-1.5 bg-[var(--bg-primary)] border border-[var(--border-subtle)] px-4 py-2 rounded-xl text-xs font-mono">
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
              <th className="py-2.5 px-4">Name</th>
              <th className="py-2.5 px-4 w-28">Size</th>
              <th className="py-2.5 px-4 w-44">Last Modified</th>
              <th className="py-2.5 px-4 w-32 text-right">Actions</th>
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
                <td colSpan={4} className="py-2.5 px-4 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-amber-400/60" />
                  <span className="font-mono text-xs">.. (Parent Directory)</span>
                </td>
              </tr>
            )}

            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500">
                  This directory is empty.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.path}
                  className="hover:bg-white/[0.03] transition-colors group"
                >
                  <td className="py-2.5 px-4">
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
                      <span className={`font-mono text-slate-200 group-hover:text-emerald-400 transition-colors ${
                        item.isDir ? 'font-semibold' : ''
                      }`}>
                        {item.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-400">
                    {item.isDir ? '<DIR>' : formatSize(item.size)}
                  </td>
                  <td className="py-2.5 px-4 text-slate-400">
                    {item.mtime ? new Date(item.mtime).toLocaleString() : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      {!item.isDir && isEditable(item.name) && (
                        <button
                          onClick={() => openEditor(item.path)}
                          className="p-1 hover:text-emerald-400 text-slate-400 rounded"
                          title="Edit File"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {!item.isDir && (
                        <a
                          href={filesApi.getDownloadUrl(item.path)}
                          download={item.name}
                          className="p-1 hover:text-cyan-400 text-slate-400 rounded"
                          title="Download File"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}

                      <button
                        onClick={() => setRenameModal({ open: true, oldPath: item.path, newName: item.name })}
                        className="p-1 hover:text-amber-400 text-slate-400 rounded"
                        title="Rename"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setDeleteModal({ open: true, targetPath: item.path, isDir: item.isDir })}
                        className="p-1 hover:text-rose-400 text-slate-400 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
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
                  className="btn btn-primary btn-sm"
                  title="Save (Ctrl+S)"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingFile ? 'Saving...' : 'Save (Ctrl+S)'}</span>
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
              <span className="text-slate-500 font-mono">UTF-8 • Project Zomboid Config</span>
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

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md p-5">
            <h3 className="text-base font-bold text-rose-400 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Confirm Deletion
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              Are you sure you want to delete this {deleteModal.isDir ? 'directory and all its contents' : 'file'}?
              <br />
              <span className="font-mono text-rose-300 break-all mt-1 block">{deleteModal.targetPath}</span>
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteModal({ open: false, targetPath: '', isDir: false })}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="btn btn-danger btn-sm"
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
