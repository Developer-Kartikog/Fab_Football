import type { FormationSlot } from '../formations/types';

export type TacticalPhaseId =
  | 'buildUp'
  | 'attackingOrg'
  | 'defensiveTrans'
  | 'defensiveOrg'
  | 'attackingTrans';

export interface TacticalPhaseDefinition {
  id: TacticalPhaseId;
  label: string;
  shortLabel: string;
  description: string;
}

export interface PlayerPlacement {
  playerId: string;
  /** Team-local normalised horizontal coordinate [0..1] (0 = team left, 1 = team right). */
  x: number;
  /** Team-local normalised vertical coordinate [0..1] (0 = own goal, 1 = opponent goal). */
  y: number;
  formationSlotId: string | null;
}

export interface TacticalPhaseLayout {
  phaseId: TacticalPhaseId;
  formationId: string | null;
  formationSlots: FormationSlot[];
  playerPlacements: PlayerPlacement[];
  /** Reserved for Phase 3 drawing tools. */
  drawingObjects: unknown[];
}
