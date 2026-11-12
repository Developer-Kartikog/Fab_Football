# Football Tactical Board — Final QA Audit & Hardening Report

## A. Executive Overview & Scope Clarification

### Application Audited
- **Workspace**: `FAB_Football` (`football-tactical-board@0.1.0`)
- **Stack**: React 19, TypeScript, Zustand, Dexie (IndexedDB), Tailwind CSS v4, Vite 6, Vitest, Testing Library, Playwright.
- **Architectural & Phase Scope Discovery**:
  - Although the QA brief referenced Post-Phase 4 capabilities (Phases 1–4), repository inspection and `docs/PHASE1_IMPLEMENTATION.md` establish that **only Phase 1 (Tactical Board Foundation)** has been built in this codebase.
  - Domain schemas reserve placeholder fields for future phases (`roleId: null`, `archetypeId: null` on player profiles/assignments; `drawingObjects: unknown[]` on tactical phase layouts), and **Phases 2–4 do not exist** in the repository.
  - Per the approved QA hardening scope (strict change control without inventing unimplemented taxonomies or building new product phases), this audit inspects, repairs, hardens, and verifies the **existing Phase 1 application**, while explicitly cataloguing unimplemented Phase 2–4 capabilities in Section F.

### Environment & Dependency Baseline
- **VCS State**: Workspace is not a Git repository (`git status` exits with code 128).
- **iCloud Drive Materialization**: Initial `node_modules` contained iCloud `+dataless` placeholders causing build/test stalls; running `npm ci --prefer-offline` materialized `node_modules` cleanly.
- **Security Audit**: `npm audit --omit=dev` reported `0` production vulnerabilities (`npm audit` full tree reports 3 dev-only vulnerabilities scoped to `vitest` / `@vitest/mocker` / `tinypool`).
- **Tooling Scripts Available**: `dev`, `build`, `preview`, `test`, `test:watch`, `test:e2e`, `typecheck`. No `lint` or `format` script is configured in `package.json`.

---

## B. Architecture & Audited Surface Area

| Layer | Key Modules Inspected |
| :--- | :--- |
| Domain Taxonomy & Types | `src/domain/positions/taxonomy.ts`, `src/domain/positions/types.ts` (16 positions across ATT `#D93636`, MID `#269B61`, DEF `#337BDB`, GK `#E58A25`) |
| Formations & Auto-Fill | `src/domain/formations/presets.ts` (`4-3-3`, `4-2-3-1`, `4-4-2`, `3-5-2`, `3-4-3`, `4-1-4-1`, `4-3-2-1`), `src/domain/formations/autoFill.ts` (Hungarian bipartite matching) |
| Players, Teams, Phases, Projects | `src/domain/players/*`, `src/domain/teams/types.ts`, `src/domain/tactical-phases/*`, `src/domain/projects/types.ts` |
| Pitch Engine & Rendering | `src/features/pitch/engine/coordinates.ts` (105:68 pitch, `680x1050` in `752x1134` SVG viewBox), `src/features/pitch/components/PitchSvg.tsx`, `PlayerMarker.tsx` |
| State Management | `src/store/useTacticalStore.ts` (Zustand store, undo/redo history, autosave) |
| Persistence & Validation | `src/services/persistence/db.ts`, `projectRepository.ts`, `src/services/migrations/migrateProject.ts`, `src/services/import-export/projectJson.ts` |
| UI & Modals | `src/app/App.tsx`, `HeaderBar.tsx`, `PhaseBar.tsx`, `FormationToolbar.tsx`, `UnplacedTray.tsx`, `PlayerInspector.tsx`, `PlayerLibraryModal.tsx`, `ProjectManagerModal.tsx`, `ToastBanner.tsx`, `ConfirmDialog.tsx` |

---

## C. Classified Defect Log (P0 – P3)

> All issues below were reproduced/confirmed in code or test execution, repaired in place, and verified afterward.

