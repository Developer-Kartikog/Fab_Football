import type React from 'react';
import type { PlayerInstance } from '@/domain/players/types';
import { CATEGORY_META, getPositionById } from '@/domain/positions/taxonomy';

interface PlayerMarkerProps {
  player: PlayerInstance;
  svgX: number;
  svgY: number;
  isActiveTeam: boolean;
  isSelected: boolean;
  isDragging: boolean;
  overlapCount: number;
  onPointerDown: (e: React.PointerEvent<SVGGElement>, player: PlayerInstance) => void;
  onKeyDown: (e: React.KeyboardEvent<SVGGElement>, player: PlayerInstance) => void;
}

export function PlayerMarker({
  player,
  svgX,
  svgY,
  isActiveTeam,
  isSelected,
  isDragging,
  overlapCount,
  onPointerDown,
  onKeyDown,
}: PlayerMarkerProps) {
  const position = getPositionById(player.positionId);
  const category = CATEGORY_META[position.category];
  const isTeamA = player.teamId === 'A';
  const radius = 21;

  return (
    <g
      data-testid={`player-marker-${player.id}`}
      data-player-id={player.id}
      data-team-id={player.teamId}
      data-position={position.abbreviation}
      transform={`translate(${svgX}, ${svgY})`}
      className={`select-none outline-none [&:focus-visible_.marker-focus-ring]:opacity-100 ${
        isActiveTeam ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      }`}
      style={{
        touchAction: 'none',
        opacity: isActiveTeam ? 1 : 0.82,
      }}
      tabIndex={0}
      role="button"
      aria-label={`Team ${player.teamId} ${position.name} (${player.preferredFoot} foot)`}
      aria-pressed={isSelected}
      onPointerDown={(e) => onPointerDown(e, player)}
      onKeyDown={(e) => onKeyDown(e, player)}
    >
      {/* Invisible expanded touch target (min ~48px equivalent) */}
      <circle r={27} fill="transparent" />

      {/* Keyboard focus ring (visible on :focus-visible) */}
      <circle
        className="marker-focus-ring opacity-0 transition-opacity"
        r={radius + 9}
        fill="none"
        stroke="#34D399"
        strokeWidth={2.2}
        strokeDasharray="4 2"
        pointerEvents="none"
      />

      {/* Selection halo */}
      {isSelected && (
        <circle
          r={radius + 6}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={2.5}
          strokeOpacity={0.95}
        />
      )}

      {/* Subtle ground shadow */}
      <circle
        cy={isDragging ? 4 : 2}
        r={radius}
        fill="rgba(0,0,0,0.42)"
      />

      {/* Team B outer ring treatment (distinct amber-gold dashed ring) */}
      {!isTeamA && (
        <circle
          r={radius + 2.5}
          fill="none"
          stroke="#FACC15"
          strokeWidth={2.5}
          strokeDasharray="6 3"
        />
      )}

      {/* Main category-colored circle */}
      <circle
        r={radius}
        fill={category.color}
        stroke={isTeamA ? '#F8FAFC' : '#181B20'}
        strokeWidth={isTeamA ? 2.6 : 2}
      />

      {/* Position abbreviation */}
      <text
        y={1}
        textAnchor="middle"
        dominantBaseline="central"
        fill={category.textColor}
        fontSize={position.abbreviation.length > 2 ? 11.5 : 13}
        fontWeight={700}
        letterSpacing="0.02em"
        pointerEvents="none"
      >
        {position.abbreviation}
      </text>

      {/* Team A / B micro-identifier badge */}
      <g transform="translate(15, -15)" pointerEvents="none">
        <circle
          r={7.5}
          fill={isTeamA ? '#F8FAFC' : '#FACC15'}
          stroke="#111316"
          strokeWidth={1.5}
        />
        <text
          y={0.5}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#111316"
          fontSize={8.5}
          fontWeight={800}
        >
          {player.teamId}
        </text>
      </g>

      {/* Overlap stack counter if multiple players occupy nearly the same coordinates */}
      {overlapCount > 1 && (
        <g transform="translate(-16, -15)" pointerEvents="none">
          <circle r={7} fill="#181B20" stroke="#94A3B8" strokeWidth={1.2} />
          <text
            y={0.5}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#F8FAFC"
            fontSize={8}
            fontWeight={700}
          >
            {overlapCount}
          </text>
        </g>
      )}
    </g>
  );
}
