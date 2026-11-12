import { GripVertical, Hand, Trash2 } from 'lucide-react';
import { CATEGORY_META, getPositionById } from '@/domain/positions/taxonomy';
import { useTacticalStore } from '@/store/useTacticalStore';

export function UnplacedTray() {
  const project = useTacticalStore((s) => s.project);
  const stagedPlacement = useTacticalStore((s) => s.stagedPlacement);
  const setStagedPlacement = useTacticalStore((s) => s.setStagedPlacement);
  const selectPlayer = useTacticalStore((s) => s.selectPlayer);
  const deletePlayerFromRoster = useTacticalStore((s) => s.deletePlayerFromRoster);

  const activeTeamId = project.activeTeam;
  const activeTeam = project.teams[activeTeamId];
  const activePhaseLayout = activeTeam.tacticalPhases[project.activePhase];
  const placedIds = new Set(activePhaseLayout.playerPlacements.map((p) => p.playerId));

  const unplacedPlayers = activeTeam.roster.filter((p) => !placedIds.has(p.id));

  return (
    <section
      aria-label={`Team ${activeTeamId} unplaced players`}
      data-testid="unplaced-tray"
      className="flex flex-col rounded-lg border border-zinc-800 bg-[#16191e]"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
              activeTeamId === 'A' ? 'bg-zinc-100 text-zinc-900' : 'bg-amber-400 text-zinc-950'
            }`}
          >
            {activeTeamId}
          </span>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Unplaced Tray
          </h3>
        </div>
        <span className="text-[11px] font-medium tabular-nums text-zinc-400">
          {unplacedPlayers.length} / {activeTeam.roster.length}
        </span>
      </div>

      {unplacedPlayers.length === 0 ? (
        <div className="px-3 py-3 text-xs text-zinc-500">
          {activeTeam.roster.length === 0
            ? `No players in Team ${activeTeamId} yet. Click Add Players below.`
            : `All Team ${activeTeamId} roster players are placed in this phase.`}
        </div>
      ) : (
        <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto p-2 sm:max-h-28 sm:p-2.5 lg:max-h-56">
          {unplacedPlayers.map((player) => {
            const pos = getPositionById(player.positionId);
            const cat = CATEGORY_META[pos.category];
            const isStaged = stagedPlacement?.playerId === player.id;

            return (
              <div
                key={player.id}
                data-testid={`unplaced-player-${player.id}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    'application/x-tactical-player',
                    JSON.stringify({ playerId: player.id, teamId: player.teamId }),
                  );
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className={`group flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
                  isStaged
                    ? 'border-emerald-400 bg-emerald-600/25 text-emerald-100'
                    : 'border-zinc-700/80 bg-zinc-800/70 text-zinc-200 hover:border-zinc-500'
                }`}
              >
                <GripVertical className="hidden h-3 w-3 shrink-0 cursor-grab text-zinc-500 sm:block" />
                <button
                  type="button"
                  aria-pressed={isStaged}
                  onClick={() => {
                    if (isStaged) {
                      setStagedPlacement(null);
                    } else {
                      setStagedPlacement({ playerId: player.id, teamId: player.teamId });
                      selectPlayer(player.id);
                    }
                  }}
                  className="flex items-center gap-1.5 text-left focus:outline-none"
                  title="Tap to select, then tap pitch to place (or drag onto pitch)"
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{ backgroundColor: cat.color, color: cat.textColor }}
                  >
                    {pos.abbreviation}
                  </span>
                  <span className="font-medium capitalize text-zinc-300">
                    {player.preferredFoot === 'left' ? 'L' : 'R'}
                  </span>
                  {isStaged && <Hand className="h-3 w-3 text-emerald-300" />}
                </button>
                <button
                  type="button"
                  onClick={() => deletePlayerFromRoster(player.teamId, player.id)}
                  aria-label={`Delete ${pos.abbreviation} from roster`}
                  className="ml-0.5 rounded p-0.5 text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
