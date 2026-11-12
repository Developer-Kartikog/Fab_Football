import type { PlayerInstance } from '../players/types';
import { getPositionById } from '../positions/taxonomy';
import type { PositionCategory } from '../positions/types';
import type { PlayerPlacement } from '../tactical-phases/types';
import type { FormationSlot } from './types';

export interface AutoFillResult {
  newPlacements: PlayerPlacement[];
  filledSlotIds: string[];
  unfilledSlotIds: string[];
  unplacedPlayerIds: string[];
  exactMatchCount: number;
  compatibleMatchCount: number;
}

const FORBIDDEN_SCORE = -1_000_000;

function getCategorySuitabilityScore(
  playerCategory: PositionCategory,
  slotCategory: PositionCategory,
): number {
  if (playerCategory === slotCategory) {
    return 2000;
  }
  if (
    (playerCategory === 'MID' && (slotCategory === 'ATT' || slotCategory === 'DEF')) ||
    (slotCategory === 'MID' && (playerCategory === 'ATT' || playerCategory === 'DEF'))
  ) {
    return 500;
  }
  return 100;
}

export function scorePlayerForSlot(player: PlayerInstance, slot: FormationSlot): number {
  const playerPos = getPositionById(player.positionId);
  const slotPos = getPositionById(slot.positionId);

  // Strict GK vs outfield separation
  const playerIsGk = playerPos.category === 'GK';
  const slotIsGk = slotPos.category === 'GK';
  if (playerIsGk !== slotIsGk) {
    return FORBIDDEN_SCORE;
  }

  let score = 0;

  // Priority 1: Exact position match
  if (player.positionId === slot.positionId) {
    score += 10_000;
  }

  // Priority 2: Compatible positional category
  score += getCategorySuitabilityScore(playerPos.category, slotPos.category);

  // Priority 3: Side-specific suitability
  if (playerPos.sideDesignation === slot.sideDesignation) {
    score += 300;
  } else if (playerPos.sideDesignation === 'center' || slot.sideDesignation === 'center') {
    score += 80;
  }

  // Priority 4: Preferred foot tie-breaker on wide slots
  if (slot.sideDesignation === 'left' && player.preferredFoot === 'left') {
    score += 40;
  } else if (slot.sideDesignation === 'right' && player.preferredFoot === 'right') {
    score += 40;
  }

  return score;
}

/**
 * Deterministic maximum-weight bipartite matching (Hungarian / Kuhn–Munkres algorithm)
 * maximizing total score across N players and M slots.
 */
function solveMaxWeightAssignment(weights: number[][]): number[] {
  const rows = weights.length;
  const cols = rows > 0 ? weights[0].length : 0;
  if (rows === 0 || cols === 0) {
    return [];
  }

  const size = Math.max(rows, cols);
  let maxWeight = 0;
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      if (weights[i][j] > maxWeight) {
        maxWeight = weights[i][j];
      }
    }
  }

  // Convert maximization over padded square matrix to minimization of non-negative costs.
  // Dummy entries have weight 0, so cost = maxWeight - 0 = maxWeight.
  // Forbidden entries have negative weight, so cost = maxWeight - FORBIDDEN_SCORE.
  const cost: number[][] = Array.from({ length: size + 1 }, (_, i) =>
    Array.from({ length: size + 1 }, (__, j) => {
      if (i === 0 || j === 0) return 0;
      const r = i - 1;
      const c = j - 1;
      const w = r < rows && c < cols ? weights[r][c] : 0;
      return maxWeight - w;
    }),
  );

  const u = new Array<number>(size + 1).fill(0);
  const v = new Array<number>(size + 1).fill(0);
  const p = new Array<number>(size + 1).fill(0);
  const way = new Array<number>(size + 1).fill(0);

  for (let i = 1; i <= size; i += 1) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(size + 1).fill(Infinity);
    const used = new Array<boolean>(size + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= size; j += 1) {
        if (!used[j]) {
          const cur = cost[i0][j] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }
      for (let j = 0; j <= size; j += 1) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const rowToCol = new Array<number>(rows).fill(-1);
  for (let j = 1; j <= size; j += 1) {
    const i = p[j];
    if (i >= 1 && i <= rows && j >= 1 && j <= cols) {
      rowToCol[i - 1] = j - 1;
    }
  }
  return rowToCol;
}

export function autoFillFormation(
  roster: readonly PlayerInstance[],
  existingPlacements: readonly PlayerPlacement[],
  slots: readonly FormationSlot[],
): AutoFillResult {
  const placedPlayerIds = new Set(existingPlacements.map((p) => p.playerId));
  const occupiedSlotIds = new Set(
    existingPlacements
      .map((p) => p.formationSlotId)
      .filter((id): id is string => id !== null),
  );

  // Also treat any slot that already has a marker placed very close to it as occupied?
  // Per Phase 1 rules: only empty slots should be filled, and existing placed players must not be silently moved.
  const emptySlots = slots.filter((slot) => !occupiedSlotIds.has(slot.id));
  const eligiblePlayers = roster.filter((player) => !placedPlayerIds.has(player.id));

  if (emptySlots.length === 0 || eligiblePlayers.length === 0) {
    return {
      newPlacements: [],
      filledSlotIds: [],
      unfilledSlotIds: emptySlots.map((s) => s.id),
      unplacedPlayerIds: eligiblePlayers.map((p) => p.id),
      exactMatchCount: 0,
      compatibleMatchCount: 0,
    };
  }

  const weights = eligiblePlayers.map((player) =>
    emptySlots.map((slot) => scorePlayerForSlot(player, slot)),
  );

  const assignment = solveMaxWeightAssignment(weights);

  const newPlacements: PlayerPlacement[] = [];
  const filledSlotIds: string[] = [];
  const assignedPlayerIds = new Set<string>();
  let exactMatchCount = 0;
  let compatibleMatchCount = 0;

  for (let pIdx = 0; pIdx < eligiblePlayers.length; pIdx += 1) {
    const sIdx = assignment[pIdx];
    if (sIdx !== undefined && sIdx >= 0 && sIdx < emptySlots.length) {
      const weight = weights[pIdx][sIdx];
      if (weight > 0) {
        const player = eligiblePlayers[pIdx];
        const slot = emptySlots[sIdx];
        newPlacements.push({
          playerId: player.id,
          x: slot.x,
          y: slot.y,
          formationSlotId: slot.id,
        });
        filledSlotIds.push(slot.id);
        assignedPlayerIds.add(player.id);
        if (player.positionId === slot.positionId) {
          exactMatchCount += 1;
        } else {
          compatibleMatchCount += 1;
        }
      }
    }
  }

  const filledSet = new Set(filledSlotIds);
  const unfilledSlotIds = emptySlots
    .filter((slot) => !filledSet.has(slot.id))
    .map((slot) => slot.id);

  const unplacedPlayerIds = eligiblePlayers
    .filter((player) => !assignedPlayerIds.has(player.id))
    .map((player) => player.id);

  return {
    newPlacements,
    filledSlotIds,
    unfilledSlotIds,
    unplacedPlayerIds,
    exactMatchCount,
    compatibleMatchCount,
  };
}
