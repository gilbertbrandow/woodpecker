import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePgnNavigation } from '../usePgnNavigation'
import type { RunTrainingItemAttemptView, RunTrainingItemOverview } from '../../../lib/api'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const EMPTY_SESSION = {
  allPliesPlayed: [],
  movesPlayed: [],
  failedRetryPlies: [],
  failedModeWrongMoves: [],
  liveFocusStatus: 'in_progress' as const,
}

function makeOverview(prelude: string[]): RunTrainingItemOverview {
  return {
    trainingItem: { fen: START_FEN, solution: [], prelude },
    pgn: {
      mainline: [{ san: 'e5', uci: 'e7e5', moveNumber: 1, isWhite: false, moveStatus: 'opponent' }],
      subvariations: null,
    },
  } as unknown as RunTrainingItemOverview
}

function makeSolvingView(prelude: string[]): RunTrainingItemAttemptView {
  return {
    trainingItem: { fen: START_FEN, solution: [], prelude },
  } as unknown as RunTrainingItemAttemptView
}

describe('usePgnNavigation', () => {
  it('uses the overview prelude, not a stale solvingView from another puzzle', () => {
    // Left over from a later puzzle the user played before navigating back.
    const solvingView = makeSolvingView(['d2d4', 'd7d5', 'c2c4'])
    const overview = makeOverview(['e2e4'])
    const { result } = renderHook(() =>
      usePgnNavigation({ mode: 'overview', solvingView, session: EMPTY_SESSION, overview, boardKey: 0 }),
    )

    const sans = result.current.pgnDisplay?.mainline.map(m => m.san)
    expect(sans).toEqual(['e4', 'e5'])
  })
})
