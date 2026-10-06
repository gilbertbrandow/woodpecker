import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePgnNavigation } from '../usePgnNavigation'
import { resolveDisplayBoard } from '../boardPage.helpers'
import type { BoardState } from '../boardPage.helpers'
import type { RunTrainingItemAttemptView, RunTrainingItemOverview } from '../../../lib/api'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

type Session = Parameters<typeof usePgnNavigation>[0]['session']

const EMPTY_SESSION: Session = {
  allPliesPlayed: [],
  movesPlayed: [],
  failedRetryPlies: [],
  failedModeWrongMoves: [],
  liveFocusStatus: 'in_progress',
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

function makeSolvingView(prelude: string[], fen: string = START_FEN): RunTrainingItemAttemptView {
  return {
    trainingItem: { fen, solution: [], prelude },
  } as unknown as RunTrainingItemAttemptView
}

// Puzzle starts after the game prelude 1.e4 e5; the opponent (white) opens with Nf3.
const AFTER_E4_E5_FEN = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
const PRELUDE = ['e2e4', 'e7e5']

function focusSession(allPliesPlayed: string[]): Session {
  return { ...EMPTY_SESSION, allPliesPlayed }
}

function renderFocusNavigation(initialPlies: string[]) {
  const solvingView = makeSolvingView(PRELUDE, AFTER_E4_E5_FEN)
  return renderHook(
    ({ plies }: { plies: string[] }) =>
      usePgnNavigation({ mode: 'focus', solvingView, session: focusSession(plies), overview: null, boardKey: 1 }),
    { initialProps: { plies: initialPlies } },
  )
}

const LIVE_BOARD = { fen: 'live-board-fen', dests: new Map([['b8', ['c6']]]) } as unknown as BoardState

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

describe('usePgnNavigation — browsing the game before solving (#406)', () => {
  it('follows the live board after a move made from the head reached by browsing', () => {
    const { result, rerender } = renderFocusNavigation(['g1f3'])

    // Browse the whole game from the start, then step forward to the latest move.
    act(() => result.current.setSelectedPly({ line: 'main', index: 0 }))
    act(() => result.current.setSelectedPly({ line: 'main', index: 1 }))
    act(() => result.current.setSelectedPly({ line: 'main', index: 2 }))
    expect(result.current.isAtHead).toBe(true)

    // The user plays Nc6 and the opponent answers Bb5.
    rerender({ plies: ['g1f3', 'b8c6', 'f1b5'] })

    expect(result.current.isAtHead).toBe(true)
    const shown = resolveDisplayBoard(LIVE_BOARD, 'focus', result.current.selectedPly, result.current.pgnDisplay, null, null)
    expect(shown).toBe(LIVE_BOARD)
  })

  it('follows the live board in failed mode after the correct retry is played from the head', () => {
    const solvingView = makeSolvingView(PRELUDE, AFTER_E4_E5_FEN)
    // 1...d6 was wrong: it stays in the mainline but the live board is back at Nf3.
    const failedSession = (failedRetryPlies: string[]): Session => ({
      ...EMPTY_SESSION,
      allPliesPlayed: ['g1f3'],
      movesPlayed: ['d7d6'],
      failedRetryPlies,
      liveFocusStatus: 'failed',
    })
    const { result, rerender } = renderHook(
      ({ retry }: { retry: string[] }) =>
        usePgnNavigation({ mode: 'failed', solvingView, session: failedSession(retry), overview: null, boardKey: 1 }),
      { initialProps: { retry: [] as string[] } },
    )

    // Inspect the wrong move, then step back to the live position (Nf3).
    act(() => result.current.setSelectedPly({ line: 'main', index: 3 }))
    act(() => result.current.setSelectedPly({ line: 'main', index: 2 }))
    expect(result.current.isAtHead).toBe(true)

    // The user finds Nc6 and the opponent answers Bb5.
    rerender({ retry: ['b8c6', 'f1b5'] })

    expect(result.current.isAtHead).toBe(true)
    const shown = resolveDisplayBoard(LIVE_BOARD, 'failed', result.current.selectedPly, result.current.pgnDisplay, null, null)
    expect(shown).toBe(LIVE_BOARD)
  })

  it('keeps an earlier browsed position when the opponent reply arrives', () => {
    const { result, rerender } = renderFocusNavigation(['g1f3', 'b8c6'])

    // User reviews the prelude while waiting for the opponent's reply.
    act(() => result.current.setSelectedPly({ line: 'main', index: 1 }))
    rerender({ plies: ['g1f3', 'b8c6', 'f1b5'] })

    expect(result.current.selectedPly).toEqual({ line: 'main', index: 1 })
    expect(result.current.isAtHead).toBe(false)
  })
})
