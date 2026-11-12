import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { ArrowUpDown, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { FormationSlot } from '@/domain/formations/types';
import type { PlayerInstance, TeamId } from '@/domain/players/types';
import { CATEGORY_META, getPositionById } from '@/domain/positions/taxonomy';
import { useTacticalStore } from '@/store/useTacticalStore';
import {
  PITCH_CONSTANTS,
  clientToSvgCoords,
  isAttackingTop,
  svgToTeamLocal,
  teamLocalToSvg,
  type ViewportTransform,
} from '../engine/coordinates';
import { PlayerMarker } from './PlayerMarker';

interface DragSession {
  playerId: string;
  teamId: TeamId;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  hasMoved: boolean;
  svgX: number;
  svgY: number;
}

interface PanSession {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  initialPanX: number;
  initialPanY: number;
  hasMoved: boolean;
}

interface RenderMarkerItem {
  player: PlayerInstance;
  svgX: number;
  svgY: number;
  isActiveTeam: boolean;
  overlapCount: number;
}

const SLOT_SNAP_THRESHOLD_SVG = 34;

function clampTransform(next: ViewportTransform): ViewportTransform {
  const zoom = Math.max(1, Math.min(2.5, Number(next.zoom.toFixed(2))));
  if (zoom <= 1) {
    return { zoom: 1, panX: 0, panY: 0 };
  }
  const maxPanX = ((zoom - 1) * PITCH_CONSTANTS.VIEWBOX_WIDTH) / 2 + 120;
  const maxPanY = ((zoom - 1) * PITCH_CONSTANTS.VIEWBOX_HEIGHT) / 2 + 120;
  return {
    zoom,
    panX: Math.max(-maxPanX, Math.min(maxPanX, next.panX)),
    panY: Math.max(-maxPanY, Math.min(maxPanY, next.panY)),
  };
}

export function PitchSvg() {
  const project = useTacticalStore((s) => s.project);
  const selectedPlayerId = useTacticalStore((s) => s.selectedPlayerId);
  const stagedPlacement = useTacticalStore((s) => s.stagedPlacement);
  const selectPlayer = useTacticalStore((s) => s.selectPlayer);
  const setStagedPlacement = useTacticalStore((s) => s.setStagedPlacement);
  const placeOrMovePlayer = useTacticalStore((s) => s.placeOrMovePlayer);
  const unplacePlayerFromCurrentPhase = useTacticalStore(
    (s) => s.unplacePlayerFromCurrentPhase,
  );
  const toggleOrientation = useTacticalStore((s) => s.toggleOrientation);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [transform, setTransform] = useState<ViewportTransform>({
    zoom: 1,
    panX: 0,
    panY: 0,
  });
  const [dragSession, setDragSession] = useState<DragSession | null>(null);
  const [panSession, setPanSession] = useState<PanSession | null>(null);
  const [overlapClusterIds, setOverlapClusterIds] = useState<string[] | null>(null);

  const activeTeamId = project.activeTeam;
  const activePhaseId = project.activePhase;
  const orientation = project.orientation;

  useEffect(() => {
    setOverlapClusterIds(null);
  }, [activeTeamId, activePhaseId, project.activeViewMode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      setTransform((prev) => clampTransform({ ...prev, zoom: prev.zoom + delta }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    if (!dragSession && !panSession) return;
    const handleWindowBlur = () => {
      setDragSession(null);
      setPanSession(null);
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [dragSession, panSession]);

  const visibleTeams: TeamId[] = useMemo(() => {
    if (project.activeViewMode === 'A') return ['A'];
    if (project.activeViewMode === 'B') return ['B'];
    return ['A', 'B'];
  }, [project.activeViewMode]);

  const activeTeamLayout = project.teams[activeTeamId].tacticalPhases[activePhaseId];

  // Formation ghost slots for the active editing team (hidden in free-form mode)
  const ghostSlots = useMemo(() => {
    if (project.freeFormMode) return [];
    const slotOccupant = new Map<string, string>();
    for (const p of activeTeamLayout.playerPlacements) {
      if (p.formationSlotId) {
        slotOccupant.set(p.formationSlotId, p.playerId);
      }
    }
    return activeTeamLayout.formationSlots.map((slot) => {
      const occupantPlayerId = slotOccupant.get(slot.id) ?? null;
      return {
        slot,
        occupied: occupantPlayerId !== null,
        occupantPlayerId,
        svg: teamLocalToSvg(slot.x, slot.y, activeTeamId, orientation),
      };
    });
  }, [project.freeFormMode, activeTeamLayout, activeTeamId, orientation]);

  // Collect visible placed markers with overlap calculation
  const renderedMarkers: RenderMarkerItem[] = useMemo(() => {
    const items: RenderMarkerItem[] = [];

    // Draw inactive reference team first so active team markers stay on top
    const orderedTeams =
      visibleTeams.length === 2
        ? visibleTeams[0] === activeTeamId
          ? [visibleTeams[1], visibleTeams[0]]
          : [visibleTeams[0], visibleTeams[1]]
        : visibleTeams;

    for (const teamId of orderedTeams) {
      const team = project.teams[teamId];
      const layout = team.tacticalPhases[activePhaseId];
      const rosterMap = new Map(team.roster.map((p) => [p.id, p]));

      for (const placement of layout.playerPlacements) {
        const player = rosterMap.get(placement.playerId);
        if (!player) continue;

        const isBeingDragged = dragSession?.playerId === player.id;
        const pos = isBeingDragged
          ? { x: dragSession.svgX, y: dragSession.svgY }
          : teamLocalToSvg(placement.x, placement.y, teamId, orientation);

        items.push({
          player,
          svgX: pos.x,
          svgY: pos.y,
          isActiveTeam: teamId === activeTeamId,
          overlapCount: 1,
        });
      }
    }

    // Count close overlaps so user knows markers are stacked
    for (let i = 0; i < items.length; i += 1) {
      let count = 0;
      for (let j = 0; j < items.length; j += 1) {
        const dx = items[i].svgX - items[j].svgX;
        const dy = items[i].svgY - items[j].svgY;
        if (Math.hypot(dx, dy) < 28) {
          count += 1;
        }
      }
      items[i].overlapCount = count;
    }

    return items;
  }, [visibleTeams, activeTeamId, project.teams, activePhaseId, dragSession, orientation]);

  const getSvgPointFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: PITCH_CONSTANTS.VIEWBOX_WIDTH / 2, y: PITCH_CONSTANTS.VIEWBOX_HEIGHT / 2 };
      const rect = svg.getBoundingClientRect();
      return clientToSvgCoords(clientX, clientY, rect, transform);
    },
    [transform],
  );

  const findNearestEmptySlot = useCallback(
    (svgX: number, svgY: number, excludePlayerId?: string): FormationSlot | null => {
      if (project.freeFormMode || ghostSlots.length === 0) return null;
      let best: { slot: FormationSlot; dist: number } | null = null;
      for (const item of ghostSlots) {
        if (item.occupied && item.occupantPlayerId !== excludePlayerId) continue;
        const dist = Math.hypot(item.svg.x - svgX, item.svg.y - svgY);
        if (dist <= SLOT_SNAP_THRESHOLD_SVG && (!best || dist < best.dist)) {
          best = { slot: item.slot, dist };
        }
      }
      return best?.slot ?? null;
    },
    [project.freeFormMode, ghostSlots],
  );

  const handleMarkerPointerDown = useCallback(
    (e: React.PointerEvent<SVGGElement>, player: PlayerInstance) => {
      e.stopPropagation();
      setOverlapClusterIds(null);

      // If another player is staged for tap-to-place and user taps an existing marker, still select or handle cleanly
      if (player.teamId !== activeTeamId) {
        // Non-active team marker: allow selecting for inspection, no dragging
        selectPlayer(player.id);
        return;
      }

      const item = renderedMarkers.find((m) => m.player.id === player.id);
      if (!item) return;

      try {
        svgRef.current?.setPointerCapture(e.pointerId);
      } catch {
        // Ignore in synthetic test environments where pointerCapture is unsupported
      }

      setDragSession({
        playerId: player.id,
        teamId: player.teamId,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        hasMoved: false,
        svgX: item.svgX,
        svgY: item.svgY,
      });
    },
    [activeTeamId, renderedMarkers, selectPlayer],
  );

  const handleSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (dragSession && dragSession.pointerId === e.pointerId) {
        const dist = Math.hypot(
          e.clientX - dragSession.startClientX,
          e.clientY - dragSession.startClientY,
        );
        const svgPt = getSvgPointFromClient(e.clientX, e.clientY);
        const clampedX = Math.max(
          PITCH_CONSTANTS.PADDING_X,
          Math.min(PITCH_CONSTANTS.PADDING_X + PITCH_CONSTANTS.FIELD_WIDTH, svgPt.x),
        );
        const clampedY = Math.max(
          PITCH_CONSTANTS.PADDING_Y,
          Math.min(PITCH_CONSTANTS.PADDING_Y + PITCH_CONSTANTS.FIELD_HEIGHT, svgPt.y),
        );

        setDragSession((prev) =>
          prev
            ? {
                ...prev,
                hasMoved: prev.hasMoved || dist > 4,
                svgX: clampedX,
                svgY: clampedY,
              }
            : null,
        );
        return;
      }

      if (panSession && panSession.pointerId === e.pointerId) {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const scale = Math.min(
          rect.width / PITCH_CONSTANTS.VIEWBOX_WIDTH,
          rect.height / PITCH_CONSTANTS.VIEWBOX_HEIGHT,
        );
        if (scale <= 0) return;

        const dxClient = e.clientX - panSession.startClientX;
        const dyClient = e.clientY - panSession.startClientY;
        const moved = Math.hypot(dxClient, dyClient) > 4;

        if (transform.zoom > 1 || moved) {
          const maxPanX = ((transform.zoom - 1) * PITCH_CONSTANTS.VIEWBOX_WIDTH) / 2 + 120;
          const maxPanY = ((transform.zoom - 1) * PITCH_CONSTANTS.VIEWBOX_HEIGHT) / 2 + 120;
          const nextPanX = Math.max(
            -maxPanX,
            Math.min(maxPanX, panSession.initialPanX + dxClient / scale),
          );
          const nextPanY = Math.max(
            -maxPanY,
            Math.min(maxPanY, panSession.initialPanY + dyClient / scale),
          );
          setTransform((prev) => ({ ...prev, panX: nextPanX, panY: nextPanY }));
          setPanSession((prev) => (prev ? { ...prev, hasMoved: prev.hasMoved || moved } : null));
        }
      }
    },
    [dragSession, panSession, getSvgPointFromClient, transform.zoom],
  );

  const handleSvgPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (dragSession && dragSession.pointerId === e.pointerId) {
        try {
          svgRef.current?.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore when unsupported
        }
        if (dragSession.hasMoved) {
          const snapSlot = findNearestEmptySlot(
            dragSession.svgX,
            dragSession.svgY,
            dragSession.playerId,
          );
          if (snapSlot) {
            placeOrMovePlayer(
              dragSession.teamId,
              dragSession.playerId,
              snapSlot.x,
              snapSlot.y,
              snapSlot.id,
            );
          } else {
            const local = svgToTeamLocal(
              dragSession.svgX,
              dragSession.svgY,
              dragSession.teamId,
              orientation,
            );
            placeOrMovePlayer(dragSession.teamId, dragSession.playerId, local.x, local.y, null);
          }
          selectPlayer(dragSession.playerId);
        } else {
          // Click/tap without drag: check if multiple markers overlap here
          const overlapping = renderedMarkers.filter(
            (m) => Math.hypot(m.svgX - dragSession.svgX, m.svgY - dragSession.svgY) < 28,
          );
          if (overlapping.length > 1) {
            setOverlapClusterIds(overlapping.map((o) => o.player.id));
            // Cycle selection through overlapping markers for quick access
            const currentIdx = overlapping.findIndex((o) => o.player.id === selectedPlayerId);
            const nextIdx = (currentIdx + 1) % overlapping.length;
            selectPlayer(overlapping[nextIdx].player.id);
          } else {
            selectPlayer(
              selectedPlayerId === dragSession.playerId ? null : dragSession.playerId,
            );
          }
        }
        setDragSession(null);
        return;
      }

      if (panSession && panSession.pointerId === e.pointerId) {
        try {
          svgRef.current?.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore when unsupported
        }
        if (!panSession.hasMoved) {
          // Tap on empty pitch
          if (stagedPlacement && stagedPlacement.teamId === activeTeamId) {
            const svgPt = getSvgPointFromClient(e.clientX, e.clientY);
            const snapSlot = findNearestEmptySlot(svgPt.x, svgPt.y);
            if (snapSlot) {
              placeOrMovePlayer(
                stagedPlacement.teamId,
                stagedPlacement.playerId,
                snapSlot.x,
                snapSlot.y,
                snapSlot.id,
              );
            } else {
              const local = svgToTeamLocal(svgPt.x, svgPt.y, stagedPlacement.teamId, orientation);
              placeOrMovePlayer(
                stagedPlacement.teamId,
                stagedPlacement.playerId,
                local.x,
                local.y,
                null,
              );
            }
            selectPlayer(stagedPlacement.playerId);
            setStagedPlacement(null);
          } else {
            selectPlayer(null);
            setOverlapClusterIds(null);
          }
        }
        setPanSession(null);
      }
    },
    [
      dragSession,
      panSession,
      findNearestEmptySlot,
      placeOrMovePlayer,
      orientation,
      selectPlayer,
      renderedMarkers,
      selectedPlayerId,
      stagedPlacement,
      activeTeamId,
      getSvgPointFromClient,
      setStagedPlacement,
    ],
  );

  const handleSvgPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      try {
        svgRef.current?.setPointerCapture(e.pointerId);
      } catch {
        // Ignore in synthetic test environments
      }
      setPanSession({
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        initialPanX: transform.panX,
        initialPanY: transform.panY,
        hasMoved: false,
      });
    },
    [transform.panX, transform.panY],
  );

  const handleMarkerKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGGElement>, player: PlayerInstance) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectPlayer(player.id);
        return;
      }

      if (player.teamId !== activeTeamId) return;

      const layout = project.teams[player.teamId].tacticalPhases[activePhaseId];
      const placement = layout.playerPlacements.find((p) => p.playerId === player.id);
      if (!placement) return;

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        unplacePlayerFromCurrentPhase(player.teamId, player.id);
        return;
      }

      const step = e.shiftKey ? 0.05 : 0.02;
      const attacksTop = isAttackingTop(player.teamId, orientation);
      let dxWorld = 0;
      let dyWorld = 0;
      if (e.key === 'ArrowLeft') dxWorld = -step;
      else if (e.key === 'ArrowRight') dxWorld = step;
      else if (e.key === 'ArrowUp') dyWorld = -step;
      else if (e.key === 'ArrowDown') dyWorld = step;
      else return;

      e.preventDefault();
      const dxLocal = attacksTop ? dxWorld : -dxWorld;
      const dyLocal = attacksTop ? -dyWorld : dyWorld;
      placeOrMovePlayer(
        player.teamId,
        player.id,
        placement.x + dxLocal,
        placement.y + dyLocal,
        null,
      );
    },
    [
      selectPlayer,
      activeTeamId,
      project.teams,
      activePhaseId,
      unplacePlayerFromCurrentPhase,
      orientation,
      placeOrMovePlayer,
    ],
  );

  // Support HTML5 drag-and-drop from the Unplaced Tray onto the pitch
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('application/x-tactical-player')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const raw = e.dataTransfer.getData('application/x-tactical-player');
    if (!raw) return;
    e.preventDefault();
    try {
      const payload = JSON.parse(raw) as { playerId: string; teamId: TeamId };
      if (payload.teamId !== activeTeamId) return;
      const svgPt = getSvgPointFromClient(e.clientX, e.clientY);
      const snapSlot = findNearestEmptySlot(svgPt.x, svgPt.y);
      if (snapSlot) {
        placeOrMovePlayer(payload.teamId, payload.playerId, snapSlot.x, snapSlot.y, snapSlot.id);
      } else {
        const local = svgToTeamLocal(svgPt.x, svgPt.y, payload.teamId, orientation);
        placeOrMovePlayer(payload.teamId, payload.playerId, local.x, local.y, null);
      }
      selectPlayer(payload.playerId);
      setStagedPlacement(null);
    } catch {
      // Ignore invalid drag payload
    }
  };

  const zoomIn = () =>
    setTransform((prev) => clampTransform({ ...prev, zoom: prev.zoom + 0.25 }));

  const zoomOut = () =>
    setTransform((prev) => clampTransform({ ...prev, zoom: prev.zoom - 0.25 }));

  const resetView = () => setTransform({ zoom: 1, panX: 0, panY: 0 });

  const teamAAttacksTop = isAttackingTop('A', orientation);
  const cx = PITCH_CONSTANTS.VIEWBOX_WIDTH / 2;
  const cy = PITCH_CONSTANTS.VIEWBOX_HEIGHT / 2;

  const overlapPlayers = useMemo(() => {
    if (!overlapClusterIds || overlapClusterIds.length < 2) return [];
    return overlapClusterIds
      .map((id) => renderedMarkers.find((m) => m.player.id === id)?.player)
      .filter((p): p is PlayerInstance => Boolean(p));
  }, [overlapClusterIds, renderedMarkers]);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-[#0d1013]"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Tap-to-place active indicator */}
      {stagedPlacement && (
        <div className="pointer-events-none absolute top-2.5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-emerald-400/50 bg-emerald-950/90 px-3 py-1 text-center text-xs font-medium text-emerald-100 shadow-md">
          Tap pitch or slot to place player (Esc to cancel)
        </div>
      )}

      {/* Overlap selector popover when multiple players are stacked */}
      {overlapPlayers.length > 1 && (
        <div className="absolute top-11 left-3 z-20 rounded-md border border-zinc-700 bg-[#181b20]/95 p-2 shadow-xl">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Overlapping Markers
            </span>
            <button
              type="button"
              onClick={() => setOverlapClusterIds(null)}
              aria-label="Close overlapping markers list"
              className="rounded p-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {overlapPlayers.map((p) => {
              const pos = getPositionById(p.positionId);
              const cat = CATEGORY_META[pos.category];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    selectPlayer(p.id);
                    setOverlapClusterIds(null);
                  }}
                  className={`flex items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-zinc-800 ${
                    selectedPlayerId === p.id ? 'bg-zinc-800 text-white' : 'text-zinc-300'
                  }`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-semibold">{pos.abbreviation}</span>
                  <span className="text-zinc-400">Team {p.teamId}</span>
                  <span className="text-zinc-500 capitalize">({p.preferredFoot})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact pitch camera & orientation controls */}
      <div className="absolute right-2.5 top-2.5 z-20 flex items-center gap-1 rounded-md border border-zinc-700/80 bg-[#16191e]/90 p-1 shadow-md backdrop-blur-sm">
        <button
          type="button"
          onClick={toggleOrientation}
          title="Swap pitch ends"
          aria-label="Swap pitch ends"
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Swap Ends</span>
        </button>
        <div className="h-4 w-px bg-zinc-700" />
        <button
          type="button"
          onClick={zoomOut}
          disabled={transform.zoom <= 1}
          title="Zoom out"
          aria-label="Zoom out"
          className="rounded p-1 text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[2.4rem] text-center text-[11px] font-medium tabular-nums text-zinc-300">
          {Math.round(transform.zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={zoomIn}
          disabled={transform.zoom >= 2.5}
          title="Zoom in"
          aria-label="Zoom in"
          className="rounded p-1 text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        {(transform.zoom !== 1 || transform.panX !== 0 || transform.panY !== 0) && (
          <button
            type="button"
            onClick={resetView}
            title="Reset zoom and pan"
            aria-label="Reset zoom and pan"
            className="rounded p-1 text-zinc-300 hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Responsive SVG Tactical Pitch (105:68 proportions, viewBox 752x1134) */}
      <svg
        ref={svgRef}
        data-testid="tactical-pitch-svg"
        viewBox={`0 0 ${PITCH_CONSTANTS.VIEWBOX_WIDTH} ${PITCH_CONSTANTS.VIEWBOX_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className={`h-full w-full max-h-full max-w-full select-none ${
          stagedPlacement ? 'cursor-crosshair' : transform.zoom > 1 ? 'cursor-grab' : 'cursor-default'
        }`}
        style={{ touchAction: 'none' }}
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        onPointerCancel={() => {
          setDragSession(null);
          setPanSession(null);
        }}
      >
        <g
          transform={`translate(${cx + transform.panX}, ${cy + transform.panY}) scale(${transform.zoom}) translate(${-cx}, ${-cy})`}
        >
          {/* Outer pitch apron */}
          <rect
            x={0}
            y={0}
            width={PITCH_CONSTANTS.VIEWBOX_WIDTH}
            height={PITCH_CONSTANTS.VIEWBOX_HEIGHT}
            fill="#143a23"
          />

          {/* Main grass surface */}
          <rect
            x={PITCH_CONSTANTS.PADDING_X}
            y={PITCH_CONSTANTS.PADDING_Y}
            width={PITCH_CONSTANTS.FIELD_WIDTH}
            height={PITCH_CONSTANTS.FIELD_HEIGHT}
            fill="#1b4d2e"
          />

          {/* Subtle mowing stripes (10 alternating bands) */}
          {Array.from({ length: 10 }, (_, idx) => {
            const bandH = PITCH_CONSTANTS.FIELD_HEIGHT / 10;
            return idx % 2 === 0 ? (
              <rect
                key={idx}
                x={PITCH_CONSTANTS.PADDING_X}
                y={PITCH_CONSTANTS.PADDING_Y + idx * bandH}
                width={PITCH_CONSTANTS.FIELD_WIDTH}
                height={bandH}
                fill="#1f5634"
              />
            ) : null;
          })}

          {/* Pitch markings group */}
          <g stroke="rgba(255,255,255,0.78)" strokeWidth={2.4} fill="none">
            {/* Outer touchlines & goal lines */}
            <rect
              x={PITCH_CONSTANTS.PADDING_X}
              y={PITCH_CONSTANTS.PADDING_Y}
              width={PITCH_CONSTANTS.FIELD_WIDTH}
              height={PITCH_CONSTANTS.FIELD_HEIGHT}
            />

            {/* Halfway line */}
            <line
              x1={PITCH_CONSTANTS.PADDING_X}
              y1={567}
              x2={PITCH_CONSTANTS.PADDING_X + PITCH_CONSTANTS.FIELD_WIDTH}
              y2={567}
            />

            {/* Centre circle (r = 9.15m -> 91.5) & centre spot */}
            <circle cx={376} cy={567} r={91.5} />
            <circle cx={376} cy={567} r={3.5} fill="rgba(255,255,255,0.88)" stroke="none" />

            {/* Top penalty area (40.32m x 16.5m -> 403.2 x 165) */}
            <rect x={174.4} y={42} width={403.2} height={165} />
            {/* Top goal area (18.32m x 5.5m -> 183.2 x 55) */}
            <rect x={284.4} y={42} width={183.2} height={55} />
            {/* Top penalty spot (11m -> 110 from y=42 -> y=152) */}
            <circle cx={376} cy={152} r={3.2} fill="rgba(255,255,255,0.88)" stroke="none" />
            {/* Top penalty arc (circle r=91.5 centered at (376,152) intersecting y=207 at dx = sqrt(91.5^2 - 55^2) = 73.12) */}
            <path d="M 302.88 207 A 91.5 91.5 0 0 0 449.12 207" />

            {/* Bottom penalty area */}
            <rect x={174.4} y={927} width={403.2} height={165} />
            {/* Bottom goal area */}
            <rect x={284.4} y={1037} width={183.2} height={55} />
            {/* Bottom penalty spot (11m from y=1092 -> y=982) */}
            <circle cx={376} cy={982} r={3.2} fill="rgba(255,255,255,0.88)" stroke="none" />
            {/* Bottom penalty arc */}
            <path d="M 302.88 927 A 91.5 91.5 0 0 1 449.12 927" />

            {/* Corner arcs (r = 10) */}
            <path d="M 36 52 A 10 10 0 0 0 46 42" />
            <path d="M 706 42 A 10 10 0 0 0 716 52" />
            <path d="M 36 1082 A 10 10 0 0 1 46 1092" />
            <path d="M 706 1092 A 10 10 0 0 1 716 1082" />

            {/* Top goal (7.32m wide -> 73.2 centered at 376 => 339.4..412.6, depth 22) */}
            <rect
              x={339.4}
              y={20}
              width={73.2}
              height={22}
              fill="rgba(255,255,255,0.06)"
              stroke="rgba(255,255,255,0.88)"
              strokeWidth={2.4}
            />
            {/* Bottom goal */}
            <rect
              x={339.4}
              y={1092}
              width={73.2}
              height={22}
              fill="rgba(255,255,255,0.06)"
              stroke="rgba(255,255,255,0.88)"
              strokeWidth={2.4}
            />
          </g>

          {/* Subtle team direction labels in outer apron */}
          <g pointerEvents="none" fontSize={11} fontWeight={700} letterSpacing="0.08em">
            <text
              x={PITCH_CONSTANTS.PADDING_X + 6}
              y={26}
              fill="rgba(255,255,255,0.58)"
            >
              {teamAAttacksTop ? 'TEAM B DEFENDING ↓' : 'TEAM A DEFENDING ↓'}
            </text>
            <text
              x={PITCH_CONSTANTS.PADDING_X + 6}
              y={1114}
              fill="rgba(255,255,255,0.58)"
            >
              {teamAAttacksTop ? 'TEAM A DEFENDING ↑' : 'TEAM B DEFENDING ↑'}
            </text>
          </g>

          {/* Formation slot ghost guides */}
          {ghostSlots.map(({ slot, occupied, svg }) => (
            <g
              key={slot.id}
              data-testid={`formation-slot-${slot.id}`}
              transform={`translate(${svg.x}, ${svg.y})`}
              className={stagedPlacement && !occupied ? 'cursor-pointer' : 'pointer-events-none'}
            >
              <circle
                r={19}
                fill={occupied ? 'rgba(255,255,255,0.04)' : 'rgba(17,19,22,0.42)'}
                stroke={
                  stagedPlacement && !occupied
                    ? '#34D399'
                    : occupied
                      ? 'rgba(255,255,255,0.2)'
                      : 'rgba(255,255,255,0.55)'
                }
                strokeWidth={occupied ? 1.2 : 1.8}
                strokeDasharray={occupied ? '3 3' : '4 3'}
              />
              {!occupied && (
                <text
                  y={0.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="rgba(255,255,255,0.72)"
                  fontSize={10}
                  fontWeight={700}
                >
                  {slot.label}
                </text>
              )}
            </g>
          ))}

          {/* Player markers */}
          {renderedMarkers.map((item) => (
            <PlayerMarker
              key={item.player.id}
              player={item.player}
              svgX={item.svgX}
              svgY={item.svgY}
              isActiveTeam={item.isActiveTeam}
              isSelected={selectedPlayerId === item.player.id}
              isDragging={dragSession?.playerId === item.player.id && dragSession.hasMoved}
              overlapCount={item.overlapCount}
              onPointerDown={handleMarkerPointerDown}
              onKeyDown={handleMarkerKeyDown}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
