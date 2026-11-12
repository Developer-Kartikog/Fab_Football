import type { TacticalPhaseDefinition, TacticalPhaseId, TacticalPhaseLayout } from './types';

export const TACTICAL_PHASES: readonly TacticalPhaseDefinition[] = [
  {
    id: 'buildUp',
    label: 'Build-up',
    shortLabel: 'Build-up',
    description: 'Initial progression from defensive areas.',
  },
  {
    id: 'attackingOrg',
    label: 'Attacking Organisation',
    shortLabel: 'Att. Org',
    description: 'Established attacking-possession structure.',
  },
  {
    id: 'defensiveTrans',
    label: 'Defensive Transition',
    shortLabel: 'Def. Trans',
    description: 'Immediate response after losing possession.',
  },
  {
    id: 'defensiveOrg',
    label: 'Defensive Organisation',
    shortLabel: 'Def. Org',
    description: 'Established defensive block structure.',
  },
  {
    id: 'attackingTrans',
    label: 'Attacking Transition',
    shortLabel: 'Att. Trans',
    description: 'Immediate response after regaining possession.',
  },
];

export const TACTICAL_PHASE_IDS: readonly TacticalPhaseId[] = TACTICAL_PHASES.map((p) => p.id);

export function createEmptyPhaseLayout(phaseId: TacticalPhaseId): TacticalPhaseLayout {
  return {
    phaseId,
    formationId: null,
    formationSlots: [],
    playerPlacements: [],
    drawingObjects: [],
  };
}

export function createInitialTeamPhases(): Record<TacticalPhaseId, TacticalPhaseLayout> {
  return {
    buildUp: createEmptyPhaseLayout('buildUp'),
    attackingOrg: createEmptyPhaseLayout('attackingOrg'),
    defensiveTrans: createEmptyPhaseLayout('defensiveTrans'),
    defensiveOrg: createEmptyPhaseLayout('defensiveOrg'),
    attackingTrans: createEmptyPhaseLayout('attackingTrans'),
  };
}
