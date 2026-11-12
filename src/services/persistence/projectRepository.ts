import { generateId } from '@/domain/players/factory';
import { createDefaultProject, type TacticalProject } from '@/domain/projects/types';
import { validateAndMigrateProject } from '@/services/migrations/migrateProject';
import { db } from './db';

const ACTIVE_PROJECT_KEY = 'activeProjectId';

export async function saveProjectRecord(project: TacticalProject): Promise<TacticalProject> {
  const updated: TacticalProject = {
    ...project,
    updatedAt: new Date().toISOString(),
  };
  await db.projects.put(updated);
  await db.appMeta.put({ key: ACTIVE_PROJECT_KEY, value: updated.id });
  return updated;
}

export async function listProjects(): Promise<TacticalProject[]> {
  const rows = await db.projects.orderBy('updatedAt').reverse().toArray();
  const valid: TacticalProject[] = [];
  for (const row of rows) {
    const migrated = validateAndMigrateProject(row);
    if (migrated.ok) {
      valid.push(migrated.project);
    }
  }
  return valid;
}

export async function loadProjectById(id: string): Promise<TacticalProject | null> {
  const row = await db.projects.get(id);
  if (!row) return null;
  const migrated = validateAndMigrateProject(row);
  if (!migrated.ok) return null;
  await db.appMeta.put({ key: ACTIVE_PROJECT_KEY, value: migrated.project.id });
  return migrated.project;
}

export async function loadInitialOrActiveProject(): Promise<TacticalProject> {
  const meta = await db.appMeta.get(ACTIVE_PROJECT_KEY);
  if (meta?.value) {
    const active = await loadProjectById(meta.value);
    if (active) return active;
  }

  const all = await listProjects();
  if (all.length > 0) {
    await db.appMeta.put({ key: ACTIVE_PROJECT_KEY, value: all[0].id });
    return all[0];
  }

  const initial = createDefaultProject('Untitled Tactical Setup');
  return saveProjectRecord(initial);
}

export async function duplicateProjectRecord(
  source: TacticalProject,
  newName?: string,
): Promise<TacticalProject> {
  const now = new Date().toISOString();
  const copy: TacticalProject = {
    ...structuredClone(source),
    id: generateId('proj'),
    name: newName?.trim() || `${source.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };
  await db.projects.put(copy);
  return copy;
}

export async function deleteProjectRecord(id: string): Promise<void> {
  await db.projects.delete(id);
  const meta = await db.appMeta.get(ACTIVE_PROJECT_KEY);
  if (meta?.value === id) {
    await db.appMeta.delete(ACTIVE_PROJECT_KEY);
  }
}
