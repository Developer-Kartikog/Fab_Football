export type PositionCategory = 'ATT' | 'MID' | 'DEF' | 'GK';

export type SideDesignation = 'center' | 'left' | 'right';

export type PositionId =
  | 'ST'
  | 'CF'
  | 'LW'
  | 'RW'
  | 'SS'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LM'
  | 'RM'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'LWB'
  | 'RWB'
  | 'GK';

export interface Position {
  id: PositionId;
  name: string;
  abbreviation: string;
  category: PositionCategory;
  sideDesignation: SideDesignation;
  displayOrder: number;
}

export interface CategoryMeta {
  id: PositionCategory;
  label: string;
  fullName: string;
  color: string;
  textColor: string;
  badgeBg: string;
}
