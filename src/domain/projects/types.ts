import type { TeamId } from '../players/types';
import type { TacticalPhaseId } from '../tactical-phases/types';
import { createEmptyTeam, type Team, type TeamViewMode } from '../teams/types';
import { generateId } from '../players/factory';

export const CURRENT_SCHEMA_VERSION = 1;

export type PitchOrientation = 'standard' | 'swapped';

export interface TacticalProject {
  id: string;
  name: string;
  schemaVersion: number;
  teams: Record<TeamId, Team>;
  activeTeam: TeamId;
  activeViewMode: TeamViewMode;
  activePhase: TacticalPhaseId;
  orientation: PitchOrientation;
  freeFormMode: boolean;
  createdAt: string;
  updatedAt: string;
}

export function createDefaultProject(name = 'Untitled Tactical Setup'): TacticalProject {
  const now = new Date().toISOString();
  return {
    id: generateId('proj'),
    name,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    teams: {
      A: createEmptyTeam('A'),
      B: createEmptyTeam('B'),
    },
    activeTeam: 'A',
    activeViewMode: 'both',
    activePhase: 'buildUp',
    orientation: 'standard',
    freeFormMode: false,
    createdAt: now,
    updatedAt: now,
  };
}
