import { generateId } from '@/domain/players/factory';
import type { TacticalProject } from '@/domain/projects/types';
import { validateAndMigrateProject } from '@/services/migrations/migrateProject';

export interface ProjectExportEnvelope {
  format: 'football-tactical-board-project';
  exportedAt: string;
  project: TacticalProject;
}

export function serializeProjectToJson(project: TacticalProject): string {
  const envelope: ProjectExportEnvelope = {
    format: 'football-tactical-board-project',
    exportedAt: new Date().toISOString(),
    project,
  };
  return JSON.stringify(envelope, null, 2);
}

export type ImportProjectResult =
  | { ok: true; project: TacticalProject }
  | { ok: false; error: string };

export const MAX_IMPORT_JSON_BYTES = 5 * 1024 * 1024;

export function parseAndValidateImportedProject(
  jsonText: string,
  options: { assignNewId?: boolean } = { assignNewId: true },
): ImportProjectResult {
  if (typeof jsonText !== 'string' || jsonText.length > MAX_IMPORT_JSON_BYTES) {
    return { ok: false, error: 'Project file exceeds the maximum supported size (5 MB).' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: 'Invalid JSON file. Could not parse contents.' };
  }

  let candidate: unknown = parsed;
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'format' in parsed &&
    (parsed as Record<string, unknown>).format === 'football-tactical-board-project' &&
    'project' in parsed
  ) {
    candidate = (parsed as Record<string, unknown>).project;
  }

  const migrated = validateAndMigrateProject(candidate);
  if (!migrated.ok) {
    return migrated;
  }

  if (options.assignNewId) {
    const now = new Date().toISOString();
    return {
      ok: true,
      project: {
        ...migrated.project,
        id: generateId('proj'),
        updatedAt: now,
      },
    };
  }

  return migrated;
}
