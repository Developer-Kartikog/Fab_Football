Build a comprehensive, production-ready, interactive football tactical board web application that enables users to construct, visualise, and analyse football tactical systems using generic players, positions, roles, archetypes, an independent five-phase tactical system, and an explainable compatibility analysis engine.

Working directory: /Users/kartikchaturvedi/Library/Mobile Documents/com~apple~CloudDocs/Developer/FAB_Football
Integrity mode: demo
The team must NOT: copy code from existing open-source projects for core logic

Architecture diagram reference: /Users/kartikchaturvedi/.gemini/antigravity/brain/2e378cbd-a4dd-4dfb-9f6e-af8c507c358a/.user_uploaded/media_1794467672402_550a75dc.png

## Requirements

### R1. Execution Planning and Progressive Delivery
Create and get approval on a detailed execution plan (`/plan`) before implementing. The team decides the execution progression across the 4-phase PRD roadmap, establishing Phase 1 (Tactical Board Foundation: full pitch, Team A/B view, 5-phase data model, generic profiles, drag-and-drop/tap-to-place, formation templates, free-form mode, local persistence) and progressing through Phase 2 (complete position & role library), Phase 3 (archetypes, drawing tools, tactical instructions), and Phase 4 (compatibility tester). Focus solely on the Football Tactical Board application, excluding external plugin configurations.

### R2. Pitch Workspace and Responsive User Interface
Deliver an interactive tactical board interface where the full-size pitch is the primary workspace using normalized coordinates (0.0 to 1.0) independent of screen pixels, rendered via SVG with pointer events for both desktop and mobile viewports (1440x900, 1280x800, 1024x768, 390x844).
- Provide full-pitch view, attacking direction toggle, team end swapping, zoom, and pan.
- Support two independent generic teams (Team A and Team B) with viewing modes for Team A focus, Team B focus, and simultaneous two-team view.
- Marker category colors (ATT: red, MID: green, DEF: blue, GK: orange) remain consistent, with distinct Team A and Team B border/outline identifiers.
- Provide full undo and redo history for board manipulations.

### R3. Generic Player System and Taxonomy
Implement generic tactical player profiles with unique internal IDs, separated from phase-specific pitch assignments.
- Profile attributes: primary position, primary role, primary archetype, and preferred foot (left/right). Strictly exclude real-life players, clubs, ratings, or stats.
- Provide a responsive / full-screen player library with search, category filtering (ATT, MID, DEF, GK), position/role/archetype filtering, foot selection, and profile preview.
- Minimal player markers on pitch display position abbreviations and category colors, opening a detailed inspector on selection.

### R4. Formation Engine and Five-Phase Tactical System
Provide formation management and an independent five-phase tactical system for each team.
- Formation presets (e.g., 4-3-3, 4-2-3-1, 4-4-2, 3-5-2, 3-4-3, 4-1-4-1, 4-3-2-1) support independent slot loading and automatic lineup filling based on compatibility priority (position, role, archetype, side, footedness) without discarding unassigned players or overwriting silently. Free-form mode allows unrestricted coordinates.
- Maintain persistent player identity across all five independent tactical phases per team: Build-up, Attacking organisation, Defensive transition, Defensive organisation, and Attacking transition.
- Each phase stores coordinates, position overrides, and role overrides. Support phase switching, layout copying, and resets.

### R5. Tactical Compatibility Engine and Local Persistence
Provide explainable tactical analysis and local-first persistence.
- Deterministic rule-based compatibility engine evaluating positional compatibility, tactical balance, offensive structure, defensive structure, role synergy, and footedness compatibility. Generate phase scores (0-100), detected weaknesses, structural strengths, and actionable recommendations without predicting match outcomes or fabricating issues.
- Local-first persistence using browser storage (IndexedDB) with autosave, project save/load/duplicate/delete, JSON export/import with schema validation, and PNG/SVG tactical board export. No external account or backend required.

## Acceptance Criteria

### Planning and Verification
- [ ] Detailed implementation plan is presented and approved before writing application code (`/plan`).
- [ ] Vitest automated test suite passes with tests covering coordinate conversions, formation auto-fill priority, role-position compatibility, and five-phase state persistence.
- [ ] Browser-based verification (`/browser` / Playwright) confirms full user flow across desktop and mobile viewports without console errors.

### Pitch Workspace and Controls
- [ ] Pitch renders full-size and player markers can be placed and moved via drag-and-drop and tap-to-place on both desktop (1440x900) and mobile (390x844) viewports.
- [ ] Switching between Team A focus, Team B focus, and two-team simultaneous view correctly displays team-specific lineups and distinct marker outlines.
- [ ] Pitch zoom, pan, attacking direction toggle, and team end swap update visual display without corrupting normalized player coordinates.
- [ ] Undo and redo actions correctly step backward and forward through tactical board positioning changes.

### Player System and Taxonomy
- [ ] Player library allows searching and filtering across categories (ATT, MID, DEF, GK), positions, roles, archetypes, and footedness (left/right).
- [ ] Selecting a player marker on the pitch opens the detailed inspector displaying its position, role, archetype, footedness, and phase assignments.
- [ ] Adding multiple generic players with identical attributes creates distinct player instances with unique IDs.

### Formation and Five-Phase Tactical Engine
- [ ] Loading a formation template sets player positional slots while leaving free-form movement unlocked.
- [ ] Automatic lineup filling assigns players by compatibility priority, leaving unassigned players in an unplaced roster without data loss.
- [ ] Switching between all five tactical phases (Build-up, Attacking organisation, Defensive transition, Defensive organisation, Attacking transition) retains player identities while applying phase-specific coordinates and overrides.
- [ ] Layout copying between phases transfers coordinates and overrides without mutating other phases.

### Persistence and Compatibility Engine
- [ ] Project state (rosters, formations, phase assignments for both teams) persists across page reloads via IndexedDB autosave.
- [ ] Projects can be exported to valid JSON and re-imported without loss or schema errors.
- [ ] Pitch view can be exported as PNG and SVG.
- [ ] Compatibility engine computes explainable scores (0-100) and lists structural strengths, detected weaknesses, and recommendations for configured lineups across tactical phases.
