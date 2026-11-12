import { describe, expect, it } from 'vitest';
import { createPlayerInstance } from '@/domain/players/factory';
import { CURRENT_SCHEMA_VERSION, createDefaultProject } from '@/domain/projects/types';
import {
  parseAndValidateImportedProject,
  serializeProjectToJson,
} from '@/services/import-export/projectJson';
import {
  deleteProjectRecord,
  duplicateProjectRecord,
  listProjects,
  loadProjectById,
  saveProjectRecord,
} from '@/services/persistence/projectRepository';

describe('Persistence, JSON import/export, and schema migrations', () => {
  it('saves, loads, duplicates, and deletes projects in IndexedDB', async () => {
    const project = createDefaultProject('Matchday Press');
    const st = createPlayerInstance({ teamId: 'A', positionId: 'ST', preferredFoot: 'right' });
    project.teams.A.roster.push(st);
    project.teams.A.tacticalPhases.buildUp.playerPlacements.push({
      playerId: st.id,
      x: 0.5,
      y: 0.8,
      formationSlotId: null,
    });

    await saveProjectRecord(project);
    const loaded = await loadProjectById(project.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('Matchday Press');
    expect(loaded!.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(loaded!.teams.A.roster[0].id).toBe(st.id);

    const copy = await duplicateProjectRecord(loaded!, 'Matchday Press v2');
    expect(copy.id).not.toBe(loaded!.id);
    expect(copy.teams.A.tacticalPhases.buildUp.playerPlacements).toHaveLength(1);

    const all = await listProjects();
    expect(all).toHaveLength(2);

    await deleteProjectRecord(copy.id);
    expect(await listProjects()).toHaveLength(1);
  });

  it('exports valid JSON and re-imports with schema validation', () => {
    const project = createDefaultProject('Export Test');
    const gk = createPlayerInstance({ teamId: 'B', positionId: 'GK', preferredFoot: 'left' });
    project.teams.B.roster.push(gk);
    project.teams.B.tacticalPhases.defensiveOrg.playerPlacements.push({
      playerId: gk.id,
      x: 0.5,
      y: 0.06,
      formationSlotId: null,
    });

    const json = serializeProjectToJson(project);
    const imported = parseAndValidateImportedProject(json, { assignNewId: true });
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.project.id).not.toBe(project.id);
      expect(imported.project.teams.B.roster).toHaveLength(1);
      expect(imported.project.teams.B.tacticalPhases.defensiveOrg.playerPlacements).toHaveLength(1);
    }
  });

  it('rejects malformed JSON and unsupported schema versions cleanly', () => {
    expect(parseAndValidateImportedProject('{not valid json').ok).toBe(false);
    expect(
      parseAndValidateImportedProject(
        JSON.stringify({ id: '1', name: 'Bad', schemaVersion: 999, teams: {} }),
      ).ok,
    ).toBe(false);
    expect(
      parseAndValidateImportedProject(JSON.stringify({ foo: 'bar' })).ok,
    ).toBe(false);
  });

  it('rejects duplicate player IDs across teams and deduplicates claimed formation slots cleanly', () => {
    const project = createDefaultProject('Integrity Check');
    const pA = createPlayerInstance({ teamId: 'A', positionId: 'ST', preferredFoot: 'right' });
    const pB = { ...pA, teamId: 'B' as const };
    project.teams.A.roster.push(pA);
    project.teams.B.roster.push(pB);

    const dupCrossTeam = parseAndValidateImportedProject(JSON.stringify(project));
    expect(dupCrossTeam.ok).toBe(false);

    // Oversized import rejection
    const hugePayload = 'x'.repeat(5 * 1024 * 1024 + 10);
    expect(parseAndValidateImportedProject(hugePayload).ok).toBe(false);

    // Broken placement coordinates & out-of-range clamping
    const clean = createDefaultProject('Sanitize Coords');
    const cm = createPlayerInstance({ teamId: 'A', positionId: 'CM', preferredFoot: 'left' });
    clean.teams.A.roster.push(cm);
    clean.teams.A.tacticalPhases.buildUp.playerPlacements.push(
      { playerId: cm.id, x: 1.5, y: -0.2, formationSlotId: 'non-existent-slot' },
      { playerId: 'missing-player', x: 0.5, y: 0.5, formationSlotId: null },
    );
    const sanitized = parseAndValidateImportedProject(JSON.stringify(clean));
    expect(sanitized.ok).toBe(true);
    if (sanitized.ok) {
      const placements = sanitized.project.teams.A.tacticalPhases.buildUp.playerPlacements;
      expect(placements).toHaveLength(1);
      expect(placements[0].x).toBe(1);
      expect(placements[0].y).toBe(0);
      expect(placements[0].formationSlotId).toBeNull();
    }
  });
});