### P0 — Critical (Data Integrity, Build Blockers, Silent Corruption)

#### QA-001 — Broken `npm run typecheck` script & failing `tsc -b` build
- **Severity**: P0
- **Affected Modules**: `package.json`, `tsconfig.json`, `src/vite-env.d.ts`, `src/services/migrations/migrateProject.ts`
- **Description**: `npm run typecheck` executed `tsc --noEmit` against the root solution `tsconfig.json` (`"files": []`), checking zero source files and reporting false success while `tsc -b` (`npm run build`) failed on `@/index.css` (missing Vite client types) and `SideDesignation` type narrowing in `migrateProject.ts`.
- **Reproduction**: Run `npx tsc -b --noEmit` prior to fixes -> exits with TypeScript errors.
- **Root Cause**: Missing `src/vite-env.d.ts`, `"typecheck"` script omitting `-b`, and unnarrowed `SideDesignation` cast during migration sanitization.
- **Fix Implemented**:
  - Updated `package.json` `"typecheck"` script to `"tsc -b --noEmit"`.
  - Installed `@types/node` as devDependency.
  - Added `src/vite-env.d.ts` (`/// <reference types="vite/client" />`).
  - Fixed `SideDesignation` type narrowing in `src/services/migrations/migrateProject.ts`.
- **Verification**: `npm run typecheck` and `npm run build` both exit with code `0` (`0` TS errors).

#### QA-002 — Stale async autosave race could overwrite project save status or collide across project switches
- **Severity**: P0
- **Affected Module**: `src/store/useTacticalStore.ts`
- **Description**: Debounced async saves could resolve after a project switch, deletion, import, or manual save (`saveProjectNow`), marking a newly active project as `'saved'` prematurely or writing stale state.
- **Reproduction**: Mutate a project to schedule debounced autosave, immediately switch to another project (`openProject`), duplicate (`duplicateCurrentProject`), create (`createNewProject`), delete (`deleteProject`), or import (`importProjectJson`) before the timer fires or resolves.
- **Root Cause**: No generation token or cancellation guard tracked pending vs active autosave operations across project transitions.
- **Fix Implemented**: Added `autosaveGeneration` counter and `cancelPendingAutosave()` in `src/store/useTacticalStore.ts`, invoked on `saveProjectNow`, `createNewProject`, `openProject`, `duplicateCurrentProject`, `deleteProject`, `importProjectJson`, and `initializeApp`, plus `try/catch` error handling in lifecycle operations.
- **Verification**: Covered by `src/tests/storeAndPhases.test.ts` (`6/6` passed).

#### QA-003 — JSON migration allowed duplicate player IDs across teams, duplicate slot IDs, multi-claimed `formationSlotId`, and unbounded import payloads
- **Severity**: P0
- **Affected Modules**: `src/services/migrations/migrateProject.ts`, `src/services/import-export/projectJson.ts`, `src/features/projects/components/ProjectManagerModal.tsx`
- **Description**: Imported or persisted project payloads could contain colliding player IDs across Team A and Team B, duplicate custom slot IDs, multiple players claiming the same `formationSlotId` in one phase, invalid timestamps, or oversized JSON files causing browser freezes.
- **Reproduction**: Import a crafted JSON file with matching player IDs on Team A and Team B or two placements referencing one `formationSlotId`.
- **Root Cause**: Validation sanitized teams independently without cross-team ID sets, per-phase slot claim tracking, timestamp validation, or payload size limits.
- **Fix Implemented**:
  - Added `MAX_IMPORT_JSON_BYTES` (5 MB) check in `projectJson.ts` and `ProjectManagerModal.tsx`.
  - Enforced globally unique player IDs across Team A & Team B, slot ID deduplication, single-claim `formationSlotId` per tactical phase, `sanitizeTimestamp`, and name length bounds in `migrateProject.ts`.
