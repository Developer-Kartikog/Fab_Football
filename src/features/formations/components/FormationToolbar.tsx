import { LayoutGrid, Move, Redo2, Sparkles, Undo2, UserPlus } from 'lucide-react';
import { FORMATION_PRESETS } from '@/domain/formations/presets';
import { useTacticalStore } from '@/store/useTacticalStore';

interface FormationToolbarProps {
  onOpenPlayerLibrary: () => void;
}

export function FormationToolbar({ onOpenPlayerLibrary }: FormationToolbarProps) {
  const project = useTacticalStore((s) => s.project);
  const selectedFormationId = useTacticalStore((s) => s.selectedFormationId);
  const pastCount = useTacticalStore((s) => s.past.length);
  const futureCount = useTacticalStore((s) => s.future.length);
  const setSelectedFormationId = useTacticalStore((s) => s.setSelectedFormationId);
  const loadFormation = useTacticalStore((s) => s.loadFormation);
  const autoFillCurrentPhase = useTacticalStore((s) => s.autoFillCurrentPhase);
  const toggleFreeFormMode = useTacticalStore((s) => s.toggleFreeFormMode);
  const undo = useTacticalStore((s) => s.undo);
  const redo = useTacticalStore((s) => s.redo);

  const activeLayout = project.teams[project.activeTeam].tacticalPhases[project.activePhase];

  return (
    <footer className="border-t border-zinc-800 bg-[#16191e] px-3 py-2 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Prominent Add Players CTA */}
        <button
          type="button"
          data-testid="add-players-btn"
          onClick={onOpenPlayerLibrary}
          className="flex items-center gap-2 rounded-md bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 sm:px-4 sm:text-sm"
        >
          <UserPlus className="h-4 w-4" />
          <span>Add Players</span>
        </button>

        {/* Formation Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1">
            <label htmlFor="formation-select" className="sr-only">
              Formation template
            </label>
            <select
              id="formation-select"
              data-testid="formation-select"
              value={selectedFormationId}
              onChange={(e) => setSelectedFormationId(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-100 focus:border-emerald-500 focus:outline-none sm:text-sm"
            >
              {FORMATION_PRESETS.map((formation) => (
                <option key={formation.id} value={formation.id}>
                  {formation.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              data-testid="load-formation-btn"
              onClick={() => loadFormation(selectedFormationId)}
              title="Load formation slot guides without moving existing players"
              className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:text-sm"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Load</span>
            </button>

            <button
              type="button"
              data-testid="auto-fill-btn"
              onClick={() => autoFillCurrentPhase(selectedFormationId)}
              title="Assign unplaced roster players to empty formation slots by best fit"
              className="flex items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-600/20 px-2.5 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-600/30 focus:outline-none focus:ring-2 focus:ring-sky-400 sm:text-sm"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Auto-Fill</span>
            </button>
          </div>

          <button
            type="button"
            data-testid="free-form-toggle-btn"
            aria-pressed={project.freeFormMode}
            onClick={toggleFreeFormMode}
            title="Toggle free-form positioning (hides formation guides without removing players)"
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:text-sm ${
              project.freeFormMode
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-200'
                : 'border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            <Move className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {project.freeFormMode ? 'Free-Form On' : 'Free-Form'}
            </span>
          </button>

          {activeLayout.formationId && !project.freeFormMode && (
            <span className="hidden rounded bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-400 xl:inline">
              Active: {activeLayout.formationId}
            </span>
          )}
        </div>

        {/* History: Undo & Redo */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="undo-btn"
            disabled={pastCount === 0}
            onClick={undo}
            title="Undo (Ctrl/Cmd + Z)"
            aria-label="Undo"
            className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:text-sm"
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Undo</span>
          </button>

          <button
            type="button"
            data-testid="redo-btn"
            disabled={futureCount === 0}
            onClick={redo}
            title="Redo (Ctrl/Cmd + Shift + Z)"
            aria-label="Redo"
            className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:text-sm"
          >
            <Redo2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Redo</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
