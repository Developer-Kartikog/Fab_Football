import { describe, expect, it } from 'vitest';
import { autoFillFormation } from '@/domain/formations/autoFill';
import { FORMATION_PRESETS, getFormationById } from '@/domain/formations/presets';
import { createPlayerInstance } from '@/domain/players/factory';
import { CATEGORY_META, CATEGORY_ORDER, POSITIONS, POSITION_MAP } from '@/domain/positions/taxonomy';
import type { PositionId } from '@/domain/positions/types';

describe('Football taxonomy validation', () => {
  it('maintains unique positions, exact category colours, and central map consistency', () => {
    expect(CATEGORY_ORDER).toEqual(['ATT', 'MID', 'DEF', 'GK']);
    expect(CATEGORY_META.ATT.color).toBe('#D93636');
    expect(CATEGORY_META.MID.color).toBe('#269B61');
    expect(CATEGORY_META.DEF.color).toBe('#337BDB');
    expect(CATEGORY_META.GK.color).toBe('#E58A25');

    const seenIds = new Set<string>();
    const seenOrders = new Set<number>();
    for (const pos of POSITIONS) {
      expect(seenIds.has(pos.id)).toBe(false);
      seenIds.add(pos.id);
      expect(seenOrders.has(pos.displayOrder)).toBe(false);
      seenOrders.add(pos.displayOrder);
      expect(pos.name.trim().length).toBeGreaterThan(0);
      expect(pos.abbreviation.trim().length).toBeGreaterThan(0);
      expect(['ATT', 'MID', 'DEF', 'GK']).toContain(pos.category);
      expect(['left', 'center', 'right']).toContain(pos.sideDesignation);
      expect(POSITION_MAP[pos.id]).toEqual(pos);
    }
    expect(Object.keys(POSITION_MAP)).toHaveLength(POSITIONS.length);
  });
});

describe('Formation presets and automatic lineup filling', () => {
  const expectedIds = ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '3-4-3', '4-1-4-1', '4-3-2-1'];

  it('provides all 7 initial formations with 11 valid normalised slots each', () => {
    expect(FORMATION_PRESETS.map((f) => f.id)).toEqual(expectedIds);
    for (const formation of FORMATION_PRESETS) {
      expect(formation.slots).toHaveLength(11);
      const slotIds = new Set(formation.slots.map((s) => s.id));
      expect(slotIds.size).toBe(11);
      for (const slot of formation.slots) {
        expect(slot.x).toBeGreaterThanOrEqual(0);
        expect(slot.x).toBeLessThanOrEqual(1);
        expect(slot.y).toBeGreaterThanOrEqual(0);
        expect(slot.y).toBeLessThanOrEqual(1);
      }
      expect(formation.slots.filter((s) => s.positionId === 'GK')).toHaveLength(1);
    }
  });

  it('prioritises exact position matches regardless of roster order', () => {
    const formation = getFormationById('4-3-3')!;
    const rosterPositions: PositionId[] = [
      'RW', 'ST', 'LW', 'CM', 'CM', 'CDM', 'RB', 'CB', 'CB', 'LB', 'GK',
    ];
    // Reverse order to prove assignment is not insertion-order greedy
    const roster = rosterPositions.map((pos) =>
      createPlayerInstance({ teamId: 'A', positionId: pos, preferredFoot: 'right' }),
    );

    const result = autoFillFormation(roster, [], formation.slots);
    expect(result.filledSlotIds).toHaveLength(11);
    expect(result.exactMatchCount).toBe(11);
    expect(result.unplacedPlayerIds).toHaveLength(0);
    expect(result.unfilledSlotIds).toHaveLength(0);
  });

  it('never assigns an outfield player to GK or a GK to an outfield slot', () => {
    const formation = getFormationById('4-3-3')!;
    const onlyOutfield = [
      createPlayerInstance({ teamId: 'A', positionId: 'CB', preferredFoot: 'right' }),
      createPlayerInstance({ teamId: 'A', positionId: 'ST', preferredFoot: 'right' }),
    ];

    const res1 = autoFillFormation(onlyOutfield, [], formation.slots);
    const gkSlotId = formation.slots.find((s) => s.positionId === 'GK')!.id;
    expect(res1.filledSlotIds).not.toContain(gkSlotId);
    expect(res1.unfilledSlotIds).toContain(gkSlotId);

    const extraGks = [
      createPlayerInstance({ teamId: 'A', positionId: 'GK', preferredFoot: 'right' }),
      createPlayerInstance({ teamId: 'A', positionId: 'GK', preferredFoot: 'left' }),
    ];
    const res2 = autoFillFormation(extraGks, [], formation.slots);
    expect(res2.filledSlotIds).toEqual([gkSlotId]);
    expect(res2.unplacedPlayerIds).toHaveLength(1);
  });

  it('preserves existing placed players and keeps excess players unplaced', () => {
    const formation = getFormationById('4-4-2')!;
    const st1 = createPlayerInstance({ teamId: 'A', positionId: 'ST', preferredFoot: 'right' });
    const st2 = createPlayerInstance({ teamId: 'A', positionId: 'ST', preferredFoot: 'left' });
    const cm1 = createPlayerInstance({ teamId: 'A', positionId: 'CM', preferredFoot: 'right' });

    const occupiedSlot = formation.slots.find((s) => s.positionId === 'ST')!;
    const existingPlacements = [
      { playerId: st1.id, x: 0.5, y: 0.75, formationSlotId: occupiedSlot.id },
    ];

    const result = autoFillFormation([st1, st2, cm1], existingPlacements, formation.slots);
    // st1 is already placed, so only st2 and cm1 are placed into other slots
    expect(result.newPlacements.map((p) => p.playerId)).not.toContain(st1.id);
    expect(result.filledSlotIds).not.toContain(occupiedSlot.id);
    expect(result.newPlacements).toHaveLength(2);
  });

  it('produces deterministic assignments with excess identical profiles and never duplicates a player across slots', () => {
    const formation = getFormationById('4-2-3-1')!;
    const roster = Array.from({ length: 14 }, (_, idx) =>
      createPlayerInstance({
        teamId: 'A',
        positionId: idx === 0 ? 'GK' : idx < 6 ? 'CM' : idx < 10 ? 'CB' : 'ST',
        preferredFoot: idx % 2 === 0 ? 'left' : 'right',
      }),
    );

    const run1 = autoFillFormation(roster, [], formation.slots);
    const run2 = autoFillFormation(roster, [], formation.slots);
    expect(run1).toEqual(run2);
    expect(run1.filledSlotIds).toHaveLength(11);
    expect(run1.unplacedPlayerIds).toHaveLength(3);

    const assignedPlayers = run1.newPlacements.map((p) => p.playerId);
    expect(new Set(assignedPlayers).size).toBe(11);
    const assignedSlots = run1.newPlacements.map((p) => p.formationSlotId);
    expect(new Set(assignedSlots).size).toBe(11);
  });
});
