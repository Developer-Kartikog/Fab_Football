import type { PositionId, SideDesignation } from '../positions/types';

export interface FormationSlot {
  id: string;
  positionId: PositionId;
  label: string;
  sideDesignation: SideDesignation;
  /** Team-local normalised horizontal coordinate [0..1] (0 = team left, 1 = team right). */
  x: number;
  /** Team-local normalised vertical coordinate [0..1] (0 = own goal, 1 = opponent goal). */
  y: number;
}

export interface Formation {
  id: string;
  name: string;
  description: string;
  slots: FormationSlot[];
}
