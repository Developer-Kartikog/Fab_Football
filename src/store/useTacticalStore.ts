import { create } from 'zustand';
import { autoFillFormation, type AutoFillResult } from '@/domain/formations/autoFill';
import { getFormationById } from '@/domain/formations/presets';
import { clonePlayerForTeam, createPlayerInstance } from '@/domain/players/factory';
import type { PlayerInstance, PreferredFoot, TeamId } from '@/domain/players/types';
import type { PositionId } from '@/domain/positions/types';
import { createDefaultProject, type TacticalProject } from '@/domain/projects/types';
import { createEmptyPhaseLayout } from '@/domain/tactical-phases/constants';
import type { TacticalPhaseId } from '@/domain/tactical-phases/types';
import type { TeamViewMode } from '@/domain/teams/types';
import { clamp01 } from '@/features/pitch/engine/coordinates';
import { parseAndValidateImportedProject } from '@/services/import-export/projectJson';
import {
  deleteProjectRecord,
  duplicateProjectRecord,
  listProjects,
  loadInitialOrActiveProject,
  loadProjectById,
  saveProjectRecord,
} from '@/services/persistence/projectRepository';

const MAX_HISTORY = 50;
const AUTOSAVE_DELAY_MS = 500;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface ToastMessage {
  id: number;
  type: 'info' | 'success' | 'warning' | 'error';
  text: string;
}

export interface StagedPlacement {
  playerId: string;
  teamId: TeamId;
}

export interface TacticalStoreState {
  initialized: boolean;
  project: TacticalProject;
  past: TacticalProject[];
  future: TacticalProject[];
  selectedPlayerId: string | null;
  stagedPlacement: StagedPlacement | null;
  selectedFormationId: string;
  saveStatus: SaveStatus;
  saveError: string | null;
  savedProjects: TacticalProject[];
  toast: ToastMessage | null;

