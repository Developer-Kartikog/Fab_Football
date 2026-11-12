import type { PositionId } from '../positions/types';

export type PreferredFoot = 'left' | 'right';

export type TeamId = 'A' | 'B';

export interface PlayerDefinition {
  id: string;
  positionId: PositionId;
  preferredFoot: PreferredFoot;
}

export interface PlayerInstance {
  id: string;
  teamId: TeamId;
  positionId: PositionId;
  /** Reserved for Phase 2 role catalog integration. */
  roleId: string | null;
  /** Reserved for Phase 3 archetype catalog integration. */
  archetypeId: string | null;
  preferredFoot: PreferredFoot;
  createdAt: string;
}
