import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Chess, type Square } from 'chess.js'
import { toast } from 'sonner'
import { api, type RunPuzzleAttemptView, type RunPuzzleOverview } from '../../lib/api'
import { useAuth } from '../../context/auth'
import { useChessTheme } from '../../hooks/useChessTheme'
import { resolvePieceSet } from '../../lib/themes'
import { useSolveSession } from '../../context/solveSession'
import type { SessionAttemptHistoryItem } from '../../context/solveSession'
import {
  computeDests,
  applyUci,
  resultsInCheckmate,
  playerColor,
  computeFinalFen,
  HEADER_H,
  FOOTER_H,
  H_PAD_MD,
  MIN_SIDEBAR,
  MAX_BOARD,
  BOARD_GAP,
  LG_BREAKPOINT,
  V_PAD_DESKTOP,
  MOBILE_H_PAD,
  MOVE_FEEDBACK_SUCCESS_MS,
  WRONG_REVERT_MS,
  FAILED_TO_OVERVIEW_MS,
  TIMER_UPDATE_MS,
  INITIAL_OPPONENT_MOVE_DELAY_MS,
  OPPONENT_MOVE_ANIM_MS,
} from './boardPage.helpers'
import type { Mode, Orientation, PendingPromotion, MoveFeedbackResult, MoveFeedbackState } from './boardPage.helpers'

export type { Mode, Orientation, PendingPromotion, MoveFeedbackResult }

export type BoardState = {
  boardKey: number
  boardSize: number
  fen: string
  orientation: Orientation
  dests: Map<string, string[]>
  lastMove: [string, string] | undefined
  hintSquare: string | null
  pendingPromotion: PendingPromotion | null
  moveFeedback: {
    result: MoveFeedbackResult | null
    square: string | null
    visible: boolean
  }
  turnToMove: Orientation
  kingPieceUrl: string
}

export type TimerState = {
  elapsedTenths: number
  targetSolveTenths: number | null
}

export type OverviewState = {
  data: RunPuzzleOverview | null
}

export type BoardPageActions = {
  handleUserMove: (orig: string, dest: string) => void
  onPromotionPieceSelected: (piece: 'q' | 'r' | 'b' | 'n') => void
  onPromotionCancel: () => void
  handleShowHint: () => void
  handleShowSolution: () => void
  handleRetake: () => Promise<void>
  handleNextPuzzle: () => Promise<void>
  dismissRunComplete: () => void
}

export type BoardPageControllerResult = {
  mode: Mode
  solvingView: RunPuzzleAttemptView | null
  board: BoardState
  timer: TimerState
  session: {
    attemptHistory: SessionAttemptHistoryItem[]
    movesPlayed: string[]
    allPliesPlayed: string[]
    failedRetryPlies: string[]
    liveFocusStatus: 'in_progress' | 'solved' | 'failed'
  }
  overview: OverviewState
  isLoadingNextPuzzle: boolean
  runJustCompleted: boolean
  inputBlocked: boolean
  actions: BoardPageActions
}

export type BoardPageControllerParams = {
  runId: number
  runPuzzleId: number
  attemptId: number | null
  runIdStr: string
  runPuzzleIdStr: string
  routeKind: 'attempt' | 'overview'
}