- **Verification**: Covered by `src/tests/persistenceAndMigrations.test.ts` (`4/4` passed) and Playwright corrupted-JSON test.

---

### P1 — High (Core Tactical Workflows, State Synchronization, Pointer/Touch Interactions)

#### QA-004 — Duplicate `<PlayerInspector />` mounting created duplicate DOM IDs, broken ARIA landmarks, and failed test selectors
- **Severity**: P1
- **Affected Module**: `src/app/App.tsx`
- **Description**: Rendering `<PlayerInspector />` simultaneously inside both `lg:hidden` (mobile overlay) and `hidden lg:block` (desktop sidebar) mounted two live copies in the DOM whenever a player was selected, duplicating `#inspector-position-select` IDs, `<aside>` landmarks, and `[data-testid="player-inspector"]`.
- **Reproduction**: Render `App` in jsdom or inspect DOM when a player is selected -> `getByTestId('player-inspector')` throws `"Found multiple elements"`.
- **Root Cause**: Layout toggled visibility purely via CSS utility classes instead of conditional viewport rendering.
- **Fix Implemented**: Added `useIsDesktop()` (`window.matchMedia('(min-width: 1024px)')`, defaulting to `true` when `matchMedia` is unavailable) in `src/app/App.tsx` so only a single `<PlayerInspector />` instance mounts at any time.
- **Verification**: `src/tests/uiInteractions.test.tsx` (`2/2` passed) and Playwright Desktop/Laptop/Tablet/Mobile E2E tests (`5/5` passed).

#### QA-005 — Undo/Redo reverted navigation toggles and project name, and desynchronized `selectedFormationId`
- **Severity**: P1
- **Affected Module**: `src/store/useTacticalStore.ts`
- **Description**: Undoing/redoing tactical edits could inadvertently revert user navigation/view state (`activeTeam`, `activeViewMode`, `activePhase`, `orientation`, `freeFormMode`), project `name`, or leave `selectedFormationId` out of sync. Additionally, `copyPhaseLayout` copied `drawingObjects` by reference instead of deep cloning.
- **Reproduction**: Switch phase or toggle view mode, undo an earlier team edit, or copy a phase layout containing objects.
- **Root Cause**: History snapshots restored non-tactical UI fields wholesale and `copyPhaseLayout` shallow-copied `drawingObjects`.
- **Fix Implemented**: Updated `undo()` / `redo()` to restore `teams` while preserving `name`, `activeTeam`, `activeViewMode`, `activePhase`, `orientation`, and `freeFormMode`, and synchronizing `selectedFormationId`. Updated `copyPhaseLayout` to deep-clone `drawingObjects` with `structuredClone`. Also synced `selectedFormationId` across `openProject`, `deleteProject`, `createNewProject`, and `duplicateCurrentProject`.
- **Verification**: `src/tests/storeAndPhases.test.ts` (`6/6` passed).

#### QA-006 — Pitch pointer drag/pan stuck states, passive wheel zoom failure, and slot tap event conflict
- **Severity**: P1
- **Affected Module**: `src/features/pitch/components/PitchSvg.tsx`
- **Description**:
  1. Dragged players could not re-snap onto the formation slot they already occupied (`findNearestEmptySlot` excluded their own slot as occupied).
  2. Releasing the pointer outside the SVG/window left drag/pan active.
  3. React's passive `onWheel` listener failed to prevent default page scrolling during wheel zoom, and zooming out could strand pan offsets outside bounds.
  4. `handleSlotTap` called `stopPropagation` on `pointerDown`, conflicting with unified tap-to-place behavior and mobile touch scrolling (`touch-action` unset).
