import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '@/app/App';
import { createDefaultProject } from '@/domain/projects/types';
import { useTacticalStore } from '@/store/useTacticalStore';

function resetStore() {
  useTacticalStore.setState({
    initialized: true,
    project: createDefaultProject('UI Test Project'),
    past: [],
    future: [],
    selectedPlayerId: null,
    stagedPlacement: null,
    selectedFormationId: '4-3-3',
    saveStatus: 'saved',
    saveError: null,
    savedProjects: [],
    toast: null,
  });
}

describe('Football Tactical Board UI interactions', () => {
  beforeEach(() => {
    resetStore();
  });

  it('opens directly to the tactical pitch and supports Add Players filtering, multi-add, tap-to-place, inspector edit, and undo/redo', async () => {
    render(<App />);

    // Pitch is immediately visible
    expect(screen.getByTestId('tactical-pitch-svg')).toBeInTheDocument();

    // Open Add Players full-screen library
    fireEvent.click(screen.getByTestId('add-players-btn'));
    expect(screen.getByTestId('player-library-modal')).toBeInTheDocument();

    // Filter by ATT category and search for Striker
    fireEvent.click(screen.getByTestId('library-cat-ATT'));
    expect(screen.queryByTestId('library-card-GK')).not.toBeInTheDocument();
    expect(screen.getByTestId('library-card-ST')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('library-search-input'), {
      target: { value: 'Striker' },
    });
    expect(screen.getByTestId('library-card-ST')).toBeInTheDocument();
    expect(screen.queryByTestId('library-card-LW')).not.toBeInTheDocument();

    // Queue two ST variants (Left and Right)
    fireEvent.click(screen.getByTestId('select-profile-ST-left'));
    fireEvent.click(screen.getByTestId('select-profile-ST-right'));
    fireEvent.click(screen.getByTestId('confirm-add-players-btn'));

    // Modal closes and 2 players appear in Unplaced Tray
    await waitFor(() => {
      expect(screen.queryByTestId('player-library-modal')).not.toBeInTheDocument();
    });
    const stateAfterAdd = useTacticalStore.getState();
    expect(stateAfterAdd.project.teams.A.roster).toHaveLength(2);
    const firstPlayer = stateAfterAdd.project.teams.A.roster[0];

    // Tap player in tray to stage, then tap pitch to place
    const trayItem = screen.getByTestId(`unplaced-player-${firstPlayer.id}`);
    const tapButton = trayItem.querySelector('button')!;
    fireEvent.click(tapButton);

    const pitch = screen.getByTestId('tactical-pitch-svg');
    // Mock bounding rect for jsdom
    pitch.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 752,
        height: 1134,
        right: 752,
        bottom: 1134,
        x: 0,
        y: 0,
        toJSON: () => {},
      }) as DOMRect;

    fireEvent.pointerDown(pitch, { clientX: 376, clientY: 300, button: 0, pointerId: 1 });
    fireEvent.pointerUp(pitch, { clientX: 376, clientY: 300, button: 0, pointerId: 1 });

    // Marker now rendered on pitch and inspector is open
    const marker = screen.getByTestId(`player-marker-${firstPlayer.id}`);
    expect(marker).toBeInTheDocument();
    expect(screen.getByTestId('player-inspector')).toBeInTheDocument();

    // Change preferred foot in inspector
    fireEvent.click(screen.getByTestId('inspector-foot-right'));
    expect(useTacticalStore.getState().project.teams.A.roster[0].preferredFoot).toBe('right');

    // Undo restores left foot
    fireEvent.click(screen.getByTestId('undo-btn'));
    expect(useTacticalStore.getState().project.teams.A.roster[0].preferredFoot).toBe('left');
  });

  it('closes Copy Phase menu and Player Library modal on Escape key', () => {
    render(<App />);

    fireEvent.click(screen.getByTestId('copy-phase-btn'));
    expect(screen.getByTestId('copy-phase-target-attackingOrg')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('copy-phase-target-attackingOrg')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('add-players-btn'));
    expect(screen.getByTestId('player-library-modal')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('player-library-modal')).not.toBeInTheDocument();
  });
});
