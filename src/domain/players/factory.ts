import type { PositionId } from '../positions/types';
import type { PlayerInstance, PreferredFoot, TeamId } from './types';

export function generateId(prefix = 'id'): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  const random = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${random}`;
}

export interface CreatePlayerInput {
  teamId: TeamId;
  positionId: PositionId;
  preferredFoot: PreferredFoot;
}

export function createPlayerInstance(input: CreatePlayerInput): PlayerInstance {
  return {
    id: generateId('pl'),
    teamId: input.teamId,
    positionId: input.positionId,
    roleId: null,
    archetypeId: null,
    preferredFoot: input.preferredFoot,
    createdAt: new Date().toISOString(),
  };
}

export function clonePlayerForTeam(player: PlayerInstance): PlayerInstance {
  return createPlayerInstance({
    teamId: player.teamId,
    positionId: player.positionId,
    preferredFoot: player.preferredFoot,
  });
}