  // Lifecycle & persistence
  initializeApp: () => Promise<void>;
  refreshProjectList: () => Promise<void>;
  renameProject: (name: string) => void;
  saveProjectNow: () => Promise<void>;
  createNewProject: (name?: string) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  duplicateCurrentProject: (name?: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  importProjectJson: (jsonText: string) => Promise<{ ok: boolean; error?: string }>;

  // Navigation & view controls (non-undoable)
  setActiveTeam: (teamId: TeamId) => void;
  setViewMode: (mode: TeamViewMode) => void;
  setActivePhase: (phaseId: TacticalPhaseId) => void;
  toggleOrientation: () => void;
  toggleFreeFormMode: () => void;
  setSelectedFormationId: (formationId: string) => void;
  selectPlayer: (playerId: string | null) => void;
  setStagedPlacement: (staged: StagedPlacement | null) => void;
  clearToast: () => void;
  showToast: (type: ToastMessage['type'], text: string) => void;

  // Undo / Redo
  undo: () => void;
  redo: () => void;

  // Player roster & placement (undoable)
  addPlayersToActiveTeam: (
    profiles: Array<{ positionId: PositionId; preferredFoot: PreferredFoot }>,
  ) => PlayerInstance[];
  placeOrMovePlayer: (
    teamId: TeamId,
    playerId: string,
    x: number,
    y: number,
    formationSlotId?: string | null,
  ) => void;
  unplacePlayerFromCurrentPhase: (teamId: TeamId, playerId: string) => void;
  updatePlayerProfile: (
    teamId: TeamId,
    playerId: string,
    updates: { positionId?: PositionId; preferredFoot?: PreferredFoot },
  ) => void;
  duplicatePlayer: (teamId: TeamId, playerId: string) => PlayerInstance | null;
  deletePlayerFromRoster: (teamId: TeamId, playerId: string) => void;

  // Formations & Phases (undoable)
  loadFormation: (formationId: string) => void;
  autoFillCurrentPhase: (formationId?: string) => AutoFillResult | null;
  copyPhaseLayout: (sourcePhase: TacticalPhaseId, targetPhase: TacticalPhaseId) => void;
  resetCurrentPhase: () => void;
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let autosaveGeneration = 0;
let toastCounter = 0;

function cancelPendingAutosave() {
  autosaveGeneration += 1;
  if (autosaveTimer !== null) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
}

function scheduleAutosave(
  getState: () => TacticalStoreState,
  setState: (partial: Partial<TacticalStoreState>) => void,
) {
  cancelPendingAutosave();
  const gen = autosaveGeneration;
  setState({ saveStatus: 'saving', saveError: null });
  autosaveTimer = setTimeout(async () => {
    autosaveTimer = null;
    if (gen !== autosaveGeneration) return;
    try {
      const current = getState().project;
      const saved = await saveProjectRecord(current);
      if (gen !== autosaveGeneration) return;
      const projects = await listProjects();
      if (gen !== autosaveGeneration) return;
      setState({
        saveStatus: 'saved',
        saveError: null,
        savedProjects: projects,
        project:
          getState().project.id === saved.id
            ? { ...getState().project, updatedAt: saved.updatedAt }
            : getState().project,
      });
    } catch (err) {
      if (gen !== autosaveGeneration) return;
      setState({
        saveStatus: 'error',
        saveError: err instanceof Error ? err.message : 'Failed to save to IndexedDB',
      });
    }
  }, AUTOSAVE_DELAY_MS);
}

function commitMutation(
  get: () => TacticalStoreState,
  set: (partial: Partial<TacticalStoreState>) => void,
  updater: (project: TacticalProject) => TacticalProject,
  recordHistory = true,
) {
  const prev = get().project;
  const next = updater(prev);
  if (next === prev) return;

  const stamped: TacticalProject = {
    ...next,
    updatedAt: new Date().toISOString(),
  };

  if (recordHistory) {
    const past = [...get().past, prev].slice(-MAX_HISTORY);
    set({
      project: stamped,
      past,
      future: [],
    });
  } else {
    set({ project: stamped });
  }

  if (get().initialized) {
    scheduleAutosave(get, set);
  }
}

export const useTacticalStore = create<TacticalStoreState>((set, get) => ({
  initialized: false,
  project: createDefaultProject(),
  past: [],
  future: [],
  selectedPlayerId: null,
  stagedPlacement: null,
  selectedFormationId: '4-3-3',
  saveStatus: 'idle',
  saveError: null,
  savedProjects: [],
  toast: null,

  clearToast: () => set({ toast: null }),

  showToast: (type, text) => {
    toastCounter += 1;
    set({ toast: { id: toastCounter, type, text } });
  },

  initializeApp: async () => {
    cancelPendingAutosave();
    try {
      const active = await loadInitialOrActiveProject();
      const projects = await listProjects();
      const activePhaseLayout = active.teams[active.activeTeam].tacticalPhases[active.activePhase];
      set({
        initialized: true,
        project: active,
        savedProjects: projects,
        saveStatus: 'saved',
        saveError: null,
        selectedFormationId: activePhaseLayout.formationId ?? '4-3-3',
      });
    } catch (err) {
      set({
        initialized: true,
        saveStatus: 'error',
        saveError: err instanceof Error ? err.message : 'IndexedDB unavailable; running in memory.',
      });
    }
  },

  refreshProjectList: async () => {
    try {
      const projects = await listProjects();
      set({ savedProjects: projects });
    } catch {
      // Ignore refresh failure if DB unavailable
    }
  },

  renameProject: (name) => {
    const trimmed = name.trim().slice(0, 120);
    if (!trimmed || trimmed === get().project.name) return;
    commitMutation(
      get,
      set,
      (project) => ({ ...project, name: trimmed }),
      false,
    );
  },

  saveProjectNow: async () => {
    cancelPendingAutosave();
    const gen = autosaveGeneration;
    set({ saveStatus: 'saving', saveError: null });
    try {
      const saved = await saveProjectRecord(get().project);
      if (gen !== autosaveGeneration) return;
      const projects = await listProjects();
      if (gen !== autosaveGeneration) return;
      set({
        project: saved,
        savedProjects: projects,
        saveStatus: 'saved',
        saveError: null,
      });
      get().showToast('success', `Saved "${saved.name}"`);
    } catch (err) {
      if (gen !== autosaveGeneration) return;
      set({
        saveStatus: 'error',
        saveError: err instanceof Error ? err.message : 'Save failed',
      });
      get().showToast('error', 'Failed to save project locally.');
    }
  },

  createNewProject: async (name) => {
    cancelPendingAutosave();
    const fresh = createDefaultProject(name?.trim().slice(0, 120) || 'Untitled Tactical Setup');
    try {
      const saved = await saveProjectRecord(fresh);
      const projects = await listProjects();
      set({
        project: saved,
        past: [],
        future: [],
        selectedPlayerId: null,
        stagedPlacement: null,
        selectedFormationId: '4-3-3',
        savedProjects: projects,
        saveStatus: 'saved',
        saveError: null,
      });
      get().showToast('success', `Created "${saved.name}"`);
    } catch (err) {
      set({
        project: fresh,
        past: [],
        future: [],
        selectedPlayerId: null,
        stagedPlacement: null,
        selectedFormationId: '4-3-3',
        saveStatus: 'error',
        saveError: err instanceof Error ? err.message : 'Failed to persist new project.',
      });
      get().showToast('warning', 'Created project in memory (IndexedDB unavailable).');
    }
  },

  openProject: async (id) => {
    cancelPendingAutosave();
    try {
      const loaded = await loadProjectById(id);
      if (!loaded) {
        get().showToast('error', 'Could not load selected project.');
        return;
      }
      const projects = await listProjects();
      const activePhaseLayout = loaded.teams[loaded.activeTeam].tacticalPhases[loaded.activePhase];
      set({
        project: loaded,
        past: [],
        future: [],
        selectedPlayerId: null,
        stagedPlacement: null,
        selectedFormationId: activePhaseLayout.formationId ?? '4-3-3',
        savedProjects: projects,
        saveStatus: 'saved',
        saveError: null,
      });
      get().showToast('success', `Loaded "${loaded.name}"`);
    } catch (err) {
      set({
        saveStatus: 'error',
        saveError: err instanceof Error ? err.message : 'Failed to open project.',
      });
      get().showToast('error', 'Failed to load project from IndexedDB.');
    }
  },

  duplicateCurrentProject: async (name) => {
    cancelPendingAutosave();
    try {
      const copy = await duplicateProjectRecord(get().project, name);
      await loadProjectById(copy.id);
      const projects = await listProjects();
      const activePhaseLayout = copy.teams[copy.activeTeam].tacticalPhases[copy.activePhase];
      set({
        project: copy,
        past: [],
        future: [],
        selectedPlayerId: null,
        stagedPlacement: null,
        selectedFormationId: activePhaseLayout.formationId ?? '4-3-3',
        savedProjects: projects,
        saveStatus: 'saved',
        saveError: null,
      });
      get().showToast('success', `Duplicated as "${copy.name}"`);
    } catch {
      get().showToast('error', 'Failed to duplicate project.');
    }
  },

  deleteProject: async (id) => {
    cancelPendingAutosave();
    try {
      await deleteProjectRecord(id);
      const remaining = await listProjects();
      if (get().project.id === id) {
        if (remaining.length > 0) {
          const next = await loadProjectById(remaining[0].id);
          if (next) {
            const activeLayout = next.teams[next.activeTeam].tacticalPhases[next.activePhase];
            set({
              project: next,
              past: [],
              future: [],
              selectedPlayerId: null,
              stagedPlacement: null,
              selectedFormationId: activeLayout.formationId ?? '4-3-3',
              savedProjects: remaining,
              saveStatus: 'saved',
              saveError: null,
            });
            get().showToast('info', 'Project deleted.');
            return;
          }
        }
        const fresh = await saveProjectRecord(createDefaultProject());
        const list = await listProjects();
        set({
          project: fresh,
          past: [],
          future: [],
          selectedPlayerId: null,
          stagedPlacement: null,
          selectedFormationId: '4-3-3',
          savedProjects: list,
          saveStatus: 'saved',
          saveError: null,
        });
      } else {
        set({ savedProjects: remaining });
      }
      get().showToast('info', 'Project deleted.');
    } catch (err) {
      set({
        saveStatus: 'error',
        saveError: err instanceof Error ? err.message : 'Failed to delete project.',
      });
      get().showToast('error', 'Failed to delete project from IndexedDB.');
    }
  },

  importProjectJson: async (jsonText) => {
    const result = parseAndValidateImportedProject(jsonText, { assignNewId: true });
    if (!result.ok) {
      get().showToast('error', result.error);
      return { ok: false, error: result.error };
    }
    cancelPendingAutosave();
    try {
      const saved = await saveProjectRecord(result.project);
      const projects = await listProjects();
      const activePhaseLayout = saved.teams[saved.activeTeam].tacticalPhases[saved.activePhase];
      set({
        project: saved,
        past: [],
        future: [],
        selectedPlayerId: null,
        stagedPlacement: null,
        selectedFormationId: activePhaseLayout.formationId ?? '4-3-3',
        savedProjects: projects,
        saveStatus: 'saved',
        saveError: null,
      });
      get().showToast('success', `Imported "${saved.name}"`);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to store imported project.';
      get().showToast('error', msg);
      return { ok: false, error: msg };
    }
  },

  setActiveTeam: (teamId) => {
    set((state) => {
      const currentLayout =
        state.project.teams[teamId].tacticalPhases[state.project.activePhase];
      return {
        project: { ...state.project, activeTeam: teamId },
        stagedPlacement: null,
        selectedFormationId: currentLayout.formationId ?? state.selectedFormationId,
      };
    });
    if (get().initialized) scheduleAutosave(get, set);
  },

  setViewMode: (mode) => {
    set((state) => {
      const nextActiveTeam =
        mode === 'A' ? 'A' : mode === 'B' ? 'B' : state.project.activeTeam;
      let nextSelectedPlayerId = state.selectedPlayerId;
      if (nextSelectedPlayerId && mode !== 'both') {
        const hiddenTeam = mode === 'A' ? 'B' : 'A';
        if (state.project.teams[hiddenTeam].roster.some((p) => p.id === nextSelectedPlayerId)) {
          nextSelectedPlayerId = null;
        }
      }
      return {
        project: {
          ...state.project,
          activeViewMode: mode,
          activeTeam: nextActiveTeam,
        },
        selectedPlayerId: nextSelectedPlayerId,
        stagedPlacement: null,
      };
    });
    if (get().initialized) scheduleAutosave(get, set);
  },

  setActivePhase: (phaseId) => {
    set((state) => {
      const currentLayout =
        state.project.teams[state.project.activeTeam].tacticalPhases[phaseId];
      return {
        project: { ...state.project, activePhase: phaseId },
        stagedPlacement: null,
        selectedFormationId: currentLayout.formationId ?? state.selectedFormationId,
      };
    });
    if (get().initialized) scheduleAutosave(get, set);
  },

  toggleOrientation: () => {
    set((state) => ({
      project: {
        ...state.project,
        orientation: state.project.orientation === 'standard' ? 'swapped' : 'standard',
      },
    }));
    if (get().initialized) scheduleAutosave(get, set);
  },

  toggleFreeFormMode: () => {
    set((state) => ({
      project: {
        ...state.project,
        freeFormMode: !state.project.freeFormMode,
      },
    }));
    if (get().initialized) scheduleAutosave(get, set);
  },

  setSelectedFormationId: (formationId) => set({ selectedFormationId: formationId }),

  selectPlayer: (playerId) => set({ selectedPlayerId: playerId }),

  setStagedPlacement: (staged) => set({ stagedPlacement: staged }),

  undo: () => {
    const { past, project, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const nextPast = past.slice(0, -1);
    const nextFuture = [project, ...future].slice(0, MAX_HISTORY);

    // Restore tactical data while keeping current navigation/view toggles and non-undoable name
    const restoredProject: TacticalProject = {
      ...previous,
      name: project.name,
      activeTeam: project.activeTeam,
      activeViewMode: project.activeViewMode,
      activePhase: project.activePhase,
      orientation: project.orientation,
      freeFormMode: project.freeFormMode,
      updatedAt: new Date().toISOString(),
    };

    // Ensure selectedPlayerId still exists in restored project
    const allIds = new Set([
      ...restoredProject.teams.A.roster.map((p) => p.id),
      ...restoredProject.teams.B.roster.map((p) => p.id),
    ]);
    const selectedPlayerId =
      get().selectedPlayerId && allIds.has(get().selectedPlayerId!)
        ? get().selectedPlayerId
        : null;
    const activeLayout =
      restoredProject.teams[restoredProject.activeTeam].tacticalPhases[restoredProject.activePhase];

    set({
      project: restoredProject,
      past: nextPast,
      future: nextFuture,
      selectedPlayerId,
      stagedPlacement: null,
      selectedFormationId: activeLayout.formationId ?? get().selectedFormationId,
    });
    if (get().initialized) scheduleAutosave(get, set);
  },

  redo: () => {
    const { past, project, future } = get();
    if (future.length === 0) return;
    const next = future[0];
    const nextFuture = future.slice(1);
    const nextPast = [...past, project].slice(-MAX_HISTORY);

    const restoredProject: TacticalProject = {
      ...next,
      name: project.name,
      activeTeam: project.activeTeam,
      activeViewMode: project.activeViewMode,
      activePhase: project.activePhase,
      orientation: project.orientation,
      freeFormMode: project.freeFormMode,
      updatedAt: new Date().toISOString(),
    };

    const allIds = new Set([
      ...restoredProject.teams.A.roster.map((p) => p.id),
      ...restoredProject.teams.B.roster.map((p) => p.id),
    ]);
    const selectedPlayerId =
      get().selectedPlayerId && allIds.has(get().selectedPlayerId!)
        ? get().selectedPlayerId
        : null;
    const activeLayout =
      restoredProject.teams[restoredProject.activeTeam].tacticalPhases[restoredProject.activePhase];

    set({
      project: restoredProject,
      past: nextPast,
      future: nextFuture,
      selectedPlayerId,
      stagedPlacement: null,
      selectedFormationId: activeLayout.formationId ?? get().selectedFormationId,
    });
    if (get().initialized) scheduleAutosave(get, set);
  },

  addPlayersToActiveTeam: (profiles) => {
    if (profiles.length === 0) return [];
    const activeTeam = get().project.activeTeam;
    const created = profiles.map((profile) =>
      createPlayerInstance({
        teamId: activeTeam,
        positionId: profile.positionId,
        preferredFoot: profile.preferredFoot,
      }),
    );

    commitMutation(get, set, (project) => {
      const team = project.teams[activeTeam];
      return {
        ...project,
        teams: {
          ...project.teams,
          [activeTeam]: {
            ...team,
            roster: [...team.roster, ...created],
          },
        },
      };
    });

    get().showToast(
      'success',
      `Added ${created.length} player${created.length === 1 ? '' : 's'} to Team ${activeTeam}'s unplaced tray.`,
    );
    return created;
  },

  placeOrMovePlayer: (teamId, playerId, x, y, formationSlotId = null) => {
    const nx = clamp01(x);
    const ny = clamp01(y);

    commitMutation(get, set, (project) => {
      const team = project.teams[teamId];
      if (!team.roster.some((p) => p.id === playerId)) {
        return project;
      }

      const phaseId = project.activePhase;
      const phaseLayout = team.tacticalPhases[phaseId];
      const existingIndex = phaseLayout.playerPlacements.findIndex(
        (p) => p.playerId === playerId,
      );

      let nextPlacements = phaseLayout.playerPlacements.map((p) =>
        formationSlotId !== null && p.formationSlotId === formationSlotId && p.playerId !== playerId
          ? { ...p, formationSlotId: null }
          : p,
      );

      if (existingIndex >= 0) {
        nextPlacements[existingIndex] = {
          playerId,
          x: nx,
          y: ny,
          formationSlotId,
        };
      } else {
        nextPlacements.push({
          playerId,
          x: nx,
          y: ny,
          formationSlotId,
        });
      }

      return {
        ...project,
        teams: {
          ...project.teams,
          [teamId]: {
            ...team,
            tacticalPhases: {
              ...team.tacticalPhases,
              [phaseId]: {
                ...phaseLayout,
                playerPlacements: nextPlacements,
              },
            },
          },
        },
      };
    });
  },

  unplacePlayerFromCurrentPhase: (teamId, playerId) => {
    commitMutation(get, set, (project) => {
      const team = project.teams[teamId];
      const phaseId = project.activePhase;
      const phaseLayout = team.tacticalPhases[phaseId];
      const filtered = phaseLayout.playerPlacements.filter((p) => p.playerId !== playerId);
      if (filtered.length === phaseLayout.playerPlacements.length) {
        return project;
      }
      return {
        ...project,
        teams: {
          ...project.teams,
          [teamId]: {
            ...team,
            tacticalPhases: {
              ...team.tacticalPhases,
              [phaseId]: {
                ...phaseLayout,
                playerPlacements: filtered,
              },
            },
          },
        },
      };
    });
    if (get().stagedPlacement?.playerId === playerId) {
      set({ stagedPlacement: null });
    }
  },

  updatePlayerProfile: (teamId, playerId, updates) => {
    commitMutation(get, set, (project) => {
      const team = project.teams[teamId];
      const index = team.roster.findIndex((p) => p.id === playerId);
      if (index < 0) return project;
      const current = team.roster[index];
      const nextPlayer: PlayerInstance = {
        ...current,
        positionId: updates.positionId ?? current.positionId,
        preferredFoot: updates.preferredFoot ?? current.preferredFoot,
      };
      const nextRoster = [...team.roster];
      nextRoster[index] = nextPlayer;
      return {
        ...project,
        teams: {
          ...project.teams,
          [teamId]: {
            ...team,
            roster: nextRoster,
          },
        },
      };
    });
  },

  duplicatePlayer: (teamId, playerId) => {
    const team = get().project.teams[teamId];
    const source = team.roster.find((p) => p.id === playerId);
    if (!source) return null;

    const cloned = clonePlayerForTeam(source);

    commitMutation(get, set, (project) => {
      const currentTeam = project.teams[teamId];
      const phaseId = project.activePhase;
      const phaseLayout = currentTeam.tacticalPhases[phaseId];
      const sourcePlacement = phaseLayout.playerPlacements.find(
        (p) => p.playerId === playerId,
      );

      let nextPhaseLayout = phaseLayout;
      if (sourcePlacement) {
        const offsetX = sourcePlacement.x > 0.92 ? -0.045 : 0.045;
        const offsetY = sourcePlacement.y < 0.08 ? 0.03 : -0.03;
        nextPhaseLayout = {
          ...phaseLayout,
          playerPlacements: [
            ...phaseLayout.playerPlacements,
            {
              playerId: cloned.id,
              x: clamp01(sourcePlacement.x + offsetX),
              y: clamp01(sourcePlacement.y + offsetY),
              formationSlotId: null,
            },
          ],
        };
      }

      return {
        ...project,
        teams: {
          ...project.teams,
          [teamId]: {
            ...currentTeam,
            roster: [...currentTeam.roster, cloned],
            tacticalPhases: {
              ...currentTeam.tacticalPhases,
              [phaseId]: nextPhaseLayout,
            },
          },
        },
      };
    });

    set({ selectedPlayerId: cloned.id });
    get().showToast('success', `Duplicated ${source.positionId} profile.`);
    return cloned;
  },

  deletePlayerFromRoster: (teamId, playerId) => {
    commitMutation(get, set, (project) => {
      const team = project.teams[teamId];
      if (!team.roster.some((p) => p.id === playerId)) return project;

      const nextRoster = team.roster.filter((p) => p.id !== playerId);
      const nextPhases = { ...team.tacticalPhases };
      (Object.keys(nextPhases) as TacticalPhaseId[]).forEach((phaseId) => {
        const layout = nextPhases[phaseId];
        nextPhases[phaseId] = {
          ...layout,
          playerPlacements: layout.playerPlacements.filter((p) => p.playerId !== playerId),
        };
      });

      return {
        ...project,
        teams: {
          ...project.teams,
          [teamId]: {
            ...team,
            roster: nextRoster,
            tacticalPhases: nextPhases,
          },
        },
      };
    });

    if (get().selectedPlayerId === playerId) {
      set({ selectedPlayerId: null });
    }
    if (get().stagedPlacement?.playerId === playerId) {
      set({ stagedPlacement: null });
    }
    get().showToast('info', 'Player deleted from roster.');
  },

  loadFormation: (formationId) => {
    const formation = getFormationById(formationId);
    if (!formation) return;

    commitMutation(get, set, (project) => {
      const teamId = project.activeTeam;
      const phaseId = project.activePhase;
      const team = project.teams[teamId];
      const phaseLayout = team.tacticalPhases[phaseId];
      const newSlotIds = new Set(formation.slots.map((s) => s.id));

      // Preserve existing player placements; only clear formationSlotId if that slot no longer exists.
      const nextPlacements = phaseLayout.playerPlacements.map((p) => ({
        ...p,
        formationSlotId:
          p.formationSlotId && newSlotIds.has(p.formationSlotId) ? p.formationSlotId : null,
      }));

      return {
        ...project,
        freeFormMode: false,
        teams: {
          ...project.teams,
          [teamId]: {
            ...team,
            tacticalPhases: {
              ...team.tacticalPhases,
              [phaseId]: {
                ...phaseLayout,
                formationId: formation.id,
                formationSlots: formation.slots.map((s) => ({ ...s })),
                playerPlacements: nextPlacements,
              },
            },
          },
        },
      };
    });

    set({ selectedFormationId: formation.id });
    get().showToast(
      'info',
      `Loaded ${formation.name} guides for Team ${get().project.activeTeam}. Existing placements kept.`,
    );
  },

  autoFillCurrentPhase: (formationIdArg) => {
    const state = get();
    const { project } = state;
    const teamId = project.activeTeam;
    const phaseId = project.activePhase;
    const team = project.teams[teamId];
    const phaseLayout = team.tacticalPhases[phaseId];

    const targetFormationId =
      formationIdArg ?? phaseLayout.formationId ?? state.selectedFormationId;
    const formation = getFormationById(targetFormationId);
    if (!formation) return null;

    // Determine effective slots (use loaded slots if same formation, else preset slots)
    const effectiveSlots =
      phaseLayout.formationId === formation.id && phaseLayout.formationSlots.length > 0
        ? phaseLayout.formationSlots
        : formation.slots.map((s) => ({ ...s }));

    const result = autoFillFormation(
      team.roster,
      phaseLayout.playerPlacements,
      effectiveSlots,
    );

    if (result.newPlacements.length === 0 && phaseLayout.formationId === formation.id) {
      if (team.roster.length === 0) {
        get().showToast('warning', 'Team roster is empty. Add players before auto-filling.');
      } else if (result.unfilledSlotIds.length === 0) {
        get().showToast('info', 'All formation slots are already filled.');
      } else {
        get().showToast(
          'warning',
          'No eligible unplaced players available for remaining open slots.',
        );
      }
      return result;
    }

    commitMutation(get, set, (currentProject) => {
      const currentTeam = currentProject.teams[teamId];
      const currentPhase = currentTeam.tacticalPhases[phaseId];
      const slotIdSet = new Set(effectiveSlots.map((s) => s.id));
      const preservedPlacements = currentPhase.playerPlacements.map((p) => ({
        ...p,
        formationSlotId:
          p.formationSlotId && slotIdSet.has(p.formationSlotId) ? p.formationSlotId : null,
      }));

      return {
        ...currentProject,
        freeFormMode: false,
        teams: {
          ...currentProject.teams,
          [teamId]: {
            ...currentTeam,
            tacticalPhases: {
              ...currentTeam.tacticalPhases,
              [phaseId]: {
                ...currentPhase,
                formationId: formation.id,
                formationSlots: effectiveSlots,
                playerPlacements: [...preservedPlacements, ...result.newPlacements],
              },
            },
          },
        },
      };
    });

    set({ selectedFormationId: formation.id });
    const filledCount = result.filledSlotIds.length;
    const unfilledCount = result.unfilledSlotIds.length;
    const unplacedCount = result.unplacedPlayerIds.length;
    get().showToast(
      filledCount > 0 ? 'success' : 'warning',
      `Auto-fill (${formation.name}): placed ${filledCount} player${filledCount === 1 ? '' : 's'} (${result.exactMatchCount} exact, ${result.compatibleMatchCount} compatible). ${unfilledCount} unfilled slot${unfilledCount === 1 ? '' : 's'}, ${unplacedCount} unplaced.`,
    );
    return result;
  },

  copyPhaseLayout: (sourcePhase, targetPhase) => {
    if (sourcePhase === targetPhase) return;
    const teamId = get().project.activeTeam;

    commitMutation(get, set, (project) => {
      const team = project.teams[teamId];
      const source = team.tacticalPhases[sourcePhase];
      return {
        ...project,
        teams: {
          ...project.teams,
          [teamId]: {
            ...team,
            tacticalPhases: {
              ...team.tacticalPhases,
              [targetPhase]: {
                phaseId: targetPhase,
                formationId: source.formationId,
                formationSlots: source.formationSlots.map((s) => ({ ...s })),
                playerPlacements: source.playerPlacements.map((p) => ({ ...p })),
                drawingObjects: structuredClone(source.drawingObjects),
              },
            },
          },
        },
      };
    });

    get().showToast('success', `Copied phase layout for Team ${teamId}.`);
  },

  resetCurrentPhase: () => {
    const teamId = get().project.activeTeam;
    const phaseId = get().project.activePhase;

    commitMutation(get, set, (project) => {
      const team = project.teams[teamId];
      return {
        ...project,
        teams: {
          ...project.teams,
          [teamId]: {
            ...team,
            tacticalPhases: {
              ...team.tacticalPhases,
              [phaseId]: createEmptyPhaseLayout(phaseId),
            },
          },
        },
      };
    });

    set({ stagedPlacement: null });
    get().showToast('info', `Reset active phase layout for Team ${teamId}.`);
  },
}));