export function useBoardPageController(params: BoardPageControllerParams): BoardPageControllerResult {
  const { runId, runPuzzleId, attemptId, runIdStr, runPuzzleIdStr, routeKind } = params
  const navigate = useNavigate()
  const { user } = useAuth()
  const { attemptHistory, registerAttemptStart, markAttemptResolved } = useSolveSession()
  useChessTheme(user?.boardTheme, user?.pieceTheme)

  const chessRef = useRef<Chess | null>(null)
  const modeRef = useRef<Mode>('loading')
  const moveIndexRef = useRef(1)
  const inputBlockedRef = useRef(false)
  const movesPlayedRef = useRef<string[]>([])
  const allPliesRef = useRef<string[]>([])
  const failedRetryPliesRef = useRef<string[]>([])
  const solutionMovesRef = useRef<string[]>([])
  const currentAttemptIdRef = useRef<number | null>(null)
  const displayFenRef = useRef('')
  const elapsedRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingPromotionRef = useRef<PendingPromotion | null>(null)
  const committedLastMoveRef = useRef<[string, string] | undefined>(undefined)
  const moveFeedbackRef = useRef<MoveFeedbackState>({
    lastMoveResult: null,
    lastMoveSquare: null,
    isShowingMoveFeedback: false,
  })
  const concludeFnRef = useRef<() => Promise<void>>(async () => {})
  const concludingRef = useRef(false)
  const skipNextLoadRef = useRef(false)
  const cachedOverviewPuzzleRef = useRef<RunPuzzleOverview | null>(null)
  const loadRequestIdRef = useRef(0)
  const isAttemptReadyRef = useRef(false)
  const latestResolvedAttemptIdRef = useRef<number | null>(null)
  const primeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  const [mode, setMode] = useState<Mode>('loading')
  const [solvingView, setSolvingView] = useState<RunPuzzleAttemptView | null>(null)
  const [overview, setOverview] = useState<RunPuzzleOverview | null>(null)
  const [orientation, setOrientation] = useState<Orientation>('white')
  const [currentAttemptId, setCurrentAttemptId] = useState<number | null>(null)
  const [displayFen, setDisplayFen] = useState('')
  const [dests, setDests] = useState<Map<string, string[]>>(new Map())
  const [lastMove, setLastMove] = useState<[string, string] | undefined>(undefined)
  const [inputBlocked, setInputBlocked] = useState(false)
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null)
  const [hintSquare, setHintSquare] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [targetSolveTenths, setTargetSolveTenths] = useState<number | null>(null)
  const [boardKey, setBoardKey] = useState(0)
  const [isLoadingNextPuzzle, setIsLoadingNextPuzzle] = useState(false)
  const [runJustCompleted, setRunJustCompleted] = useState(false)
  const [movesPlayed, setMovesPlayed] = useState<string[]>([])
  const [allPliesPlayed, setAllPliesPlayed] = useState<string[]>([])
  const [failedRetryPlies, setFailedRetryPlies] = useState<string[]>([])
  const [liveFocusStatus, setLiveFocusStatus] = useState<'in_progress' | 'solved' | 'failed'>('in_progress')
  const [isAttemptReady, setIsAttemptReady] = useState(false)
  const [lastMoveResult, setLastMoveResult] = useState<MoveFeedbackResult | null>(null)
  const [lastMoveSquare, setLastMoveSquare] = useState<string | null>(null)
  const [isShowingMoveFeedback, setIsShowingMoveFeedback] = useState(false)
  const [boardSize, setBoardSize] = useState(480)

  useEffect(() => {
    const compute = (): void => {
      const isDesktop = window.innerWidth >= LG_BREAKPOINT
      if (isDesktop) {
        const availH = window.innerHeight - HEADER_H - FOOTER_H - V_PAD_DESKTOP
        const availW = window.innerWidth - H_PAD_MD - 2 * MIN_SIDEBAR - 2 * BOARD_GAP
        setBoardSize(Math.max(200, Math.min(availH, availW, MAX_BOARD)))
      } else {
        const availWMobile = window.innerWidth - MOBILE_H_PAD
        setBoardSize(Math.max(200, Math.min(availWMobile, MAX_BOARD)))
      }
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  const setFen = useCallback((fen: string): void => {
    displayFenRef.current = fen
    setDisplayFen(fen)
  }, [])

  const setBlocked = useCallback((v: boolean): void => {
    inputBlockedRef.current = v
    setInputBlocked(v)
  }, [])

  const setPendingPromotionBoth = useCallback((v: PendingPromotion | null): void => {
    pendingPromotionRef.current = v
    setPendingPromotion(v)
  }, [])

  const setMoveFeedback = useCallback((
    result: MoveFeedbackResult | null,
    square: string | null,
    visible: boolean,
  ): void => {
    moveFeedbackRef.current = { lastMoveResult: result, lastMoveSquare: square, isShowingMoveFeedback: visible }
    setLastMoveResult(result)
    setLastMoveSquare(square)
    setIsShowingMoveFeedback(visible)
  }, [])

  const clearMoveFeedback = useCallback((): void => {
    setMoveFeedback(null, null, false)
  }, [setMoveFeedback])

  const hideMoveFeedbackBadge = useCallback((): void => {
    const current = moveFeedbackRef.current
    setMoveFeedback(current.lastMoveResult, current.lastMoveSquare, false)
  }, [setMoveFeedback])

  const clearOverviewState = useCallback((): void => {
    setOverview(null)
    setSolvingView(null)
    cachedOverviewPuzzleRef.current = null
  }, [])

  const clearPendingTimeouts = useCallback((): void => {
    for (const timeoutId of pendingTimeoutsRef.current) {
      clearTimeout(timeoutId)
    }
    pendingTimeoutsRef.current.clear()
  }, [])

  const scheduleTimeout = useCallback((callback: () => void, delayMs: number): ReturnType<typeof setTimeout> => {
    const timeoutId = setTimeout(() => {
      pendingTimeoutsRef.current.delete(timeoutId)
      callback()
    }, delayMs)
    pendingTimeoutsRef.current.add(timeoutId)
    return timeoutId
  }, [])

  const navigateToOverview = useCallback((selectedAttemptId: number | null, replace = false): void => {
    if (modeRef.current === 'focus' && currentAttemptIdRef.current !== null) {
      return
    }

    void navigate({
      to: '/app/runs/$runId/puzzles/$runPuzzleId/overview',
      params: { runId: runIdStr, runPuzzleId: runPuzzleIdStr },
      search: selectedAttemptId === null ? {} : { attempt: selectedAttemptId },
      replace,
    })
  }, [navigate, runIdStr, runPuzzleIdStr])

  const applyFreshActiveState = useCallback((data: RunPuzzleAttemptView): void => {
    clearPendingTimeouts()

    if (primeTimeoutRef.current !== null) {
      clearTimeout(primeTimeoutRef.current)
      primeTimeoutRef.current = null
    }

    const solutionMoves = data.puzzle.solution
    const chess = new Chess(data.puzzle.fen)

    chessRef.current = chess
    solutionMovesRef.current = solutionMoves
    moveIndexRef.current = 0
    inputBlockedRef.current = true
    movesPlayedRef.current = []
    allPliesRef.current = []
    setMovesPlayed([])
    setAllPliesPlayed([])
    setLiveFocusStatus('in_progress')
    currentAttemptIdRef.current = data.attempt.id
    concludingRef.current = false
    latestResolvedAttemptIdRef.current = null
    elapsedRef.current = 0
    committedLastMoveRef.current = undefined
    isAttemptReadyRef.current = false

    setSolvingView(data)
    setCurrentAttemptId(data.attempt.id)
    setOrientation(playerColor(data.puzzle.fen))
    setElapsedSeconds(0)
    setPendingPromotionBoth(null)
    setBlocked(true)
    clearMoveFeedback()
    setHintSquare(null)
    setFen(data.puzzle.fen)
    setDests(new Map())
    setLastMove(undefined)
    setIsAttemptReady(false)
    modeRef.current = 'focus'
    setMode('focus')

    primeTimeoutRef.current = setTimeout(() => {
      const ch = chessRef.current
      if (!ch) return
      const firstMove = solutionMovesRef.current[0]
      applyUci(ch, firstMove)
      allPliesRef.current = [firstMove]
      setAllPliesPlayed([firstMove])
      const lm: [string, string] = [firstMove.slice(0, 2), firstMove.slice(2, 4)]
      committedLastMoveRef.current = lm
      setFen(ch.fen())
      setLastMove(lm)
      setDests(computeDests(ch))
      moveIndexRef.current = 1

      primeTimeoutRef.current = setTimeout(() => {
        primeTimeoutRef.current = null
        isAttemptReadyRef.current = true
        setIsAttemptReady(true)
        inputBlockedRef.current = false
        setInputBlocked(false)
      }, OPPONENT_MOVE_ANIM_MS)
    }, INITIAL_OPPONENT_MOVE_DELAY_MS)
  }, [clearMoveFeedback, clearPendingTimeouts, setFen, setBlocked, setPendingPromotionBoth])

  const applyOverviewDisplayState = useCallback((data: RunPuzzleOverview): void => {
    const solutionMoves = data.puzzle.solution
    const selectedAttemptEntry = data.attempts.find((a) => a.id === data.selectedAttemptId) ?? null
    const boardFen =
      selectedAttemptEntry?.board?.terminalFen ??
      computeFinalFen(data.puzzle.fen, solutionMoves)
    const boardLastMove: [string, string] | undefined =
      selectedAttemptEntry?.board?.lastMove ?? undefined

    chessRef.current = new Chess(data.puzzle.fen)
    solutionMovesRef.current = solutionMoves
    moveIndexRef.current = 1
    inputBlockedRef.current = false
    movesPlayedRef.current = []
    currentAttemptIdRef.current = null
    elapsedRef.current = 0
    committedLastMoveRef.current = undefined

    setCurrentAttemptId(null)
    setOrientation(playerColor(data.puzzle.fen))
    setElapsedSeconds(0)
    setPendingPromotionBoth(null)
    setBlocked(false)
    clearMoveFeedback()
    setHintSquare(null)
    setFen(boardFen)
    setDests(new Map())
    setLastMove(boardLastMove)
    setBoardKey((k) => k + 1)
    modeRef.current = 'overview'
    setMode('overview')
  }, [clearMoveFeedback, setFen, setBlocked, setPendingPromotionBoth])

  useEffect(() => {
    loadRequestIdRef.current += 1
    const requestId = loadRequestIdRef.current

    if (skipNextLoadRef.current) {
      const cached = cachedOverviewPuzzleRef.current
      if (cached !== null) {
        skipNextLoadRef.current = false
        cachedOverviewPuzzleRef.current = null
        applyOverviewDisplayState(cached)
        return
      }
      skipNextLoadRef.current = false
    }

    if (
      modeRef.current === 'focus' &&
      currentAttemptIdRef.current !== null &&
      currentAttemptIdRef.current === attemptId
    ) {
      return
    }

    void (async () => {
      try {
        if (routeKind === 'overview') {
          const { overview: overviewData } = await api.runs.getOverview(runId, runPuzzleId, attemptId ?? undefined)

          if (requestId !== loadRequestIdRef.current) return

          setOverview(overviewData)
          applyOverviewDisplayState(overviewData)
          return
        }

        if (attemptId === null) {
          toast.error('Invalid attempt', { description: 'Attempt not found for this puzzle.' })
          void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
          return
        }

        const attemptResponse = await api.runs.getAttempt(runId, runPuzzleId, attemptId)

        if (requestId !== loadRequestIdRef.current) return

        if (attemptResponse.kind === 'completed_attempt') {
          navigateToOverview(attemptId, true)
          return
        }

        const data = attemptResponse.attemptView
        setTargetSolveTenths(data.timer.targetSolveTenths)
        applyFreshActiveState(data)
      } catch {
        if (requestId !== loadRequestIdRef.current) {
          return
        }
        toast.error('Failed to load puzzle', { description: 'Please try again.' })
        void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
      }
    })()
  }, [
    runId,
    runPuzzleId,
    attemptId,
    navigate,
    runIdStr,
    routeKind,
    applyFreshActiveState,
    applyOverviewDisplayState,
    navigateToOverview,
  ])

  useEffect(() => {
    if (routeKind !== 'overview') return
    if (currentAttemptId === null) return
    void navigate({
      to: '/app/runs/$runId/puzzles/$runPuzzleId/attempts/$attemptId',
      params: { runId: runIdStr, runPuzzleId: runPuzzleIdStr, attemptId: String(currentAttemptId) },
      replace: true,
    })
  }, [routeKind, currentAttemptId, navigate, runIdStr, runPuzzleIdStr])

  useEffect(() => {
    if (mode !== 'focus' || !isAttemptReady) return
    timerRef.current = setInterval(() => {
      elapsedRef.current += TIMER_UPDATE_MS / 100
      setElapsedSeconds(elapsedRef.current)
    }, TIMER_UPDATE_MS)
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [mode, isAttemptReady])

  useEffect(() => {
    return () => {
      clearPendingTimeouts()
      if (primeTimeoutRef.current !== null) {
        clearTimeout(primeTimeoutRef.current)
      }
    }
  }, [clearPendingTimeouts])

  useEffect(() => {
    if (currentAttemptId === null) return
    const handler = (e: BeforeUnloadEvent): void => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [currentAttemptId])

  useEffect(() => {
    if (mode !== 'focus') return
    if (solvingView === null || currentAttemptId === null) return
    registerAttemptStart({
      attemptId: currentAttemptId,
      runPuzzleId: solvingView.runPuzzle.id,
      puzzlePosition: solvingView.runPuzzle.position + 1,
    })
  }, [mode, solvingView, currentAttemptId, registerAttemptStart])

  const enterFailed = useCallback((): void => {
    modeRef.current = 'failed'
    setMode('failed')
    setHintSquare(null)
    failedRetryPliesRef.current = []
    setFailedRetryPlies([])
  }, [])

  const conclude = useCallback(async (): Promise<void> => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const id = currentAttemptIdRef.current
    if (id === null) return

    concludingRef.current = true
    try {
      const result = await api.attempts.complete(runId, runPuzzleId, id, movesPlayedRef.current, Math.round(elapsedRef.current * 100))

      if (currentAttemptIdRef.current !== id) {
        markAttemptResolved(id, result.outcome)
        latestResolvedAttemptIdRef.current = id
        return
      }

      markAttemptResolved(id, result.outcome)
      latestResolvedAttemptIdRef.current = id
      setCurrentAttemptId(null)
      currentAttemptIdRef.current = null

      setOverview(result.overview)

      if (result.runCompletedByThisAttempt) {
        setRunJustCompleted(true)
      }

      cachedOverviewPuzzleRef.current = result.overview

      if (result.outcome === 'solved') {
        skipNextLoadRef.current = true
        navigateToOverview(id, false)
      } else {
        enterFailed()
      }
    } catch {
      toast.error('Failed to submit attempt', { description: 'Please try again.' })
    } finally {
      concludingRef.current = false
    }
  }, [enterFailed, markAttemptResolved, navigateToOverview, runId, runPuzzleId])

  concludeFnRef.current = conclude

  const applyOpponentMove = useCallback((uci: string): void => {
    const chess = chessRef.current
    if (!chess) return
    applyUci(chess, uci)
    if (modeRef.current === 'focus') {
      allPliesRef.current = [...allPliesRef.current, uci]
      setAllPliesPlayed(allPliesRef.current)
    } else if (modeRef.current === 'failed') {
      failedRetryPliesRef.current = [...failedRetryPliesRef.current, uci]
      setFailedRetryPlies(failedRetryPliesRef.current)
    }
    setFen(chess.fen())
    const lm: [string, string] = [uci.slice(0, 2), uci.slice(2, 4)]
    setLastMove(lm)
    committedLastMoveRef.current = lm
    setDests(computeDests(chess))
    moveIndexRef.current += 1
  }, [setFen])

  const resolveCorrectMove = useCallback((orig: string, dest: string, uci: string): void => {
    const chess = chessRef.current
    if (!chess) return

    applyUci(chess, uci)
    if (modeRef.current === 'focus') {
      movesPlayedRef.current = [...movesPlayedRef.current, uci]
      setMovesPlayed(movesPlayedRef.current)
      allPliesRef.current = [...allPliesRef.current, uci]
      setAllPliesPlayed(allPliesRef.current)
    } else if (modeRef.current === 'failed') {
      failedRetryPliesRef.current = [...failedRetryPliesRef.current, uci]
      setFailedRetryPlies(failedRetryPliesRef.current)
    }
    setFen(chess.fen())
    setLastMove([orig, dest])
    committedLastMoveRef.current = [orig, dest]
    setDests(computeDests(chess))
    setMoveFeedback('correct', dest, true)
    setHintSquare(null)
    moveIndexRef.current += 1

    const solutionMoves = solutionMovesRef.current
    if (moveIndexRef.current >= solutionMoves.length) {
      if (modeRef.current === 'focus') setLiveFocusStatus('solved')
      scheduleTimeout(() => {
        if (modeRef.current === 'focus') {
          void concludeFnRef.current()
        } else {
          scheduleTimeout(() => {
            skipNextLoadRef.current = true
            navigateToOverview(latestResolvedAttemptIdRef.current, false)
          }, FAILED_TO_OVERVIEW_MS)
        }
      }, MOVE_FEEDBACK_SUCCESS_MS)
      return
    }

    const opponentUci = solutionMoves[moveIndexRef.current]
    scheduleTimeout(() => {
      hideMoveFeedbackBadge()
      applyOpponentMove(opponentUci)
    }, MOVE_FEEDBACK_SUCCESS_MS)
  }, [setFen, applyOpponentMove, hideMoveFeedbackBadge, setMoveFeedback, navigateToOverview, scheduleTimeout])

  const resolveWrongMove = useCallback((
    orig: string,
    dest: string,
    promotionPiece?: 'q' | 'r' | 'b' | 'n',
  ): void => {
    const chess = chessRef.current
    if (!chess) return

    const prevFen = displayFenRef.current
    inputBlockedRef.current = true
    setInputBlocked(true)
    setMoveFeedback('wrong', dest, true)

    const uci = orig + dest + (promotionPiece ?? '')
    if (modeRef.current === 'focus') {
      movesPlayedRef.current = [...movesPlayedRef.current, uci]
      setMovesPlayed(movesPlayedRef.current)
      setLiveFocusStatus('failed')
    }

    chess.move({ from: orig, to: dest, promotion: promotionPiece ?? 'q' })
    setFen(chess.fen())
    setLastMove([orig, dest])

    scheduleTimeout(() => {
      chess.undo()
      displayFenRef.current = prevFen
      setDisplayFen(prevFen)
      setDests(computeDests(chess))
      setLastMove(committedLastMoveRef.current)
      hideMoveFeedbackBadge()
      setHintSquare(null)
      inputBlockedRef.current = false
      setInputBlocked(false)
      if (modeRef.current === 'focus') {
        void concludeFnRef.current()
      }
    }, WRONG_REVERT_MS)
  }, [setFen, setMoveFeedback, hideMoveFeedbackBadge, scheduleTimeout])

  const handleUserMove = useCallback((orig: string, dest: string): void => {
    if (inputBlockedRef.current) return
    if (concludingRef.current) return
    const chess = chessRef.current
    if (!chess) return
    if (modeRef.current !== 'focus' && modeRef.current !== 'failed') return

    const piece = chess.get(orig as Square)
    const isPromotion = piece?.type === 'p' && (dest[1] === '8' || dest[1] === '1')
    const solutionMoves = solutionMovesRef.current
    const moveIndex = moveIndexRef.current

    if (isPromotion) {
      const expectedBase = solutionMoves[moveIndex]?.slice(0, 4)
      const promotionPieces = ['q', 'r', 'b', 'n'] as const
      const squareLeadsToCheckmate = promotionPieces.some((p) => resultsInCheckmate(chess, orig, dest, p))
      if (orig + dest !== expectedBase && !squareLeadsToCheckmate) {
        resolveWrongMove(orig, dest, 'q')
      } else {
        inputBlockedRef.current = true
        setInputBlocked(true)
        pendingPromotionRef.current = { orig, dest }
        setPendingPromotion({ orig, dest })
      }
      return
    }

    const uci = orig + dest
    if (uci === solutionMoves[moveIndex] || resultsInCheckmate(chess, orig, dest)) {
      resolveCorrectMove(orig, dest, uci)
    } else {
      resolveWrongMove(orig, dest)
    }
  }, [resolveCorrectMove, resolveWrongMove])

  const onPromotionPieceSelected = useCallback((piece: 'q' | 'r' | 'b' | 'n'): void => {
    const pending = pendingPromotionRef.current
    if (!pending) return
    pendingPromotionRef.current = null
    setPendingPromotion(null)
    inputBlockedRef.current = false
    setInputBlocked(false)

    const uci = pending.orig + pending.dest + piece
    const chess = chessRef.current
    if (uci === solutionMovesRef.current[moveIndexRef.current] || (chess !== null && resultsInCheckmate(chess, pending.orig, pending.dest, piece))) {
      resolveCorrectMove(pending.orig, pending.dest, uci)
    } else {
      resolveWrongMove(pending.orig, pending.dest, piece)
    }
  }, [resolveCorrectMove, resolveWrongMove])

  const onPromotionCancel = useCallback((): void => {
    pendingPromotionRef.current = null
    setPendingPromotion(null)
    inputBlockedRef.current = false
    setInputBlocked(false)
    setBoardKey((k) => k + 1)
  }, [])

  const handleShowHint = useCallback((): void => {
    const next = solutionMovesRef.current[moveIndexRef.current]
    if (!next) return
    setHintSquare(next.slice(0, 2))
  }, [])

  const handleShowSolution = useCallback((): void => {
    if (inputBlockedRef.current) return
    const chess = chessRef.current
    const solutionMoves = solutionMovesRef.current
    const moveIndex = moveIndexRef.current
    if (!chess || moveIndex >= solutionMoves.length) return

    const uci = solutionMoves[moveIndex]
    inputBlockedRef.current = true
    setInputBlocked(true)
    applyUci(chess, uci)
    setFen(chess.fen())
    setLastMove([uci.slice(0, 2), uci.slice(2, 4)])
    setDests(computeDests(chess))
    setHintSquare(null)
    moveIndexRef.current += 1

    if (moveIndexRef.current >= solutionMoves.length) {
      scheduleTimeout(() => {
        inputBlockedRef.current = false
        setInputBlocked(false)
        skipNextLoadRef.current = true
        navigateToOverview(latestResolvedAttemptIdRef.current, false)
      }, FAILED_TO_OVERVIEW_MS)
      return
    }

    const opponentUci = solutionMoves[moveIndexRef.current]
    scheduleTimeout(() => {
      applyOpponentMove(opponentUci)
      inputBlockedRef.current = false
      setInputBlocked(false)
    }, 150)
  }, [setFen, applyOpponentMove, navigateToOverview, scheduleTimeout])

  const handleNextPuzzle = useCallback(async (): Promise<void> => {
    setIsLoadingNextPuzzle(true)
    try {
      const data = await api.runs.continue(runId)

      if (data.runCompleted) {
        return
      }

      const av = data.attemptView
      if (av.puzzle.solution.length < 2) {
        toast.error('Invalid puzzle', { description: 'Puzzle solution is too short.' })
        void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
        return
      }

      clearOverviewState()
      setTargetSolveTenths(av.timer.targetSolveTenths)
      applyFreshActiveState(av)
      setBoardKey((k) => k + 1)

      skipNextLoadRef.current = true
      void navigate({
        to: '/app/runs/$runId/puzzles/$runPuzzleId/attempts/$attemptId',
        params: {
          runId: runIdStr,
          runPuzzleId: String(av.runPuzzle.id),
          attemptId: String(av.attempt.id),
        },
      })
    } catch {
      toast.error('Failed to load next puzzle', { description: 'Please try again.' })
    } finally {
      setIsLoadingNextPuzzle(false)
    }
  }, [navigate, runId, runIdStr, applyFreshActiveState, clearOverviewState])

  const handleRetake = useCallback(async (): Promise<void> => {
    setIsLoadingNextPuzzle(true)
    try {
      const data = await api.runs.startPuzzle(runId, runPuzzleId)
      if (data.puzzle.solution.length < 2) {
        toast.error('Invalid puzzle', { description: 'Puzzle solution is too short.' })
        return
      }

      clearOverviewState()
      setTargetSolveTenths(data.timer.targetSolveTenths)
      applyFreshActiveState(data)
      setBoardKey((k) => k + 1)

      skipNextLoadRef.current = true
      void navigate({
        to: '/app/runs/$runId/puzzles/$runPuzzleId/attempts/$attemptId',
        params: {
          runId: runIdStr,
          runPuzzleId: String(data.runPuzzle.id),
          attemptId: String(data.attempt.id),
        },
      })
    } catch {
      toast.error('Failed to start puzzle', { description: 'Please try again.' })
    } finally {
      setIsLoadingNextPuzzle(false)
    }
  }, [navigate, runId, runPuzzleId, runIdStr, applyFreshActiveState, clearOverviewState])

  const dismissRunComplete = useCallback((): void => {
    setRunJustCompleted(false)
  }, [])

  const turnToMove: Orientation = displayFen.split(' ')[1] === 'b' ? 'black' : 'white'
  const pieceSet = resolvePieceSet(user?.pieceTheme ?? '')
  const kingPieceUrl = turnToMove === 'white' ? pieceSet.pieces.wK : pieceSet.pieces.bK

  return {
    mode,
    solvingView,
    board: {
      boardKey,
      boardSize,
      fen: displayFen,
      orientation,
      dests,
      lastMove,
      hintSquare,
      pendingPromotion,
      moveFeedback: { result: lastMoveResult, square: lastMoveSquare, visible: isShowingMoveFeedback },
      turnToMove,
      kingPieceUrl,
    },
    timer: {
      elapsedTenths: elapsedSeconds,
      targetSolveTenths,
    },
    session: { attemptHistory, movesPlayed, allPliesPlayed, failedRetryPlies, liveFocusStatus },
    overview: { data: overview },
    isLoadingNextPuzzle,
    runJustCompleted,
    inputBlocked,
    actions: {
      handleUserMove,
      onPromotionPieceSelected,
      onPromotionCancel,
      handleShowHint,
      handleShowSolution,
      handleRetake,
      handleNextPuzzle,
      dismissRunComplete,
    },
  }
}
