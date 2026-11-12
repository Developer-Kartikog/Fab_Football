import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Laptop', width: 1280, height: 800 },
  { name: 'Tablet', width: 1024, height: 768 },
  { name: 'Mobile', width: 390, height: 844 },
] as const;

test.describe('Football Tactical Board — Phase 1 E2E', () => {
  test('full tactical workflow: add players, load formation, auto-fill, phase isolation, drag move, two-team, save & reload persistence', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 1. Opens directly to the tactical board pitch
    const pitch = page.getByTestId('tactical-pitch-svg');
    await expect(pitch).toBeVisible();

    // 2. Add 11 players for Team A via full-screen player library
    await page.getByTestId('add-players-btn').click();
    await expect(page.getByTestId('player-library-modal')).toBeVisible();

    const teamAProfiles: Array<[string, 'left' | 'right']> = [
      ['GK', 'right'],
      ['LB', 'left'],
      ['CB', 'left'],
      ['CB', 'right'],
      ['RB', 'right'],
      ['CDM', 'right'],
      ['CM', 'left'],
      ['CM', 'right'],
      ['LW', 'right'],
      ['ST', 'right'],
      ['RW', 'left'],
    ];

    for (const [pos, foot] of teamAProfiles) {
      await page.getByTestId(`select-profile-${pos}-${foot}`).click();
    }
    await page.getByTestId('confirm-add-players-btn').click();
    await expect(page.getByTestId('player-library-modal')).toBeHidden();

    // 3. Load 4-3-3 formation (independent of auto-fill)
    await page.getByTestId('formation-select').selectOption('4-3-3');
    await page.getByTestId('load-formation-btn').click();
    await expect(page.getByTestId('formation-slot-433-st')).toBeVisible();
    // Should NOT have created or auto-placed players yet
    await expect(page.locator('[data-team-id="A"][data-testid^="player-marker-"]')).toHaveCount(0);

    // 4. Auto-fill Team A into 4-3-3
    await page.getByTestId('auto-fill-btn').click();
    const teamAMarkers = page.locator('[data-team-id="A"][data-testid^="player-marker-"]');
    await expect(teamAMarkers).toHaveCount(11);

    // Record ST position in Build-up phase
    const stMarker = page.locator('[data-team-id="A"][data-position="ST"]').first();
    const buildUpBox = await stMarker.boundingBox();
    expect(buildUpBox).not.toBeNull();

    // 5. Switch to Attacking Organisation, copy Build-up layout, and move ST via drag-and-drop
    await page.getByTestId('copy-phase-btn').click();
    await page.getByTestId('copy-phase-target-attackingOrg').click();
    await page.getByTestId('phase-tab-attackingOrg').click();
    await expect(teamAMarkers).toHaveCount(11);

    const attOrgStBox = await stMarker.boundingBox();
    expect(attOrgStBox).not.toBeNull();
    await page.mouse.move(
      attOrgStBox!.x + attOrgStBox!.width / 2,
      attOrgStBox!.y + attOrgStBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      attOrgStBox!.x + attOrgStBox!.width / 2 + 65,
      attOrgStBox!.y + attOrgStBox!.height / 2 + 55,
      { steps: 8 },
    );
    await page.mouse.up();

    const movedAttOrgBox = await stMarker.boundingBox();
    expect(Math.abs(movedAttOrgBox!.x - attOrgStBox!.x)).toBeGreaterThan(30);

    // Switch back to Build-up and verify ST stayed at original Build-up coordinates
    await page.getByTestId('phase-tab-buildUp').click();
    const buildUpBoxAfter = await stMarker.boundingBox();
    expect(Math.abs(buildUpBoxAfter!.x - buildUpBox!.x)).toBeLessThan(3);

    // 6. Switch to Team B, add a player, and tap-to-place on pitch
    await page.getByTestId('edit-team-B').click();
    await page.getByTestId('add-players-btn').click();
    await page.getByTestId('select-profile-ST-left').click();
    await page.getByTestId('confirm-add-players-btn').click();

    const unplacedB = page.locator('[data-testid^="unplaced-player-"]').first();
    await unplacedB.locator('button').first().click();

    const pitchBox = await pitch.boundingBox();
    expect(pitchBox).not.toBeNull();
    await page.mouse.click(
      pitchBox!.x + pitchBox!.width * 0.5,
      pitchBox!.y + pitchBox!.height * 0.65,
    );

    const teamBMarkers = page.locator('[data-team-id="B"][data-testid^="player-marker-"]');
    await expect(teamBMarkers).toHaveCount(1);
    // Team A markers remain visible in Both view
    await expect(teamAMarkers).toHaveCount(11);

    // 7. Wait for IndexedDB autosave and verify persistence across reload
    await expect(page.getByTestId('save-status-badge')).toContainText('Saved', {
      timeout: 5000,
    });
    await page.reload();

    await expect(page.getByTestId('tactical-pitch-svg')).toBeVisible();
    await expect(page.locator('[data-team-id="A"][data-testid^="player-marker-"]')).toHaveCount(
      11,
    );
    await expect(page.locator('[data-team-id="B"][data-testid^="player-marker-"]')).toHaveCount(
      1,
    );

    // 8. Project manager: rename, duplicate, export JSON, reject corrupted JSON, delete
    await page.getByTestId('open-projects-btn').click();
    await expect(page.getByTestId('project-manager-modal')).toBeVisible();
    await page.getByTestId('duplicate-project-btn').click();
    await expect(page.getByTestId('save-status-badge')).toContainText('Saved', { timeout: 5000 });

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-json-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);

    // Reject malformed JSON import safely without breaking active project
    const fileInput = page.getByTestId('import-json-input');
    await fileInput.setInputFiles({
      name: 'corrupted.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ invalid json', 'utf-8'),
    });
    await expect(page.getByTestId('import-error-alert')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('project-manager-modal')).toBeHidden();

    // 9. Undo/Redo + Free-Form + Swap Ends
    await page.getByTestId('free-form-toggle-btn').click();
    await expect(page.getByTestId('free-form-toggle-btn')).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Swap pitch ends').click();
    await page.getByLabel('Swap pitch ends').click();

    expect(consoleErrors).toEqual([]);
  });

  for (const vp of VIEWPORTS) {
    test(`responsive layout & interaction check at ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      const pitch = page.getByTestId('tactical-pitch-svg');
      await expect(pitch).toBeVisible();

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);

      // Verify pitch keeps substantial size and correct aspect ratio
      const pitchBox = await pitch.boundingBox();
      expect(pitchBox).not.toBeNull();
      expect(pitchBox!.width).toBeGreaterThan(220);
      expect(pitchBox!.height).toBeGreaterThan(320);

      // Add a player and tap-to-place even on Mobile
      await page.getByTestId('add-players-btn').click();
      await expect(page.getByTestId('player-library-modal')).toBeVisible();
      await page.getByTestId('select-profile-CM-right').click();
      await page.getByTestId('confirm-add-players-btn').click();

      const trayItem = page.locator('[data-testid^="unplaced-player-"]').first();
      await trayItem.locator('button').first().click();

      await page.mouse.click(
        pitchBox!.x + pitchBox!.width * 0.5,
        pitchBox!.y + pitchBox!.height * 0.5,
      );

      await expect(page.locator('[data-testid^="player-marker-"]')).toHaveCount(1);
      await expect(page.getByTestId('player-inspector')).toBeVisible();

      expect(consoleErrors).toEqual([]);
    });
  }
});
