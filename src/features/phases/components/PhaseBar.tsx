import { useEffect, useRef, useState } from 'react';
import { Copy, RotateCcw } from 'lucide-react';
import { TACTICAL_PHASES } from '@/domain/tactical-phases/constants';
import type { TacticalPhaseId } from '@/domain/tactical-phases/types';
import { useTacticalStore } from '@/store/useTacticalStore';

export function PhaseBar() {
  const project = useTacticalStore((s) => s.project);
  const setActivePhase = useTacticalStore((s) => s.setActivePhase);
  const copyPhaseLayout = useTacticalStore((s) => s.copyPhaseLayout);
  const resetCurrentPhase = useTacticalStore((s) => s.resetCurrentPhase);

  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const copyMenuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!copyMenuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (
        copyMenuContainerRef.current &&
        !copyMenuContainerRef.current.contains(e.target as Node)
      ) {
        setCopyMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCopyMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [copyMenuOpen]);

  const activeTeam = project.activeTeam;
  const activePhase = project.activePhase;

  const handleCopyTo = (target: TacticalPhaseId) => {
    copyPhaseLayout(activePhase, target);
    setCopyMenuOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-[#14171b] px-3 py-1.5 sm:px-4">
      {/* Five Tactical Phase Tabs */}
      <nav
        aria-label="Tactical phases"
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-0.5"
      >
        {TACTICAL_PHASES.map((phase, idx) => {
          const isActive = activePhase === phase.id;
          const teamLayout = project.teams[activeTeam].tacticalPhases[phase.id];
          const placedCount = teamLayout.playerPlacements.length;

          return (
            <button
              key={phase.id}
              type="button"
              data-testid={`phase-tab-${phase.id}`}
              aria-current={isActive ? 'step' : undefined}
              onClick={() => setActivePhase(phase.id)}
              title={phase.description}
              className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                isActive
                  ? 'border-emerald-500/60 bg-emerald-600/20 text-emerald-200'
                  : 'border-transparent bg-zinc-800/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <span className="text-[10px] font-bold opacity-60">{idx + 1}.</span>
              <span className="hidden md:inline">{phase.label}</span>
              <span className="md:hidden">{phase.shortLabel}</span>
              {placedCount > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0 text-[10px] tabular-nums ${
                    isActive ? 'bg-emerald-500/30 text-emerald-100' : 'bg-zinc-700/80 text-zinc-300'
                  }`}
                >
                  {placedCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Phase Actions: Copy Phase & Reset Phase */}
      <div className="relative flex shrink-0 items-center gap-1.5">
        <div ref={copyMenuContainerRef} className="relative">
          <button
            type="button"
            data-testid="copy-phase-btn"
            aria-haspopup="menu"
            aria-expanded={copyMenuOpen}
            onClick={() => setCopyMenuOpen((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-zinc-700/80 bg-zinc-800/70 px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <Copy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Copy Phase To…</span>
            <span className="sm:hidden">Copy</span>
          </button>

          {copyMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 z-30 mt-1.5 w-52 rounded-md border border-zinc-700 bg-[#181b20] p-1 shadow-xl"
            >
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Copy Team {activeTeam} Layout To:
              </div>
              {TACTICAL_PHASES.filter((p) => p.id !== activePhase).map((target) => (
                <button
                  key={target.id}
                  type="button"
                  role="menuitem"
                  data-testid={`copy-phase-target-${target.id}`}
                  onClick={() => handleCopyTo(target.id)}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-800"
                >
                  <span>{target.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          data-testid="reset-phase-btn"
          onClick={resetCurrentPhase}
          title="Reset active phase layout for active team"
          className="flex items-center gap-1 rounded-md border border-zinc-700/80 bg-zinc-800/70 px-2 py-1 text-xs font-medium text-zinc-300 hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Reset Phase</span>
        </button>
      </div>
    </div>
  );
}