- **Reproduction**: Drag a slotted player slightly and drop back on their slot; drag pointer off-window or blur window; wheel-zoom on trackpad; tap a formation slot on touch/pointer devices.
- **Root Cause**: Missing `excludePlayerId` parameter in `findNearestEmptySlot`, missing SVG pointer capture & `window` `blur` reset, passive React `onWheel`, missing `clampTransform`, and split `pointerDown` vs `pointerUp` tap handlers.
- **Fix Implemented**:
  - Updated `findNearestEmptySlot` with `excludePlayerId`.
  - Captured pointer on `svgRef.current` and added `window` `blur` reset handler.
  - Replaced React `onWheel` with non-passive `{ passive: false }` native `wheel` listener and `clampTransform` (resets pan at zoom `1` and clamps pan when zooming out).
  - Unified tap-to-place on `pointerUp` (removed `handleSlotTap` `stopPropagation` on `pointerDown`) and applied `touchAction: 'none'` on `<svg>`.
- **Verification**: `npm run typecheck`, Vitest suite (`22/22`), and Playwright E2E drag & tap-to-place workflows across Desktop/Laptop/Tablet/Mobile (`5/5`).

#### QA-007 — `placeOrMovePlayer` & `setViewMode` state inconsistencies
- **Severity**: P1
- **Affected Module**: `src/store/useTacticalStore.ts`
- **Description**: Moving a player into a formation slot did not guarantee any other placement claiming the same `formationSlotId` had its slot claim cleared; switching `setViewMode` to single-team view could keep an off-team `selectedPlayerId` active.
- **Root Cause**: Missing slot-claim sanitization on `placeOrMovePlayer` and missing selection guard in `setViewMode`.
- **Fix Implemented**: `placeOrMovePlayer` clears matching `formationSlotId` claims from other placements in the phase; `setViewMode` clears `selectedPlayerId` when switching to single-team view hides the selected player's team.
- **Verification**: `src/tests/storeAndPhases.test.ts` (`6/6` passed).

---

### P2 — Medium (Usability Bugs, Search/Modal Edge Cases, Export Reliability)

#### QA-008 — `PlayerLibraryModal` stale selection across teams & missing side search terms
- **Severity**: P2
- **Affected Module**: `src/features/players/library/PlayerLibraryModal.tsx`
- **Description**: Switching teams could retain stale `queued` profiles, `Escape` did not close the modal, and searching by side designation text (e.g., `"Left"`, `"Central"`) returned no results.
- **Fix Implemented**: Added `Escape` key handler, cleared `queued` when `activeTeam` changes, added `sideDesignation` matching to search filtering, and added `aria-pressed` states on filter/toggle buttons.
- **Verification**: Vitest `uiInteractions.test.tsx` (`2/2`) and Playwright library workflows.

#### QA-009 — `ProjectManagerModal` persistent import error, missing `Escape`, and premature blob URL revocation
- **Severity**: P2
- **Affected Module**: `src/features/projects/components/ProjectManagerModal.tsx`
- **Description**: Reopening the project modal displayed old `importError` alerts, `Escape` did not dismiss the dialog, and immediate `URL.revokeObjectURL` after triggering export could race browser download reads.
- **Fix Implemented**: Cleared `importError` on modal open, added `Escape` close handler, enforced 5 MB import limit, and deferred `URL.revokeObjectURL` by `1000ms`.
- **Verification**: Playwright corrupted JSON import + download verification (`e2e/tactical-board.spec.ts`).

#### QA-010 — Overlapping/unclosable Phase menu, overlap popover dismissal, and corner duplication clipping
- **Severity**: P2
- **Affected Modules**: `src/features/phases/components/PhaseBar.tsx`, `src/features/pitch/components/PitchSvg.tsx`, `src/store/useTacticalStore.ts`
- **Description**: `Copy Phase To…` menu lacked outside click / `Escape` dismissal; pitch overlap selector lacked explicit close control and auto-reset; `duplicatePlayer` near top/right edges (`x > 0.92` or `y < 0.08`) could offset toward/against boundary clamping unintuitively.
- **Fix Implemented**:
  - `PhaseBar.tsx`: closes `Copy Phase To…` menu on outside `pointerdown` and `Escape`.
  - `PitchSvg.tsx`: added close `X` button and auto-reset on `overlapClusterIds`.
  - `useTacticalStore.ts`: added corner-safe offset logic (`x > 0.92` / `y < 0.08`) in `duplicatePlayer`.
