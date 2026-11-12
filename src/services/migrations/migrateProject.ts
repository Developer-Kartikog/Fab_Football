import type { PlayerInstance, TeamId } from '@/domain/players/types';
import { isValidPositionId } from '@/domain/positions/taxonomy';
import type { SideDesignation } from '@/domain/positions/types';
import { CURRENT_SCHEMA_VERSION, type TacticalProject } from '@/domain/projects/types';
import { TACTICAL_PHASE_IDS, createEmptyPhaseLayout } from '@/domain/tactical-phases/constants';
import type { TacticalPhaseId, TacticalPhaseLayout } from '@/domain/tactical-phases/types';
import { createEmptyTeam, type Team } from '@/domain/teams/types';
import { clamp01 } from '@/features/pitch/engine/coordinates';

export type MigrationResult =
  | { ok: true; project: TacticalProject }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validatePlayer(raw: unknown, expectedTeamId: TeamId): PlayerInstance | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (!isValidPositionId(raw.positionId)) return null;
  if (raw.preferredFoot !== 'left' && raw.preferredFoot !== 'right') return null;

  return {
    id: raw.id,
    teamId: expectedTeamId,
    positionId: raw.positionId,
    roleId: typeof raw.roleId === 'string' ? raw.roleId : null,
    archetypeId: typeof raw.archetypeId === 'string' ? raw.archetypeId : null,
    preferredFoot: raw.preferredFoot,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  };
}

function sanitizeTimestamp(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  return Number.isNaN(Date.parse(raw)) ? fallback : raw;
}

function validatePhaseLayout(
  raw: unknown,
  phaseId: TacticalPhaseId,
  validPlayerIds: Set<string>,
): TacticalPhaseLayout | null {
  if (!isRecord(raw)) return null;
  const slotsRaw = Array.isArray(raw.formationSlots) ? raw.formationSlots : [];
  const placementsRaw = Array.isArray(raw.playerPlacements) ? raw.playerPlacements : [];

  const seenSlotIds = new Set<string>();
  const formationSlots = slotsRaw
    .filter((slot): slot is Record<string, unknown> => isRecord(slot))
    .filter(
      (slot) =>
        typeof slot.id === 'string' &&
        slot.id.trim().length > 0 &&
        !seenSlotIds.has(slot.id) &&
        isValidPositionId(slot.positionId),
    )
    .map((slot) => {
      const id = String(slot.id);
      seenSlotIds.add(id);
      const sideDesignation: SideDesignation =
        slot.sideDesignation === 'left' || slot.sideDesignation === 'right'
          ? slot.sideDesignation
          : 'center';
      return {
        id,
        positionId: slot.positionId as PlayerInstance['positionId'],
        label: typeof slot.label === 'string' && slot.label.trim() ? slot.label : String(slot.positionId),
        sideDesignation,
        x: clamp01(typeof slot.x === 'number' && Number.isFinite(slot.x) ? slot.x : 0.5),
        y: clamp01(typeof slot.y === 'number' && Number.isFinite(slot.y) ? slot.y : 0.5),
      };
    });

  const seenPlacementIds = new Set<string>();
  const claimedSlotIds = new Set<string>();
  const playerPlacements = placementsRaw
    .filter((p): p is Record<string, unknown> => isRecord(p))
    .filter(
      (p) =>
        typeof p.playerId === 'string' &&
        validPlayerIds.has(p.playerId) &&
        !seenPlacementIds.has(p.playerId) &&
        typeof p.x === 'number' &&
        Number.isFinite(p.x) &&
        typeof p.y === 'number' &&
        Number.isFinite(p.y),
    )
    .map((p) => {
      const playerId = String(p.playerId);
      seenPlacementIds.add(playerId);
      let formationSlotId: string | null =
        typeof p.formationSlotId === 'string' &&
        seenSlotIds.has(p.formationSlotId) &&
        !claimedSlotIds.has(p.formationSlotId)
          ? p.formationSlotId
          : null;
      if (formationSlotId) {
        claimedSlotIds.add(formationSlotId);
      }
      return {
        playerId,
        x: clamp01(Number(p.x)),
        y: clamp01(Number(p.y)),
        formationSlotId,
      };
    });

  return {
    phaseId,
    formationId: typeof raw.formationId === 'string' && raw.formationId.trim() ? raw.formationId : null,
    formationSlots,
    playerPlacements,
    drawingObjects: Array.isArray(raw.drawingObjects) ? raw.drawingObjects : [],
  };
}

