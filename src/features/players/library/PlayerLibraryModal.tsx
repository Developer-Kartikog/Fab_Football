import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import type { PreferredFoot } from '@/domain/players/types';
import { CATEGORY_META, CATEGORY_ORDER, POSITIONS } from '@/domain/positions/taxonomy';
import type { PositionCategory, PositionId } from '@/domain/positions/types';
import { useTacticalStore } from '@/store/useTacticalStore';

interface PlayerLibraryModalProps {
  open: boolean;
  onClose: () => void;
}

interface QueuedProfile {
  key: string;
  positionId: PositionId;
  preferredFoot: PreferredFoot;
  count: number;
}

export function PlayerLibraryModal({ open, onClose }: PlayerLibraryModalProps) {
  const activeTeam = useTacticalStore((s) => s.project.activeTeam);
  const addPlayersToActiveTeam = useTacticalStore((s) => s.addPlayersToActiveTeam);

  const [categoryFilter, setCategoryFilter] = useState<'ALL' | PositionCategory>('ALL');
  const [positionFilter, setPositionFilter] = useState<'ALL' | PositionId>('ALL');
  const [footFilter, setFootFilter] = useState<'ALL' | PreferredFoot>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [queued, setQueued] = useState<QueuedProfile[]>([]);

  useEffect(() => {
    setQueued([]);
  }, [activeTeam]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const categoryPositions = useMemo(() => {
    if (categoryFilter === 'ALL') return POSITIONS;
    return POSITIONS.filter((p) => p.category === categoryFilter);
  }, [categoryFilter]);

  const filteredPositions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return categoryPositions.filter((pos) => {
      if (positionFilter !== 'ALL' && pos.id !== positionFilter) return false;
      if (!q) return true;
      return (
        pos.abbreviation.toLowerCase().includes(q) ||
        pos.name.toLowerCase().includes(q) ||
        pos.category.toLowerCase().includes(q) ||
        pos.sideDesignation.toLowerCase().includes(q)
      );
    });
  }, [categoryPositions, positionFilter, searchQuery]);

  const visibleFeet: PreferredFoot[] = useMemo(() => {
    if (footFilter === 'ALL') return ['left', 'right'];
    return [footFilter];
  }, [footFilter]);

  const totalQueued = queued.reduce((sum, item) => sum + item.count, 0);

  if (!open) return null;

  const clearFilters = () => {
    setCategoryFilter('ALL');
    setPositionFilter('ALL');
    setFootFilter('ALL');
    setSearchQuery('');
  };

  const handleCategoryChange = (cat: 'ALL' | PositionCategory) => {
    setCategoryFilter(cat);
    setPositionFilter('ALL');
  };

  const addToQueue = (positionId: PositionId, preferredFoot: PreferredFoot) => {
    const key = `${positionId}:${preferredFoot}`;
    setQueued((prev) => {
      const idx = prev.findIndex((item) => item.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], count: next[idx].count + 1 };
        return next;
      }
      return [...prev, { key, positionId, preferredFoot, count: 1 }];
    });
  };

  const updateQueueCount = (key: string, delta: number) => {
    setQueued((prev) =>
      prev
        .map((item) => (item.key === key ? { ...item, count: item.count + delta } : item))
        .filter((item) => item.count > 0),
    );
  };

  const handleConfirmAdd = () => {
    if (queued.length === 0) return;
    const profiles: Array<{ positionId: PositionId; preferredFoot: PreferredFoot }> = [];
    for (const item of queued) {
      for (let i = 0; i < item.count; i += 1) {
        profiles.push({ positionId: item.positionId, preferredFoot: item.preferredFoot });
      }
    }
    addPlayersToActiveTeam(profiles);
    setQueued([]);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add Players Library"
      data-testid="player-library-modal"
      className="fixed inset-0 z-50 flex flex-col bg-[#111316]"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-[#16191e] px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 sm:text-lg">
            Generic Player Library — Adding to{' '}
            <span className={activeTeam === 'A' ? 'text-zinc-100' : 'text-amber-300'}>
              Team {activeTeam}
            </span>
          </h2>
          <p className="text-xs text-zinc-400">
            Select one or multiple tactical profiles (Left or Right foot) to add to Team{' '}
            {activeTeam}&apos;s unplaced roster.
          </p>
        </div>
        <button
          type="button"
          data-testid="close-player-library-btn"
          onClick={onClose}
          aria-label="Close player library"
          className="rounded-md border border-zinc-700 bg-zinc-800 p-2 text-zinc-300 hover:bg-zinc-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Filters Bar */}
      <div className="border-b border-zinc-800 bg-[#14171b] px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Category Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                aria-pressed={categoryFilter === 'ALL'}
                data-testid="library-cat-ALL"
                onClick={() => handleCategoryChange('ALL')}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  categoryFilter === 'ALL'
                    ? 'border-zinc-500 bg-zinc-700 text-white'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All Categories
              </button>
              {CATEGORY_ORDER.map((catId) => {
                const meta = CATEGORY_META[catId];
                const active = categoryFilter === catId;
                return (
                  <button
                    key={catId}
                    type="button"
                    aria-pressed={active}
                    data-testid={`library-cat-${catId}`}
                    onClick={() => handleCategoryChange(catId)}
                    className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-zinc-400 bg-zinc-800 text-white'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Search + Foot Filter + Clear */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  data-testid="library-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ST, Midfielder..."
                  className="w-48 rounded-md border border-zinc-700 bg-zinc-900 py-1.5 pr-3 pl-8 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none sm:w-56"
                />
              </div>

              <div
                role="group"
                aria-label="Preferred foot filter"
                className="flex items-center rounded-md border border-zinc-700 bg-zinc-900 p-0.5"
              >
                {(
                  [
                    { id: 'ALL', label: 'All Feet' },
                    { id: 'left', label: 'Left' },
                    { id: 'right', label: 'Right' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`library-foot-${opt.id}`}
                    onClick={() => setFootFilter(opt.id)}
                    className={`rounded px-2.5 py-1 text-xs font-medium ${
                      footFilter === opt.id
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {(categoryFilter !== 'ALL' ||
                positionFilter !== 'ALL' ||
                footFilter !== 'ALL' ||
                searchQuery.trim() !== '') && (
                <button
                  type="button"
                  data-testid="library-clear-filters"
                  onClick={clearFilters}
                  className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Position Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPositionFilter('ALL')}
              className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                positionFilter === 'ALL'
                  ? 'bg-emerald-600/30 text-emerald-200'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All Positions
            </button>
            {categoryPositions.map((pos) => (
              <button
                key={pos.id}
                type="button"
                data-testid={`library-pos-filter-${pos.id}`}
                onClick={() => setPositionFilter(pos.id === positionFilter ? 'ALL' : pos.id)}
                className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                  positionFilter === pos.id
                    ? 'bg-emerald-600/30 text-emerald-200 ring-1 ring-emerald-500/60'
                    : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {pos.abbreviation}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid of Generic Position Profiles */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-6xl">
          {filteredPositions.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-[#16191e] p-8 text-center">
              <p className="text-sm text-zinc-400">
                No positions match your active filters.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredPositions.map((pos) => {
                const cat = CATEGORY_META[pos.category];
                return (
                  <div
                    key={pos.id}
                    data-testid={`library-card-${pos.id}`}
                    className="flex flex-col justify-between rounded-lg border border-zinc-800 bg-[#16191e] p-3.5 transition-colors hover:border-zinc-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow"
                          style={{ backgroundColor: cat.color, color: cat.textColor }}
                        >
                          {pos.abbreviation}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-zinc-100">{pos.name}</div>
                          <div className="text-[11px] text-zinc-400">
                            {cat.fullName} · {pos.sideDesignation}
                          </div>
                        </div>
                      </div>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ backgroundColor: cat.badgeBg, color: cat.color }}
                      >
                        {cat.label}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {visibleFeet.map((foot) => {
                        const key = `${pos.id}:${foot}`;
                        const existingCount =
                          queued.find((q) => q.key === key)?.count ?? 0;
                        return (
                          <button
                            key={foot}
                            type="button"
                            data-testid={`select-profile-${pos.id}-${foot}`}
                            onClick={() => addToQueue(pos.id, foot)}
                            className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                              existingCount > 0
                                ? 'border-emerald-500/60 bg-emerald-600/20 text-emerald-100'
                                : 'border-zinc-700 bg-zinc-800/70 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800'
                            } ${visibleFeet.length === 1 ? 'col-span-2' : ''}`}
                          >
                            <span className="flex items-center gap-1 capitalize">
                              <Plus className="h-3 w-3" />
                              {foot} Foot
                            </span>
                            {existingCount > 0 && (
                              <span className="rounded bg-emerald-500 px-1.5 py-0.2 text-[10px] font-bold text-zinc-950">
                                {existingCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Selection Queue & Confirm Bar */}
      <div className="border-t border-zinc-800 bg-[#16191e] px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {queued.length === 0 ? (
              <span className="text-xs text-zinc-400">
                Tap Left Foot or Right Foot on any position card above to queue generic players.
              </span>
            ) : (
              queued.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/90 px-2 py-1 text-xs text-zinc-100"
                >
                  <span className="font-semibold">{item.positionId}</span>
                  <span className="text-zinc-400 capitalize">· {item.preferredFoot}</span>
                  <span className="rounded bg-zinc-700 px-1.5 text-[11px] font-bold">
                    ×{item.count}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove one ${item.positionId} ${item.preferredFoot}`}
                    onClick={() => updateQueueCount(item.key, -1)}
                    className="ml-0.5 text-zinc-400 hover:text-red-300"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {queued.length > 0 && (
              <button
                type="button"
                onClick={() => setQueued([])}
                className="rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                Clear Queue
              </button>
            )}
            <button
              type="button"
              data-testid="confirm-add-players-btn"
              disabled={totalQueued === 0}
              onClick={handleConfirmAdd}
              className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
            >
              Add {totalQueued > 0 ? `${totalQueued} ` : ''}to Team {activeTeam}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
