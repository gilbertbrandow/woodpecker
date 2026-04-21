import { describe, it, expect } from 'vitest'
import type { SessionAttemptHistoryItem, SessionAttemptStatus } from '../../../context/solveSession'

type SolveSessionState = { attemptHistory: SessionAttemptHistoryItem[] }

type RegisterAttemptStartInput = {
  attemptId: number
  runPuzzleId: number
  puzzlePosition: number
}

type SolveSessionAction =
  | { type: 'registerAttemptStart'; payload: RegisterAttemptStartInput }
  | { type: 'markAttemptResolved'; payload: { attemptId: number; status: 'solved' | 'failed' } }
  | { type: 'clearSession' }

function solveSessionReducer(state: SolveSessionState, action: SolveSessionAction): SolveSessionState {
  switch (action.type) {
    case 'registerAttemptStart': {
      const existingIndex = state.attemptHistory.findIndex((item) => item.attemptId === action.payload.attemptId)
      if (existingIndex !== -1) return state
      return {
        attemptHistory: [
          ...state.attemptHistory,
          {
            attemptId: action.payload.attemptId,
            runPuzzleId: action.payload.runPuzzleId,
            puzzlePosition: action.payload.puzzlePosition,
            status: 'ongoing' as SessionAttemptStatus,
            startedAt: Date.now(),
          },
        ],
      }
    }
    case 'markAttemptResolved': {
      const hasAttempt = state.attemptHistory.some((item) => item.attemptId === action.payload.attemptId)
      if (!hasAttempt) return state
      return {
        attemptHistory: state.attemptHistory.map((item) => {
          if (item.attemptId !== action.payload.attemptId) return item
          if (item.status === action.payload.status && item.finishedAt !== undefined) return item
          return { ...item, status: action.payload.status, finishedAt: item.finishedAt ?? Date.now() }
        }),
      }
    }
    case 'clearSession': {
      return { attemptHistory: [] }
    }
  }
}

describe('solveSession reducer — no duplicate attempt dots', () => {
  it('does not add a duplicate dot when registerAttemptStart is called twice with the same attemptId', () => {
    let state: SolveSessionState = { attemptHistory: [] }

    state = solveSessionReducer(state, {
      type: 'registerAttemptStart',
      payload: { attemptId: 1, runPuzzleId: 10, puzzlePosition: 1 },
    })
    state = solveSessionReducer(state, {
      type: 'registerAttemptStart',
      payload: { attemptId: 1, runPuzzleId: 10, puzzlePosition: 1 },
    })

    expect(state.attemptHistory).toHaveLength(1)
    expect(state.attemptHistory[0].status).toBe('ongoing')
  })

  it('focus → failed → retake: each attempt gets exactly one dot', () => {
    let state: SolveSessionState = { attemptHistory: [] }

    state = solveSessionReducer(state, {
      type: 'registerAttemptStart',
      payload: { attemptId: 1, runPuzzleId: 10, puzzlePosition: 1 },
    })
    state = solveSessionReducer(state, {
      type: 'markAttemptResolved',
      payload: { attemptId: 1, status: 'failed' },
    })

    state = solveSessionReducer(state, {
      type: 'registerAttemptStart',
      payload: { attemptId: 2, runPuzzleId: 10, puzzlePosition: 1 },
    })
    state = solveSessionReducer(state, {
      type: 'markAttemptResolved',
      payload: { attemptId: 2, status: 'solved' },
    })

    expect(state.attemptHistory).toHaveLength(2)
    expect(state.attemptHistory[0]).toMatchObject({ attemptId: 1, status: 'failed' })
    expect(state.attemptHistory[1]).toMatchObject({ attemptId: 2, status: 'solved' })
  })

  it('focus → overview → next puzzle: two distinct attempt dots, no duplicates', () => {
    let state: SolveSessionState = { attemptHistory: [] }

    state = solveSessionReducer(state, {
      type: 'registerAttemptStart',
      payload: { attemptId: 1, runPuzzleId: 10, puzzlePosition: 1 },
    })
    state = solveSessionReducer(state, {
      type: 'markAttemptResolved',
      payload: { attemptId: 1, status: 'solved' },
    })

    state = solveSessionReducer(state, {
      type: 'registerAttemptStart',
      payload: { attemptId: 2, runPuzzleId: 11, puzzlePosition: 2 },
    })

    expect(state.attemptHistory).toHaveLength(2)
    expect(state.attemptHistory.filter((i) => i.attemptId === 1)).toHaveLength(1)
    expect(state.attemptHistory.filter((i) => i.attemptId === 2)).toHaveLength(1)
    expect(state.attemptHistory[1].status).toBe('ongoing')
  })

  it('markAttemptResolved is idempotent — resolving the same attempt twice does not change finishedAt', () => {
    let state: SolveSessionState = { attemptHistory: [] }

    state = solveSessionReducer(state, {
      type: 'registerAttemptStart',
      payload: { attemptId: 5, runPuzzleId: 20, puzzlePosition: 3 },
    })
    state = solveSessionReducer(state, {
      type: 'markAttemptResolved',
      payload: { attemptId: 5, status: 'solved' },
    })
    const firstFinishedAt = state.attemptHistory[0].finishedAt

    state = solveSessionReducer(state, {
      type: 'markAttemptResolved',
      payload: { attemptId: 5, status: 'solved' },
    })

    expect(state.attemptHistory[0].finishedAt).toBe(firstFinishedAt)
    expect(state.attemptHistory).toHaveLength(1)
  })
})
