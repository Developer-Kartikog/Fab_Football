import { describe, expect, it } from 'vitest';
import {
  PITCH_CONSTANTS,
  clientToSvgCoords,
  pitchWorldToTeamLocal,
  svgToTeamLocal,
  teamLocalToPitchWorld,
  teamLocalToSvg,
} from '@/features/pitch/engine/coordinates';

describe('Pitch coordinate engine', () => {
  it('maintains 105:68 pitch proportions', () => {
    expect(PITCH_CONSTANTS.FIELD_HEIGHT / PITCH_CONSTANTS.FIELD_WIDTH).toBeCloseTo(105 / 68, 6);
  });

  it('round-trips team-local coordinates for Team A and Team B in standard and swapped orientations', () => {
    const samplePoints = [
      { x: 0.16, y: 0.24 },
      { x: 0.5, y: 0.06 },
      { x: 0.84, y: 0.78 },
    ];

    for (const orientation of ['standard', 'swapped'] as const) {
      for (const teamId of ['A', 'B'] as const) {
        for (const pt of samplePoints) {
          const world = teamLocalToPitchWorld(pt.x, pt.y, teamId, orientation);
          const restored = pitchWorldToTeamLocal(world.x, world.y, teamId, orientation);
          expect(restored.x).toBeCloseTo(pt.x, 6);
          expect(restored.y).toBeCloseTo(pt.y, 6);

          const svg = teamLocalToSvg(pt.x, pt.y, teamId, orientation);
          const fromSvg = svgToTeamLocal(svg.x, svg.y, teamId, orientation);
          expect(fromSvg.x).toBeCloseTo(pt.x, 6);
          expect(fromSvg.y).toBeCloseTo(pt.y, 6);
        }
      }
    }
  });

  it('places Team A defending bottom and Team B defending top in standard orientation', () => {
    const gkA = teamLocalToSvg(0.5, 0.06, 'A', 'standard');
    const gkB = teamLocalToSvg(0.5, 0.06, 'B', 'standard');
    expect(gkA.y).toBeGreaterThan(gkB.y);

    const swappedGkA = teamLocalToSvg(0.5, 0.06, 'A', 'swapped');
    const swappedGkB = teamLocalToSvg(0.5, 0.06, 'B', 'swapped');
    expect(swappedGkA.y).toBeLessThan(swappedGkB.y);
  });

  it('converts client pointer coordinates to SVG coordinates across responsive viewports and zoom/pan', () => {
    const desktopRect = { left: 100, top: 50, width: 752, height: 1134 };
    const center = clientToSvgCoords(100 + 376, 50 + 567, desktopRect);
    expect(center.x).toBeCloseTo(PITCH_CONSTANTS.VIEWBOX_WIDTH / 2, 4);
    expect(center.y).toBeCloseTo(PITCH_CONSTANTS.VIEWBOX_HEIGHT / 2, 4);

    // Zoomed 2x at center should still map viewport center to SVG center
    const zoomedCenter = clientToSvgCoords(100 + 376, 50 + 567, desktopRect, {
      zoom: 2,
      panX: 0,
      panY: 0,
    });
    expect(zoomedCenter.x).toBeCloseTo(PITCH_CONSTANTS.VIEWBOX_WIDTH / 2, 4);
    expect(zoomedCenter.y).toBeCloseTo(PITCH_CONSTANTS.VIEWBOX_HEIGHT / 2, 4);
  });
});
