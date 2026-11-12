import { useEffect, useState } from 'react';
import { Check, FolderOpen, Loader2, Pencil, Save, AlertTriangle } from 'lucide-react';
import type { TeamId } from '@/domain/players/types';
import type { TeamViewMode } from '@/domain/teams/types';
import { useTacticalStore } from '@/store/useTacticalStore';

interface HeaderBarProps {
  onOpenProjects: () => void;
}

export function HeaderBar({ onOpenProjects }: HeaderBarProps) {
  const project = useTacticalStore((s) => s.project);
  const saveStatus = useTacticalStore((s) => s.saveStatus);
  const saveError = useTacticalStore((s) => s.saveError);
  const renameProject = useTacticalStore((s) => s.renameProject);
  const saveProjectNow = useTacticalStore((s) => s.saveProjectNow);
  const setViewMode = useTacticalStore((s) => s.setViewMode);
  const setActiveTeam = useTacticalStore((s) => s.setActiveTeam);

  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(project.name);

  useEffect(() => {
    setIsEditingName(false);
    setDraftName(project.name);
  }, [project.id]);

  const startEditName = () => {
    setDraftName(project.name);
    setIsEditingName(true);
  };

  const commitName = () => {
    if (draftName.trim()) {
      renameProject(draftName.trim());
    }
    setIsEditingName(false);
  };

  const teamACount = project.teams.A.roster.length;
  const teamBCount = project.teams.B.roster.length;

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-[#16191e] px-3 py-2 sm:px-4">
      {/* Brand + Project Name + Save Status */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-emerald-500/40 bg-emerald-600/20 text-xs font-bold tracking-tight text-emerald-300">
            FTB
          </span>
          <span className="hidden text-sm font-semibold tracking-tight text-zinc-100 md:inline">
            Football Tactical Board
          </span>
        </div>

        <span className="hidden text-zinc-700 md:inline">/</span>

        {isEditingName ? (
          <input
            type="text"
            value={draftName}
            maxLength={120}
            autoFocus
            aria-label="Project name"
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') setIsEditingName(false);
            }}
            className="w-40 rounded border border-emerald-500 bg-zinc-900 px-2 py-0.5 text-xs font-medium text-zinc-100 focus:outline-none sm:w-52 sm:text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={startEditName}
            title="Rename project"
            className="group flex max-w-[11rem] items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 sm:max-w-[16rem] sm:text-sm"
          >
            <span className="truncate">{project.name}</span>
            <Pencil className="h-3 w-3 shrink-0 text-zinc-500 group-hover:text-zinc-300" />
          </button>
        )}

        {/* Save Status Indicator */}
        <span
          data-testid="save-status-badge"
          title={saveStatus === 'error' && saveError ? saveError : undefined}
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
            saveStatus === 'saving'
              ? 'bg-amber-500/15 text-amber-300'
              : saveStatus === 'error'
                ? 'bg-red-500/15 text-red-300'
                : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          {saveStatus === 'saving' ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="hidden sm:inline">Saving…</span>
            </>
          ) : saveStatus === 'error' ? (
            <>
              <AlertTriangle className="h-3 w-3" />
              <span className="hidden sm:inline">Save error</span>
            </>
          ) : (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="hidden sm:inline">Saved</span>
            </>
          )}
        </span>
      </div>

      {/* Right Controls: View Mode, Active Edit Team, Save & Projects */}
      <div className="flex flex-wrap items-center gap-2">
        {/* View Mode Selector */}
        <div
          role="group"
          aria-label="Team viewing mode"
          className="flex items-center rounded-md border border-zinc-700/80 bg-[#111316] p-0.5"
        >
          {(
            [
              { id: 'A', label: `Team A (${teamACount})`, short: 'A' },
              { id: 'both', label: 'Both', short: 'Both' },
              { id: 'B', label: `Team B (${teamBCount})`, short: 'B' },
            ] as Array<{ id: TeamViewMode; label: string; short: string }>
          ).map((mode) => {
            const active = project.activeViewMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                aria-pressed={active}
                data-testid={`view-mode-${mode.id}`}
                onClick={() => setViewMode(mode.id)}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  active
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="hidden sm:inline">{mode.label}</span>
                <span className="sm:hidden">{mode.short}</span>
              </button>
            );
          })}
        </div>

        {/* Active Editing Team Switch (especially useful in Both view) */}
        <div
          role="group"
          aria-label="Active editing team"
          className="flex items-center rounded-md border border-zinc-700/80 bg-[#111316] p-0.5"
        >
          {(['A', 'B'] as TeamId[]).map((tid) => {
            const isEditing = project.activeTeam === tid;
            const disabled =
              (project.activeViewMode === 'A' && tid === 'B') ||
              (project.activeViewMode === 'B' && tid === 'A');
            return (
              <button
                key={tid}
                type="button"
                aria-pressed={isEditing}
                disabled={disabled}
                data-testid={`edit-team-${tid}`}
                onClick={() => setActiveTeam(tid)}
                title={`Edit Team ${tid}`}
                className={`rounded px-2 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-35 ${
                  isEditing
                    ? tid === 'A'
                      ? 'bg-zinc-100 text-zinc-900'
                      : 'bg-amber-400 text-zinc-950'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Edit {tid}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => void saveProjectNow()}
          title="Save project now"
          className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <Save className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Save</span>
        </button>

        <button
          type="button"
          data-testid="open-projects-btn"
          onClick={onOpenProjects}
          className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span>Projects</span>
        </button>
      </div>
    </header>
  );
}