- **Verification**: Vitest (`22/22`) and Playwright E2E (`5/5`).

#### QA-011 — Mobile floating inspector & tray overflow, stale project name editor on switch, unbounded rename
- **Severity**: P2
- **Affected Modules**: `src/app/App.tsx`, `src/features/players/components/UnplacedTray.tsx`, `src/components/layout/HeaderBar.tsx`, `src/store/useTacticalStore.ts`
- **Description**: On small mobile viewports, large unplaced trays or open inspectors could push pitch controls off-screen; switching projects while `isEditingName` was active left stale input state; project rename lacked trim/length guards.
- **Fix Implemented**:
  - `App.tsx`: added `max-h-[45%] overflow-y-auto` on mobile inspector container and `Escape` shortcut to cancel `stagedPlacement` or clear `selectedPlayerId`.
  - `UnplacedTray.tsx`: bounded tray height (`max-h-24 overflow-y-auto sm:max-h-28 lg:max-h-56`).
  - `HeaderBar.tsx`: reset `isEditingName` on `project.id` change and enforced `maxLength={120}` + error tooltip on save badge.
  - `useTacticalStore.ts`: added 120-char trim and no-op guard in `renameProject`.
- **Verification**: Playwright responsive checks at `390x844` and `1024x768` (`0` horizontal overflow, pitch visible & interactive).

---

### P3 — Low (Accessibility, Keyboard Focus, Non-Colour Coding Polish)

#### QA-012 — Missing ARIA states, keyboard focus indicators on SVG markers, and colour-only category cues
- **Severity**: P3
- **Affected Modules**: `PlayerMarker.tsx`, `PlayerInspector.tsx`, `UnplacedTray.tsx`, `PhaseBar.tsx`, `HeaderBar.tsx`, `PlayerLibraryModal.tsx`
- **Fix Implemented**:
  - `PlayerMarker.tsx`: added SVG `:focus-visible` focus ring (`.marker-focus-ring`).
  - `PlayerInspector.tsx`: added non-colour category/side labels (`category.fullName`, `position.sideDesignation`) alongside category badges and `aria-pressed` on foot toggles.
  - `PhaseBar.tsx`: added `aria-haspopup="menu"`, `aria-expanded`, and `aria-current="step"`.
  - `HeaderBar.tsx`, `UnplacedTray.tsx`, `PlayerLibraryModal.tsx`: added `aria-pressed` states on toggle buttons.
- **Verification**: Verified in Vitest DOM tests and Playwright suite.

---

## D. Automated Verification Results (Observed After Final Edit)

All checks below were executed cleanly **after** the final edit (`src/app/App.tsx`).

| Check | Command | Outcome | Scope / Exact Counts |
| :--- | :--- | :--- | :--- |
| TypeScript Build Check | `npm run typecheck` (`tsc -b --noEmit`) | **PASSED** (`exit 0`) | All project TS configs, `0` errors |
| Unit & Component Tests | `npm test` (`vitest run`) | **PASSED** (`exit 0`) | `5` test files, `22` passed, `0` failed, `0` skipped (`1.57s`): `coordinates.test.ts` (`4`), `formations.test.ts` (`6`), `persistenceAndMigrations.test.ts` (`4`), `storeAndPhases.test.ts` (`6`), `uiInteractions.test.tsx` (`2`) |
| Production Bundle | `npm run build` (`tsc -b && vite build`) | **PASSED** (`exit 0`) | `1621` modules transformed in `5.71s`; `dist/index.html` (`0.53 kB`), `dist/assets/index-BxJ-IUrN.css` (`35.89 kB`), `dist/assets/index-CtDef7oR.js` (`432.87 kB`) |
| E2E & Multi-Viewport Suite | `npm run test:e2e` (`playwright test`) | **PASSED** (`exit 0`) | `5` passed, `0` failed (`8.2s`): full tactical workflow + responsive & interaction checks at `Desktop (1440x900)`, `Laptop (1280x800)`, `Tablet (1024x768)`, `Mobile (390x844)`, `0` console/page errors |
| Production Preview Server | `npx vite preview --host 127.0.0.1 --port 4174` | **PASSED** (`exit 0`) | Responded `200 OK` serving `<div id="root">` |
| Dependency Security Audit | `npm audit --omit=dev` | **PASSED** | `0` production vulnerabilities (full `npm audit` had 3 dev-only `vitest` advisories) |

