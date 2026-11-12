import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '@/domain/projects/types';
import { TACTICAL_PHASE_IDS } from '@/domain/tactical-phases/constants';
import { useTacticalStore } from '@/store/useTacticalStore';

function resetStore() {
  useTacticalStore.setState({
    initialized: false,
    project: createDefaultProject('Test Project'),
    past: [],
    future: [],
    selectedPlayerId: null,
    stagedPlacement: null,
    selectedFormationId: '4-3-3',
    saveStatus: 'idle',
    saveError: null,
    savedProjects: [],
    toast: null,
  });
}

describe('Tactical store: teams, five phases, formations, and undo/redo', () => {
  beforeEach(() => {
    resetStore();
  });

  it('creates unique IDs for duplicate profiles and separates Team A and Team B', () => {
    const store = useTacticalStore.getState();
    const addedA = store.addPlayersToActiveTeam([
      { positionId: 'ST', preferredFoot: 'right' },
      { positionId: 'ST', preferredFoot: 'right' },
    ]);
    expect(addedA).toHaveLength(2);
    expect(addedA[0].id).not.toBe(addedA[1].id);
    expect(useTacticalStore.getState().project.teams.A.roster).toHaveLength(2);
    expect(useTacticalStore.getState().project.teams.B.roster).toHaveLength(0);

    store.setActiveTeam('B');
    store.addPlayersToActiveTeam([{ positionId: 'GK', preferredFoot: 'left' }]);
    const state = useTacticalStore.getState();
    expect(state.project.teams.A.roster).toHaveLength(2);
    expect(state.project.teams.B.roster).toHaveLength(1);
  });

  it('maintains independent placements across all 5 phases for the same player identity', () => {
    expect(TACTICAL_PHASE_IDS).toHaveLength(5);
    const store = useTacticalStore.getState();
    const [lb] = store.addPlayersToActiveTeam([{ positionId: 'LB', preferredFoot: 'left' }]);

    // Place in Build-up
    store.placeOrMovePlayer('A', lb.id, 0.30, 0.45);
    // Switch to Attacking Org and place differently
    store.setActivePhase('attackingOrg');
    store.placeOrMovePlayer('A', lb.id, 0.12, 0.78);

    const state = useTacticalStore.getState();
    const buildUpPlacement = state.project.teams.A.tacticalPhases.buildUp.playerPlacements[0];
    const attOrgPlacement = state.project.teams.A.tacticalPhases.attackingOrg.playerPlacements[0];
    const defOrgPlacements = state.project.teams.A.tacticalPhases.defensiveOrg.playerPlacements;

    expect(buildUpPlacement.playerId).toBe(lb.id);
    expect(buildUpPlacement.x).toBeCloseTo(0.30);
    expect(buildUpPlacement.y).toBeCloseTo(0.45);
    expect(attOrgPlacement.playerId).toBe(lb.id);
    expect(attOrgPlacement.x).toBeCloseTo(0.12);
    expect(attOrgPlacement.y).toBeCloseTo(0.78);
    expect(defOrgPlacements).toHaveLength(0);
  });

  it('copies and resets phases without mutating source or unrelated phases', () => {
    const store = useTacticalStore.getState();
    const [cm] = store.addPlayersToActiveTeam([{ positionId: 'CM', preferredFoot: 'right' }]);
    store.placeOrMovePlayer('A', cm.id, 0.5, 0.5);
    store.copyPhaseLayout('buildUp', 'defensiveOrg');

    let state = useTacticalStore.getState();
    expect(state.project.teams.A.tacticalPhases.defensiveOrg.playerPlacements).toHaveLength(1);
    expect(state.project.teams.A.tacticalPhases.defensiveOrg.playerPlacements[0].x).toBeCloseTo(0.5);

    // Mutate defensiveOrg and verify buildUp is unaffected
    store.setActivePhase('defensiveOrg');
    store.placeOrMovePlayer('A', cm.id, 0.4, 0.3);
    state = useTacticalStore.getState();
    expect(state.project.teams.A.tacticalPhases.buildUp.playerPlacements[0].y).toBeCloseTo(0.5);
    expect(state.project.teams.A.tacticalPhases.defensiveOrg.playerPlacements[0].y).toBeCloseTo(0.3);

    // Reset defensiveOrg keeps roster and buildUp intact
    store.resetCurrentPhase();
    state = useTacticalStore.getState();
    expect(state.project.teams.A.tacticalPhases.defensiveOrg.playerPlacements).toHaveLength(0);
    expect(state.project.teams.A.tacticalPhases.buildUp.playerPlacements).toHaveLength(1);
    expect(state.project.teams.A.roster).toHaveLength(1);
  });

  it('loads formation slots without creating fake players or deleting existing placements', () => {
    const store = useTacticalStore.getState();
    const [st] = store.addPlayersToActiveTeam([{ positionId: 'ST', preferredFoot: 'right' }]);
    store.placeOrMovePlayer('A', st.id, 0.55, 0.88);
    store.loadFormation('4-3-3');

    const state = useTacticalStore.getState();
    const layout = state.project.teams.A.tacticalPhases.buildUp;
    expect(state.project.teams.A.roster).toHaveLength(1);
    expect(layout.formationSlots).toHaveLength(11);
    expect(layout.playerPlacements).toHaveLength(1);
    expect(layout.playerPlacements[0].x).toBeCloseTo(0.55);
  });

  it('supports undo and redo across mutations without being corrupted by phase/team switches', () => {
    const store = useTacticalStore.getState();
    const [st] = store.addPlayersToActiveTeam([{ positionId: 'ST', preferredFoot: 'right' }]);
    store.placeOrMovePlayer('A', st.id, 0.5, 0.8);
    store.updatePlayerProfile('A', st.id, { preferredFoot: 'left' });

    // Switch phase and team (non-undoable navigation)
    store.setActivePhase('attackingOrg');
    store.setActiveTeam('B');
    store.renameProject('Renamed Mid-Edit');
    store.toggleFreeFormMode();

    // Undo foot change — navigation/view state and non-undoable rename stay intact
    store.undo();
    let afterUndo = useTacticalStore.getState();
    expect(afterUndo.project.teams.A.roster[0].preferredFoot).toBe('right');
    expect(afterUndo.project.activePhase).toBe('attackingOrg');
    expect(afterUndo.project.activeTeam).toBe('B');
    expect(afterUndo.project.name).toBe('Renamed Mid-Edit');
    expect(afterUndo.project.freeFormMode).toBe(true);

    // Undo placement
    store.undo();
    afterUndo = useTacticalStore.getState();
    expect(
      afterUndo.project.teams.A.tacticalPhases.buildUp.playerPlacements,
    ).toHaveLength(0);

    // Redo placement + foot change
    store.redo();
    store.redo();
    const restored = useTacticalStore.getState();
    expect(restored.project.teams.A.roster[0].preferredFoot).toBe('left');
    expect(restored.project.teams.A.tacticalPhases.buildUp.playerPlacements).toHaveLength(1);
    expect(restored.project.activePhase).toBe('attackingOrg');
    expect(restored.project.activeTeam).toBe('B');
    expect(restored.project.name).toBe('Renamed Mid-Edit');
  });

  it('prevents two players from occupying the same formationSlotId and clears redo stack on new mutation', () => {
    const store = useTacticalStore.getState();
    const [p1, p2] = store.addPlayersToActiveTeam([
      { positionId: 'ST', preferredFoot: 'right' },
      { positionId: 'CF', preferredFoot: 'left' },
    ]);
    store.loadFormation('4-3-3');
    store.placeOrMovePlayer('A', p1.id, 0.5, 0.83, '433-st');
    store.placeOrMovePlayer('A', p2.id, 0.5, 0.83, '433-st');

    const placements = useTacticalStore.getState().project.teams.A.tacticalPhases.buildUp.playerPlacements;
    expect(placements.find((p) => p.playerId === p1.id)?.formationSlotId).toBeNull();
    expect(placements.find((p) => p.playerId === p2.id)?.formationSlotId).toBe('433-st');

    store.undo();
    expect(useTacticalStore.getState().future).toHaveLength(1);
    store.placeOrMovePlayer('A', p1.id, 0.4, 0.7, null);
    expect(useTacticalStore.getState().future).toHaveLength(0);
  });
});
