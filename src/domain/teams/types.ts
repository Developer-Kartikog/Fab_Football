import type { PlayerInstance, TeamId } from '../players/types';
import { createInitialTeamPhases } from '../tactical-phases/constants';
import type { TacticalPhaseId, TacticalPhaseLayout } from '../tactical-phases/types';

export type TeamViewMode = 'A' | 'B' | 'both';

export interface Team {
  id: TeamId;
  name: string;
  roster: PlayerInstance[];
  tacticalPhases: Record<TacticalPhaseId, TacticalPhaseLayout>;
}

export function createEmptyTeam(id: TeamId): Team {
  return {
    id,
    name: id === 'A' ? 'Team A' : 'Team B',
    roster: [],
    tacticalPhases: createInitialTeamPhases(),
  };
}
