import * as React from 'react'

const STORAGE_KEY = 'woodpecker.solve-session.attempt-history'
const PRESERVE_ON_UNMOUNT_KEY = 'woodpecker.solve-session.preserve-unmount'

export type SessionAttemptStatus = 'ongoing' | 'solved' | 'failed'

export type SessionAttemptHistoryItem = {
  attemptId: number
  runPuzzleId: number
  puzzlePosition: number
  status: SessionAttemptStatus
  startedAt: number
  finishedAt?: number
}

type SolveSessionState = {
  attemptHistory: SessionAttemptHistoryItem[]
}

type RegisterAttemptStartInput = {
  attemptId: number
  runPuzzleId: number
  puzzlePosition: number
}

type SolveSessionAction =
  | { type: 'registerAttemptStart'; payload: RegisterAttemptStartInput }
  | { type: 'markAttemptResolved'; payload: { attemptId: number; status: 'solved' | 'failed' } }
  | { type: 'clearSession' }

type SolveSessionContextValue = {
  attemptHistory: SessionAttemptHistoryItem[]
  registerAttemptStart: (item: RegisterAttemptStartInput) => void
  markAttemptResolved: (attemptId: number, status: 'solved' | 'failed') => void
  clearSession: () => void
}

const SolveSessionContext = React.createContext<SolveSessionContextValue | null>(null)

function isSessionAttemptStatus(value: unknown): value is SessionAttemptStatus {
  return value === 'ongoing' || value === 'solved' || value === 'failed'
}

function isSessionAttemptHistoryItem(value: unknown): value is SessionAttemptHistoryItem {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Record<string, unknown>
  if (typeof candidate.attemptId !== 'number') return false
  if (typeof candidate.runPuzzleId !== 'number') return false
  if (typeof candidate.puzzlePosition !== 'number') return false
  if (!isSessionAttemptStatus(candidate.status)) return false
  if (typeof candidate.startedAt !== 'number') return false
  if (candidate.finishedAt !== undefined && typeof candidate.finishedAt !== 'number') return false

  return true
}

function loadInitialState(): SolveSessionState {
  if (typeof window === 'undefined') {
    return { attemptHistory: [] }
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return { attemptHistory: [] }
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return { attemptHistory: [] }
    }

    const attemptHistory = parsed.filter(isSessionAttemptHistoryItem)
    return { attemptHistory }
  } catch {
    return { attemptHistory: [] }
  }
}

function solveSessionReducer(state: SolveSessionState, action: SolveSessionAction): SolveSessionState {
  switch (action.type) {
    case 'registerAttemptStart': {
      const existingIndex = state.attemptHistory.findIndex((item) => item.attemptId === action.payload.attemptId)
      if (existingIndex !== -1) {
        return state
      }

      return {
        attemptHistory: [
          ...state.attemptHistory,
          {
            attemptId: action.payload.attemptId,
            runPuzzleId: action.payload.runPuzzleId,
            puzzlePosition: action.payload.puzzlePosition,
            status: 'ongoing',
            startedAt: Date.now(),
          },
        ],
      }
    }

    case 'markAttemptResolved': {
      const hasAttempt = state.attemptHistory.some((item) => item.attemptId === action.payload.attemptId)
      if (!hasAttempt) {
        return state
      }

      return {
        attemptHistory: state.attemptHistory.map((item) => {
          if (item.attemptId !== action.payload.attemptId) {
            return item
          }

          if (item.status === action.payload.status && item.finishedAt !== undefined) {
            return item
          }

          return {
            ...item,
            status: action.payload.status,
            finishedAt: item.finishedAt ?? Date.now(),
          }
        }),
      }
    }

    case 'clearSession': {
      return { attemptHistory: [] }
    }
  }
}

export function SolveSessionProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [state, dispatch] = React.useReducer(solveSessionReducer, undefined, loadInitialState)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.attemptHistory))
  }, [state.attemptHistory])

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const preserveOnUnload = (): void => {
      window.sessionStorage.setItem(PRESERVE_ON_UNMOUNT_KEY, '1')
    }

    window.addEventListener('beforeunload', preserveOnUnload)

    return () => {
      window.removeEventListener('beforeunload', preserveOnUnload)
      const preserve = window.sessionStorage.getItem(PRESERVE_ON_UNMOUNT_KEY)
      window.sessionStorage.removeItem(PRESERVE_ON_UNMOUNT_KEY)
      if (preserve !== '1') {
        window.sessionStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  const registerAttemptStart = React.useCallback((item: RegisterAttemptStartInput): void => {
    dispatch({ type: 'registerAttemptStart', payload: item })
  }, [])

  const markAttemptResolved = React.useCallback((attemptId: number, status: 'solved' | 'failed'): void => {
    dispatch({ type: 'markAttemptResolved', payload: { attemptId, status } })
  }, [])

  const clearSession = React.useCallback((): void => {
    dispatch({ type: 'clearSession' })
  }, [])

  const value = React.useMemo<SolveSessionContextValue>(() => ({
    attemptHistory: state.attemptHistory,
    registerAttemptStart,
    markAttemptResolved,
    clearSession,
  }), [state.attemptHistory, registerAttemptStart, markAttemptResolved, clearSession])

  return (
    <SolveSessionContext.Provider value={value}>
      {children}
    </SolveSessionContext.Provider>
  )
}

export function useSolveSession(): SolveSessionContextValue {
  const context = React.useContext(SolveSessionContext)
  if (!context) {
    throw new Error('useSolveSession must be used within SolveSessionProvider')
  }

  return context
}