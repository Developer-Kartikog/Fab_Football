import { Copy, MapPinOff, Trash2, X } from 'lucide-react';
import type { PreferredFoot } from '@/domain/players/types';
import { CATEGORY_META, POSITIONS, getPositionById } from '@/domain/positions/taxonomy';
import type { PositionId } from '@/domain/positions/types';
import { TACTICAL_PHASES } from '@/domain/tactical-phases/constants';
import { useTacticalStore } from '@/store/useTacticalStore';

export function PlayerInspector() {
  const project = useTacticalStore((s) => s.project);
  const selectedPlayerId = useTacticalStore((s) => s.selectedPlayerId);
  const selectPlayer = useTacticalStore((s) => s.selectPlayer);
  const setActiveTeam = useTacticalStore((s) => s.setActiveTeam);
  const setViewMode = useTacticalStore((s) => s.setViewMode);
  const updatePlayerProfile = useTacticalStore((s) => s.updatePlayerProfile);
  const duplicatePlayer = useTacticalStore((s) => s.duplicatePlayer);
  const unplacePlayerFromCurrentPhase = useTacticalStore(
    (s) => s.unplacePlayerFromCurrentPhase,
  );
  const deletePlayerFromRoster = useTacticalStore((s) => s.deletePlayerFromRoster);

  if (!selectedPlayerId) {
    return (
      <div className="hidden rounded-lg border border-zinc-800/80 bg-[#16191e]/70 p-3.5 text-xs text-zinc-500 lg:block">
        Select any player marker on the pitch to inspect or edit their position, preferred foot, or phase placement.
      </div>
    );
  }

  const foundTeamA = project.teams.A.roster.find((p) => p.id === selectedPlayerId);
  const foundTeamB = project.teams.B.roster.find((p) => p.id === selectedPlayerId);
  const player = foundTeamA ?? foundTeamB;

  if (!player) return null;

  const position = getPositionById(player.positionId);
  const category = CATEGORY_META[position.category];
  const phaseMeta = TACTICAL_PHASES.find((p) => p.id === project.activePhase);
  const placement = project.teams[player.teamId].tacticalPhases[
    project.activePhase
  ].playerPlacements.find((p) => p.playerId === player.id);

  const isEditable = player.teamId === project.activeTeam;

  const handleSwitchToPlayersTeam = () => {
    if (project.activeViewMode !== 'both' && project.activeViewMode !== player.teamId) {
      setViewMode(player.teamId);
    }
    setActiveTeam(player.teamId);
  };

  return (
    <aside
      data-testid="player-inspector"
      aria-label="Selected player inspector"
      className="rounded-lg border border-zinc-700/80 bg-[#181b20] p-3.5 shadow-xl"
    >
      <div className="flex items-start justify-between gap-2 border-b border-zinc-800 pb-2.5">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow"
            style={{ backgroundColor: category.color, color: category.textColor }}
          >
            {position.abbreviation}
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-zinc-100">{position.name}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  player.teamId === 'A'
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'bg-amber-400 text-zinc-950'
                }`}
              >
                Team {player.teamId}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
              <span style={{ color: category.color }} className="font-semibold">
                {category.label} ({category.fullName})
              </span>
              <span>·</span>
              <span className="capitalize">{position.sideDesignation}</span>
              <span>·</span>
              <span>{phaseMeta?.label}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          data-testid="inspector-deselect-btn"
          onClick={() => selectPlayer(null)}
          aria-label="Deselect player"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Coordinates readout */}
      <div className="mt-2.5 flex items-center justify-between rounded bg-[#111316] px-2.5 py-1.5 text-[11px] text-zinc-300">
        <span className="text-zinc-400">Phase Placement</span>
        {placement ? (
          <span className="font-mono tabular-nums text-emerald-300">
            X: {placement.x.toFixed(2)} · Y: {placement.y.toFixed(2)}
          </span>
        ) : (
          <span className="text-zinc-500">Unplaced in this phase</span>
        )}
      </div>

      {!isEditable ? (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
          <p>
            You are currently editing Team {project.activeTeam}. Switch to Team{' '}
            {player.teamId} to modify this player.
          </p>
          <button
            type="button"
            onClick={handleSwitchToPlayersTeam}
            className="mt-2 w-full rounded bg-amber-400 px-2.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-300"
          >
            Edit Team {player.teamId}
          </button>
        </div>
      ) : (
        <>
          {/* Position editor */}
          <div className="mt-3 space-y-2.5">
            <div>
              <label
                htmlFor="inspector-position-select"
                className="block text-[11px] font-medium text-zinc-400"
              >
                Position
              </label>
              <select
                id="inspector-position-select"
                data-testid="inspector-position-select"
                value={player.positionId}
                onChange={(e) =>
                  updatePlayerProfile(player.teamId, player.id, {
                    positionId: e.target.value as PositionId,
                  })
                }
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
              >
                {POSITIONS.map((pos) => (
                  <option key={pos.id} value={pos.id}>
                    {pos.abbreviation} — {pos.name} ({pos.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Preferred foot editor */}
            <div>
              <span className="block text-[11px] font-medium text-zinc-400">
                Preferred Foot
              </span>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {(['left', 'right'] as PreferredFoot[]).map((foot) => (
                  <button
                    key={foot}
                    type="button"
                    aria-pressed={player.preferredFoot === foot}
                    data-testid={`inspector-foot-${foot}`}
                    onClick={() =>
                      updatePlayerProfile(player.teamId, player.id, { preferredFoot: foot })
                    }
                    className={`rounded-md border py-1.5 text-xs font-medium capitalize transition-colors ${
                      player.preferredFoot === foot
                        ? 'border-emerald-500 bg-emerald-600/20 text-emerald-100'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {foot}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-3.5 grid grid-cols-2 gap-1.5 border-t border-zinc-800 pt-3">
            <button
              type="button"
              data-testid="inspector-duplicate-btn"
              onClick={() => duplicatePlayer(player.teamId, player.id)}
              className="flex items-center justify-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Duplicate</span>
            </button>

            {placement && (
              <button
                type="button"
                data-testid="inspector-unplace-btn"
                onClick={() => unplacePlayerFromCurrentPhase(player.teamId, player.id)}
                className="flex items-center justify-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
              >
                <MapPinOff className="h-3.5 w-3.5" />
                <span>Unplace</span>
              </button>
            )}

            <button
              type="button"
              data-testid="inspector-delete-btn"
              onClick={() => deletePlayerFromRoster(player.teamId, player.id)}
              className={`flex items-center justify-center gap-1 rounded-md border border-red-500/30 bg-red-500/15 px-2 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/25 ${
                placement ? 'col-span-2' : 'col-span-1'
              }`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Player</span>
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
