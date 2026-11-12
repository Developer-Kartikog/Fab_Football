import { useEffect, useState } from 'react';
import { ToastBanner } from '@/components/feedback/ToastBanner';
import { HeaderBar } from '@/components/layout/HeaderBar';
import { FormationToolbar } from '@/features/formations/components/FormationToolbar';
import { PhaseBar } from '@/features/phases/components/PhaseBar';
import { PitchSvg } from '@/features/pitch/components/PitchSvg';
import { UnplacedTray } from '@/features/players/components/UnplacedTray';
import { PlayerInspector } from '@/features/players/inspectors/PlayerInspector';
import { PlayerLibraryModal } from '@/features/players/library/PlayerLibraryModal';
import { ProjectManagerModal } from '@/features/projects/components/ProjectManagerModal';
import { useTacticalStore } from '@/store/useTacticalStore';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1024px)').matches
      : true,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

export function App() {
  const initializeApp = useTacticalStore((s) => s.initializeApp);
  const undo = useTacticalStore((s) => s.undo);
  const redo = useTacticalStore((s) => s.redo);
  const selectedPlayerId = useTacticalStore((s) => s.selectedPlayerId);
  const stagedPlacement = useTacticalStore((s) => s.stagedPlacement);
  const selectPlayer = useTacticalStore((s) => s.selectPlayer);
  const setStagedPlacement = useTacticalStore((s) => s.setStagedPlacement);
  const project = useTacticalStore((s) => s.project);

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    void initializeApp();
  }, [initializeApp]);

  // Global keyboard shortcuts for Undo / Redo / Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape' && !libraryOpen && !projectsOpen) {
        if (stagedPlacement) {
          setStagedPlacement(null);
          return;
        }
        if (selectedPlayerId) {
          selectPlayer(null);
          return;
        }
      }

      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (e.key.toLowerCase() === 'z' && e.shiftKey) ||
        e.key.toLowerCase() === 'y'
      ) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, libraryOpen, projectsOpen, stagedPlacement, selectedPlayerId, setStagedPlacement, selectPlayer]);

  const activeTeam = project.teams[project.activeTeam];
  const activePhaseLayout = activeTeam.tacticalPhases[project.activePhase];

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[#111316] text-zinc-100">
      <HeaderBar onOpenProjects={() => setProjectsOpen(true)} />
      <PhaseBar />

      {/* Main Tactical Workspace */}
      <main className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2 sm:p-3 lg:flex-row lg:gap-3">
        {/* Central Full-Size Football Pitch */}
        <div className="relative min-h-0 flex-1">
          <PitchSvg />

          {/* Mobile / Tablet floating compact inspector when a marker is selected */}
          {!isDesktop && selectedPlayerId && (
            <div className="absolute right-2 bottom-2 left-2 z-30 max-h-[45%] overflow-y-auto rounded-lg lg:hidden">
              <PlayerInspector />
            </div>
          )}
        </div>

        {/* Side / Bottom Tray & Inspector */}
        <div className="flex shrink-0 flex-col gap-2 lg:w-72 xl:w-80">
          {/* Compact Team Status Summary (Desktop) */}
          <div className="hidden items-center justify-between rounded-lg border border-zinc-800 bg-[#16191e] px-3 py-2 text-xs lg:flex">
            <span className="font-medium text-zinc-300">
              Team {project.activeTeam} On Pitch
            </span>
            <span className="font-mono font-semibold tabular-nums text-emerald-300">
              {activePhaseLayout.playerPlacements.length} / {activeTeam.roster.length}
            </span>
          </div>

          <UnplacedTray />

          {isDesktop && (
            <div className="hidden lg:block">
              <PlayerInspector />
            </div>
          )}
        </div>
      </main>

      <FormationToolbar onOpenPlayerLibrary={() => setLibraryOpen(true)} />

      <PlayerLibraryModal open={libraryOpen} onClose={() => setLibraryOpen(false)} />
      <ProjectManagerModal open={projectsOpen} onClose={() => setProjectsOpen(false)} />
      <ToastBanner />
    </div>
  );
}

export default App;