---

## E. Phase 1 Functional Coverage Verified

Verified working workflows in the Phase 1 codebase and test/E2E runs:
- Immediate launch to responsive SVG football pitch (`105:68` proportions, normalised `[0, 1]` coordinates) with Team A, Team B, and Both-team viewing modes.
- Full-screen Player Library with ATT / MID / DEF / GK category filters, position & side search, left/right footedness selection, multi-selection queue, duplicate profile addition, and unplaced-player tray workflow.
- Independent 7-preset formation loading (`4-3-3`, `4-2-3-1`, `4-4-2`, `3-5-2`, `3-4-3`, `4-1-4-1`, `4-3-2-1`), Hungarian bipartite auto-fill, free-form mode toggle, swap pitch ends, wheel zoom & drag pan, tap-to-place, pointer drag-and-drop, overlap cluster disambiguation, player inspection, duplication, and deletion.
- 5 independent tactical phases (`Build-up`, `Attacking Organisation`, `Attacking Transition`, `Defensive Organisation`, `Defensive Transition`) with isolated layouts and phase copying.
- Undo/redo history (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`/`Y`), debounced IndexedDB persistence (Dexie), project creation/rename/duplication/deletion, JSON export, and validated JSON import with size and integrity guards.

---

## F. Unimplemented Post-Phase 1 Scope (Phases 2–4 Gap Register)

The following capabilities described in the Post-Phase 4 QA prompt do **not** exist in this repository and were intentionally not invented or implemented during this hardening pass:
- **Phase 2**: Expanded specialised position/role catalogue (`roleId` remains `null`), position-role compatibility matrices, position-specific role filtering UI.
- **Phase 3**: Tactical archetype catalogue (`archetypeId` remains `null`), role-archetype compatibility, tactical behaviour properties, phase-specific role/instruction editors, tactical drawing tools (arrows, movement paths, zones, annotations; `drawingObjects: unknown[]` remains an empty placeholder array).
- **Phase 4**: Tactical compatibility analysis engine (positional compatibility, offensive/defensive structure, role synergy, footedness compatibility, deterministic scoring, confidence/completeness, weakness detection, findings, recommendations & previews, two-team comparative analysis, historical report comparison, PDF and compatibility-report JSON export).

---

## G. Honest Release Readiness Classification

- **Phase 1 (Tactical Board Foundation)**: **READY FOR USE** — All audited Phase 1 workflows, data-integrity guards, responsive layouts (`1440x900`, `1280x800`, `1024x768`, `390x844`), `tsc -b` typecheck, Vite production build, all `22` Vitest tests, and all `5` Playwright E2E specs pass with `0` console/page errors after the final edit.
- **Post-Phase 4 Release Gate**: **NOT READY** — Phases 2, 3, and 4 are unimplemented in this repository (`roleId`/`archetypeId` reserved as `null`, `drawingObjects` unrendered/empty, compatibility/reporting engine absent). Releasing against Post-Phase 4 product requirements requires implementing and subsequently auditing Phases 2–4.

---

## H. How to Run Verification Locally

```bash
npm ci --prefer-offline
npm run typecheck
npm test
npm run build
npx playwright install chromium   # first run only
npm run test:e2e
```
