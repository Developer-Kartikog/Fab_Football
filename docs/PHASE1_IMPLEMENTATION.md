# Phase 1 Implementation Checklist — Football Tactical Board

> **Scope:** Strictly Phase 1 (Tactical Board Foundation). Future-phase extension points (`roleId`, `archetypeId`, `drawingObjects`, `schemaVersion` migrations) are reserved in the domain schema without implementing Phase 2–4 features prematurely.

## Engineering Decisions

1. **Vertical Pitch Orientation (`68:105` aspect ratio)**: Default orientation renders Team A attacking upward (`y_team=0` at bottom goal, `y_team=1` at top goal) and Team B attacking downward (`y_team=0` at top goal, `y_team=1` at bottom goal), matching Section 6 ("Team A attacks towards the top, Team B attacks towards the bottom") and scaling cleanly across desktop (`1440×900`), laptop (`1280×800`), tablet (`1024×768`), and mobile (`390×844`).
2. **Team-Local Normalised Coordinates**: All player placements and formation slots store `(x, y)` in `[0, 1]` relative to their own team's defending goal (`y = 0`) and attacking goal (`y = 1`). Pitch-end swap transforms rendering without mutating stored coordinates.
3. **Deterministic Auto-Fill**: Uses the Kuhn–Munkres (Hungarian) maximum-weight bipartite assignment algorithm on unplaced eligible roster players × empty formation slots, strictly enforcing GK ↔ GK separation and prioritising exact position > category > side > preferred-foot tiebreaker.
4. **History Scope**: Bounded immutable snapshot history (50 states) tracks tactical mutations (players, placements, formations, phase copy/reset) while keeping view-navigation toggles (switching team/phase/view mode/free-form) non-destructive to undo/redo.

## Implementation Checklist

- [x] Project scaffolding (Vite, React, TypeScript strict, Tailwind CSS, Zustand, Dexie, Vitest, Playwright)
- [ ] Domain layer (`positions`, `players`, `teams`, `tactical-phases`, `formations`, `projects`)
- [ ] Pitch coordinate engine & SVG pitch renderer (`PitchSvg`, `PlayerMarker`, zoom/pan, end swap, overlap handling)
- [ ] Zustand tactical store & undo/redo history
- [ ] Persistence layer (Dexie IndexedDB, debounced autosave, project CRUD, JSON import/export, schema migrations)
- [ ] Full-screen Add Players library (ATT/MID/DEF/GK filters, search, foot selector, multi-add)
- [ ] Player markers, unplaced-player tray, drag-and-drop & tap-to-place, compact player inspector
- [ ] Five-phase navigation, copy phase, reset phase
- [ ] Formation presets (4-3-3, 4-2-3-1, 4-4-2, 3-5-2, 3-4-3, 4-1-4-1, 4-3-2-1), independent Load Formation, Auto-Fill, Free-Form toggle
- [ ] Responsive layout verification & automated test suite (Vitest + Playwright)
