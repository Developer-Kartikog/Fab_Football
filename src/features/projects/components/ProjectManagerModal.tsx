import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Copy, Download, FilePlus2, FolderOpen, Trash2, Upload, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MAX_IMPORT_JSON_BYTES, serializeProjectToJson } from '@/services/import-export/projectJson';
import { useTacticalStore } from '@/store/useTacticalStore';

interface ProjectManagerModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProjectManagerModal({ open, onClose }: ProjectManagerModalProps) {
  const project = useTacticalStore((s) => s.project);
  const savedProjects = useTacticalStore((s) => s.savedProjects);
  const createNewProject = useTacticalStore((s) => s.createNewProject);
  const openProject = useTacticalStore((s) => s.openProject);
  const duplicateCurrentProject = useTacticalStore((s) => s.duplicateCurrentProject);
  const deleteProject = useTacticalStore((s) => s.deleteProject);
  const importProjectJson = useTacticalStore((s) => s.importProjectJson);

  const [newName, setNewName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setImportError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || pendingDeleteId) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, pendingDeleteId, onClose]);

  if (!open) return null;

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    await createNewProject(newName.trim() || undefined);
    setNewName('');
    onClose();
  };

  const handleExportJson = () => {
    const json = serializeProjectToJson(project);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    a.href = url;
    a.download = `${safeName || 'tactical-setup'}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_JSON_BYTES) {
      e.target.value = '';
      setImportError('Project file exceeds the maximum supported size (5 MB).');
      return;
    }
    const text = await file.text();
    const res = await importProjectJson(text);
    e.target.value = '';
    if (!res.ok) {
      setImportError(res.error ?? 'Failed to import project.');
    } else {
      onClose();
    }
  };

  const pendingDeleteProject = savedProjects.find((p) => p.id === pendingDeleteId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Project Manager"
      data-testid="project-manager-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-zinc-700 bg-[#16191e] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Tactical Projects</h2>
            <p className="text-xs text-zinc-400">
              Saved locally in your browser (IndexedDB). Export or import JSON files at any time.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close project manager"
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="space-y-3 border-b border-zinc-800 bg-[#13161a] px-4 py-3">
          <form onSubmit={(e) => void handleCreateNew(e)} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New project name..."
              className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none sm:text-sm"
            />
            <button
              type="submit"
              data-testid="create-project-btn"
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 sm:text-sm"
            >
              <FilePlus2 className="h-4 w-4" />
              <span>New Project</span>
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="duplicate-project-btn"
              onClick={() => void duplicateCurrentProject()}
              className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Duplicate Current</span>
            </button>

            <button
              type="button"
              data-testid="export-json-btn"
              onClick={handleExportJson}
              className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export JSON</span>
            </button>

            <button
              type="button"
              data-testid="import-json-btn"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Import JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              data-testid="import-json-input"
              onChange={(e) => void handleFileImport(e)}
              className="hidden"
            />
          </div>

          {importError && (
            <div
              role="alert"
              data-testid="import-error-alert"
              className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200"
            >
              {importError}
            </div>
          )}
        </div>

        {/* Saved Projects List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {savedProjects.length === 0 ? (
              <p className="text-center text-xs text-zinc-500">No saved projects found yet.</p>
            ) : (
              savedProjects.map((item) => {
                const isCurrent = item.id === project.id;
                const totalPlayers = item.teams.A.roster.length + item.teams.B.roster.length;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-3 rounded-md border p-3 ${
                      isCurrent
                        ? 'border-emerald-500/50 bg-emerald-600/10'
                        : 'border-zinc-800 bg-[#13161a]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-zinc-100">
                          {item.name}
                        </span>
                        {isCurrent && (
                          <span className="rounded bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-zinc-400">
                        {totalPlayers} player{totalPlayers === 1 ? '' : 's'} · Updated{' '}
                        {new Date(item.updatedAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={async () => {
                            await openProject(item.id);
                            onClose();
                          }}
                          className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                          <span>Open</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(item.id)}
                        aria-label={`Delete project ${item.name}`}
                        className="rounded border border-zinc-800 p-1.5 text-zinc-400 hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDeleteProject)}
        title="Delete Tactical Project"
        description={`Are you sure you want to permanently delete "${pendingDeleteProject?.name ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete Project"
        destructive
        onConfirm={async () => {
          if (pendingDeleteProject) {
            await deleteProject(pendingDeleteProject.id);
          }
          setPendingDeleteId(null);
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
