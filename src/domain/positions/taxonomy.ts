import type { CategoryMeta, Position, PositionCategory, PositionId } from './types';

export const CATEGORY_ORDER: readonly PositionCategory[] = ['ATT', 'MID', 'DEF', 'GK'];

export const CATEGORY_META: Record<PositionCategory, CategoryMeta> = {
  ATT: {
    id: 'ATT',
    label: 'ATT',
    fullName: 'Attacking',
    color: '#D93636',
    textColor: '#FFFFFF',
    badgeBg: 'rgba(217, 54, 54, 0.18)',
  },
  MID: {
    id: 'MID',
    label: 'MID',
    fullName: 'Midfield',
    color: '#269B61',
    textColor: '#FFFFFF',
    badgeBg: 'rgba(38, 155, 97, 0.18)',
  },
  DEF: {
    id: 'DEF',
    label: 'DEF',
    fullName: 'Defensive',
    color: '#337BDB',
    textColor: '#FFFFFF',
    badgeBg: 'rgba(51, 123, 219, 0.18)',
  },
  GK: {
    id: 'GK',
    label: 'GK',
    fullName: 'Goalkeeper',
    color: '#E58A25',
    textColor: '#111316',
    badgeBg: 'rgba(229, 138, 37, 0.2)',
  },
};

export const POSITIONS: readonly Position[] = [
  // ATT — RED (#D93636)
  { id: 'ST', name: 'Striker', abbreviation: 'ST', category: 'ATT', sideDesignation: 'center', displayOrder: 1 },
  { id: 'CF', name: 'Centre Forward', abbreviation: 'CF', category: 'ATT', sideDesignation: 'center', displayOrder: 2 },
  { id: 'SS', name: 'Second Striker', abbreviation: 'SS', category: 'ATT', sideDesignation: 'center', displayOrder: 3 },
  { id: 'LW', name: 'Left Winger', abbreviation: 'LW', category: 'ATT', sideDesignation: 'left', displayOrder: 4 },
  { id: 'RW', name: 'Right Winger', abbreviation: 'RW', category: 'ATT', sideDesignation: 'right', displayOrder: 5 },

  // MID — GREEN (#269B61)
  { id: 'CAM', name: 'Attacking Midfielder', abbreviation: 'CAM', category: 'MID', sideDesignation: 'center', displayOrder: 6 },
  { id: 'CM', name: 'Central Midfielder', abbreviation: 'CM', category: 'MID', sideDesignation: 'center', displayOrder: 7 },
  { id: 'CDM', name: 'Defensive Midfielder', abbreviation: 'CDM', category: 'MID', sideDesignation: 'center', displayOrder: 8 },
  { id: 'LM', name: 'Left Midfielder', abbreviation: 'LM', category: 'MID', sideDesignation: 'left', displayOrder: 9 },
  { id: 'RM', name: 'Right Midfielder', abbreviation: 'RM', category: 'MID', sideDesignation: 'right', displayOrder: 10 },

  // DEF — BLUE (#337BDB)
  { id: 'CB', name: 'Centre Back', abbreviation: 'CB', category: 'DEF', sideDesignation: 'center', displayOrder: 11 },
  { id: 'LB', name: 'Left Back', abbreviation: 'LB', category: 'DEF', sideDesignation: 'left', displayOrder: 12 },
  { id: 'RB', name: 'Right Back', abbreviation: 'RB', category: 'DEF', sideDesignation: 'right', displayOrder: 13 },
  { id: 'LWB', name: 'Left Wingback', abbreviation: 'LWB', category: 'DEF', sideDesignation: 'left', displayOrder: 14 },
  { id: 'RWB', name: 'Right Wingback', abbreviation: 'RWB', category: 'DEF', sideDesignation: 'right', displayOrder: 15 },

  // GK — ORANGE (#E58A25)
  { id: 'GK', name: 'Goalkeeper', abbreviation: 'GK', category: 'GK', sideDesignation: 'center', displayOrder: 16 },
];

export const POSITION_MAP: Record<PositionId, Position> = POSITIONS.reduce(
  (acc, position) => {
    acc[position.id] = position;
    return acc;
  },
  {} as Record<PositionId, Position>,
);

export function getPositionById(id: PositionId): Position {
  return POSITION_MAP[id];
}

export function isValidPositionId(value: unknown): value is PositionId {
  return typeof value === 'string' && value in POSITION_MAP;
}

export function getPositionsByCategory(category: PositionCategory): Position[] {
  return POSITIONS.filter((pos) => pos.category === category).sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
}
