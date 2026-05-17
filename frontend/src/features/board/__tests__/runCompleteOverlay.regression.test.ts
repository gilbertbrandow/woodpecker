import { describe, it, expect } from 'vitest'
import type { RunTrainingItemOverview } from '../../../lib/api'

// Models the overlay lifecycle as managed by useBoardPageController.
// The state is intentionally separate from overview.runCompleteOverlay so that
// a background overview refresh (which always returns runCompleteOverlay: null)
// cannot close the overlay before the user dismisses it.

type OverlayData = NonNullable<RunTrainingItemOverview['runCompleteOverlay']>
type OverlayState = OverlayData | null

type Action =
  | { type: 'runCompleted'; data: OverlayData }        // conclude() with runCompletedByThisAttempt
  | { type: 'dismiss' }                                  // dismissRunComplete()
  | { type: 'navigateToNextPuzzle' }                     // clearOverviewState()
  | { type: 'overviewRefreshed' }                        // getOverview() returns, runCompleteOverlay: null

function reduce(state: OverlayState, action: Action): OverlayState {
  switch (action.type) {
    case 'runCompleted':
      return action.data
    case 'dismiss':
    case 'navigateToNextPuzzle':
      return null
    case 'overviewRefreshed':
      // A fresh GET /overview response never carries runCompleteOverlay.
      // Overlay state is independent of overview state — this action is a no-op.
      return state
  }
}

const OVERLAY_DATA: OverlayData = {
  completedByAttemptId: 42,
  runId: 1,
  runIndex: 0,
  breakDuration: null,
  isTrainingComplete: false,
  summary: {
    totalItems: 20,
    solvedCount: 18,
    solvedWithRetriesCount: 1,
    failedCount: 1,
    accuracyPct: 90,
    averageSolveTimeMs: 12000,
  },
}

describe('RunCompleteOverlay — lifecycle regression', () => {
  it('shows overlay after run completes', () => {
    let state: OverlayState = null
    state = reduce(state, { type: 'runCompleted', data: OVERLAY_DATA })
    expect(state).not.toBeNull()
  })

  it('regression: overview background refresh does not close the overlay', () => {
    // Bug: overlay data was derived from overview.runCompleteOverlay, which is
    // always null in GET /overview responses. The background refresh on route
    // load would silently close the overlay immediately after it appeared.
    let state: OverlayState = null
    state = reduce(state, { type: 'runCompleted', data: OVERLAY_DATA })
    expect(state).not.toBeNull()

    // Simulate the automatic GET /overview fetch that fires on route navigation
    state = reduce(state, { type: 'overviewRefreshed' })
    expect(state).not.toBeNull()
    expect(state).toEqual(OVERLAY_DATA)
  })

  it('closes overlay when user explicitly dismisses', () => {
    let state: OverlayState = null
    state = reduce(state, { type: 'runCompleted', data: OVERLAY_DATA })
    state = reduce(state, { type: 'dismiss' })
    expect(state).toBeNull()
  })

  it('closes overlay when user navigates to next puzzle without dismissing', () => {
    // Without this, the overlay would reappear on the next puzzle's overview.
    let state: OverlayState = null
    state = reduce(state, { type: 'runCompleted', data: OVERLAY_DATA })
    state = reduce(state, { type: 'navigateToNextPuzzle' })
    expect(state).toBeNull()
  })

  it('overlay does not reappear after dismiss + another overview refresh', () => {
    let state: OverlayState = null
    state = reduce(state, { type: 'runCompleted', data: OVERLAY_DATA })
    state = reduce(state, { type: 'dismiss' })
    state = reduce(state, { type: 'overviewRefreshed' })
    expect(state).toBeNull()
  })
})
