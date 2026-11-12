import Dexie, { type Table } from 'dexie';
import type { TacticalProject } from '@/domain/projects/types';

export interface AppMetaRecord {
  key: string;
  value: string;
}

class TacticalBoardDatabase extends Dexie {
  projects!: Table<TacticalProject, string>;
  appMeta!: Table<AppMetaRecord, string>;

  constructor() {
    super('fab_football_tactical_board');
    this.version(1).stores({
      projects: 'id, name, updatedAt',
      appMeta: 'key',
    });
  }
}

export const db = new TacticalBoardDatabase();