function validateTeam(
  raw: unknown,
  teamId: TeamId,
  globalSeenPlayerIds: Set<string>,
): Team | null {
  if (!isRecord(raw)) return null;
  if (!Array.isArray(raw.roster)) return null;

  const roster: PlayerInstance[] = [];
  const teamPlayerIds = new Set<string>();
  for (const item of raw.roster) {
    const validated = validatePlayer(item, teamId);
    if (!validated) return null;
    if (globalSeenPlayerIds.has(validated.id)) {
      return null;
    }
    globalSeenPlayerIds.add(validated.id);
    teamPlayerIds.add(validated.id);
    roster.push(validated);
  }

  const base = createEmptyTeam(teamId);
  const rawPhases = isRecord(raw.tacticalPhases) ? raw.tacticalPhases : {};

  const tacticalPhases = { ...base.tacticalPhases };
  for (const phaseId of TACTICAL_PHASE_IDS) {
    const parsedPhase = rawPhases[phaseId]
      ? validatePhaseLayout(rawPhases[phaseId], phaseId, teamPlayerIds)
      : createEmptyPhaseLayout(phaseId);
    if (!parsedPhase) return null;
    tacticalPhases[phaseId] = parsedPhase;
  }

  return {
    id: teamId,
    name:
      typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim().slice(0, 60)
        : base.name,
    roster,
    tacticalPhases,
  };
}

export function validateAndMigrateProject(raw: unknown): MigrationResult {
  if (!isRecord(raw)) {
    return { ok: false, error: 'Invalid project format: expected a JSON object.' };
  }

  const schemaVersion = raw.schemaVersion;
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    return { ok: false, error: 'Missing or invalid schemaVersion.' };
  }

  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Project schemaVersion (${schemaVersion}) is newer than supported version (${CURRENT_SCHEMA_VERSION}).`,
    };
  }

  if (typeof raw.id !== 'string' || !raw.id.trim()) {
    return { ok: false, error: 'Missing project id.' };
  }

  if (typeof raw.name !== 'string' || !raw.name.trim()) {
    return { ok: false, error: 'Missing project name.' };
  }

  if (!isRecord(raw.teams)) {
    return { ok: false, error: 'Missing teams object.' };
  }

  const globalSeenPlayerIds = new Set<string>();
  const teamA = validateTeam(raw.teams.A, 'A', globalSeenPlayerIds);
  const teamB = validateTeam(raw.teams.B, 'B', globalSeenPlayerIds);
  if (!teamA || !teamB) {
    return { ok: false, error: 'Invalid team roster, duplicate player IDs, or invalid tactical phase data.' };
  }

  const activeTeam: TeamId = raw.activeTeam === 'B' ? 'B' : 'A';
  const activeViewMode =
    raw.activeViewMode === 'A' || raw.activeViewMode === 'B' || raw.activeViewMode === 'both'
      ? raw.activeViewMode
      : 'both';
  const activePhase: TacticalPhaseId = TACTICAL_PHASE_IDS.includes(raw.activePhase as TacticalPhaseId)
    ? (raw.activePhase as TacticalPhaseId)
    : 'buildUp';
  const orientation = raw.orientation === 'swapped' ? 'swapped' : 'standard';
  const freeFormMode = typeof raw.freeFormMode === 'boolean' ? raw.freeFormMode : false;

  const now = new Date().toISOString();
  const project: TacticalProject = {
    id: raw.id.trim(),
    name: raw.name.trim().slice(0, 120),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    teams: { A: teamA, B: teamB },
    activeTeam,
    activeViewMode,
    activePhase,
    orientation,
    freeFormMode,
    createdAt: sanitizeTimestamp(raw.createdAt, now),
    updatedAt: sanitizeTimestamp(raw.updatedAt, now),
  };

  return { ok: true, project };
}
