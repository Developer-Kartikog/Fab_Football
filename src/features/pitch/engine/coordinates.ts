import type { TeamId } from '@/domain/players/types';
import type { PitchOrientation } from '@/domain/projects/types';

export const PITCH_CONSTANTS = {
  FIELD_WIDTH: 680,
  FIELD_HEIGHT: 1050,
  PADDING_X: 36,
  PADDING_Y: 42,
  VIEWBOX_WIDTH: 752,
  VIEWBOX_HEIGHT: 1134,
  ASPECT_RATIO: 105 / 68,
} as const;

export interface Point2D {
  x: number;
  y: number;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

export function isAttackingTop(teamId: TeamId, orientation: PitchOrientation): boolean {
  if (orientation === 'standard') {
    return teamId === 'A';
  }
  return teamId === 'B';
}

export function teamLocalToPitchWorld(
  x: number,
  y: number,
  teamId: TeamId,
  orientation: PitchOrientation,
): Point2D {
  const cx = clamp01(x);
  const cy = clamp01(y);
  if (isAttackingTop(teamId, orientation)) {
    return { x: cx, y: 1 - cy };
  }
  return { x: 1 - cx, y: cy };
}

export function pitchWorldToTeamLocal(
  wx: number,
  wy: number,
  teamId: TeamId,
  orientation: PitchOrientation,
): Point2D {
  const cwx = clamp01(wx);
  const cwy = clamp01(wy);
  if (isAttackingTop(teamId, orientation)) {
    return { x: cwx, y: 1 - cwy };
  }
  return { x: 1 - cwx, y: cwy };
}

export function pitchWorldToSvg(wx: number, wy: number): Point2D {
  return {
    x: PITCH_CONSTANTS.PADDING_X + clamp01(wx) * PITCH_CONSTANTS.FIELD_WIDTH,
    y: PITCH_CONSTANTS.PADDING_Y + clamp01(wy) * PITCH_CONSTANTS.FIELD_HEIGHT,
  };
}

export function svgToPitchWorld(svgX: number, svgY: number): Point2D {
  return {
    x: clamp01((svgX - PITCH_CONSTANTS.PADDING_X) / PITCH_CONSTANTS.FIELD_WIDTH),
    y: clamp01((svgY - PITCH_CONSTANTS.PADDING_Y) / PITCH_CONSTANTS.FIELD_HEIGHT),
  };
}

export function teamLocalToSvg(
  x: number,
  y: number,
  teamId: TeamId,
  orientation: PitchOrientation,
): Point2D {
  const world = teamLocalToPitchWorld(x, y, teamId, orientation);
  return pitchWorldToSvg(world.x, world.y);
}

export function svgToTeamLocal(
  svgX: number,
  svgY: number,
  teamId: TeamId,
  orientation: PitchOrientation,
): Point2D {
  const world = svgToPitchWorld(svgX, svgY);
  return pitchWorldToTeamLocal(world.x, world.y, teamId, orientation);
}

export interface ViewportTransform {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Converts client pointer coordinates to SVG pitch coordinates, accounting for
 * responsive SVG scaling and optional camera zoom/pan transform.
 */
export function clientToSvgCoords(
  clientX: number,
  clientY: number,
  svgRect: { left: number; top: number; width: number; height: number },
  transform: ViewportTransform = { zoom: 1, panX: 0, panY: 0 },
): Point2D {
  if (svgRect.width <= 0 || svgRect.height <= 0) {
    return { x: PITCH_CONSTANTS.VIEWBOX_WIDTH / 2, y: PITCH_CONSTANTS.VIEWBOX_HEIGHT / 2 };
  }

  // Account for preserveAspectRatio="xMidYMid meet"
  const scaleX = svgRect.width / PITCH_CONSTANTS.VIEWBOX_WIDTH;
  const scaleY = svgRect.height / PITCH_CONSTANTS.VIEWBOX_HEIGHT;
  const scale = Math.min(scaleX, scaleY);

  const renderedWidth = PITCH_CONSTANTS.VIEWBOX_WIDTH * scale;
  const renderedHeight = PITCH_CONSTANTS.VIEWBOX_HEIGHT * scale;
  const offsetX = svgRect.left + (svgRect.width - renderedWidth) / 2;
  const offsetY = svgRect.top + (svgRect.height - renderedHeight) / 2;

  const baseSvgX = (clientX - offsetX) / scale;
  const baseSvgY = (clientY - offsetY) / scale;

  const cx = PITCH_CONSTANTS.VIEWBOX_WIDTH / 2;
  const cy = PITCH_CONSTANTS.VIEWBOX_HEIGHT / 2;

  // Inverse of: translate(cx + panX, cy + panY) scale(zoom) translate(-cx, -cy)
  const svgX = (baseSvgX - cx - transform.panX) / transform.zoom + cx;
  const svgY = (baseSvgY - cy - transform.panY) / transform.zoom + cy;

  return { x: svgX, y: svgY };
}
