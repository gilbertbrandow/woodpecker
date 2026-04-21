import 'chessground/assets/chessground.base.css'
import * as React from 'react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, Link } from '@tanstack/react-router'
import { Chess, type Square } from 'chess.js'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-chessground ships no bundled type declarations
import Chessground from 'react-chessground'
import { toast } from 'sonner'
import { api, type RunPuzzleFull, type CompleteAttemptResult, type Run, type RunPuzzleList, type RunPuzzleListItem } from '../lib/api'
import { useAuth } from '../context/auth'
import { useChessTheme } from '../hooks/useChessTheme'
import { resolvePieceSet } from '../lib/themes'
import { Button } from '../components/ui/button'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '../components/ui/breadcrumb'
import { Badge } from '../components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip'
import { SessionAttemptStrip } from '../components/SessionAttemptStrip'
import { Check, X } from 'lucide-react'
import type { PositionStatus } from '../lib/api'
import { formatSolveTimeMs } from '../lib/utils'
import { useSolveSession } from '../context/solveSession'

const HEADER_H = 57
const FOOTER_H = 49
const BOARD_GAP = 24
const H_PAD_MD = 48
const H_PAD_SM = 32
const MIN_SIDEBAR = 96
const MAX_BOARD = 760
const MOVE_FEEDBACK_SUCCESS_MS = 200
const WRONG_REVERT_MS = 500
const FAILED_TO_OVERVIEW_MS = 300
const TIMER_UPDATE_MS = 50

type Mode = 'loading' | 'focus' | 'failed' | 'overview'
type Orientation = 'white' | 'black'
type PendingPromotion = { orig: string; dest: string }
type MoveFeedbackResult = 'correct' | 'wrong'
type MoveFeedbackState = {
  lastMoveResult: MoveFeedbackResult | null
  lastMoveSquare: string | null
  isShowingMoveFeedback: boolean
}

function computeDests(chess: Chess): Map<string, string[]> {
  const dests = new Map<string, string[]>()
  for (const move of chess.moves({ verbose: true })) {
    const existing = dests.get(move.from) ?? []
    dests.set(move.from, [...existing, move.to])
  }
  return dests
}

function applyUci(chess: Chess, uci: string): void {
  chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length === 5 ? uci[4] : undefined,
  })
}

function playerColor(fen: string): Orientation {
  return fen.split(' ')[1] === 'w' ? 'black' : 'white'
}

function formatTimer(seconds: number): string {
  const capped = Math.min(seconds, 6_000)
  const wholeTenths = Math.floor(capped)
  const m = Math.floor(wholeTenths / 600)
  const s = Math.floor((wholeTenths % 600) / 10)
  const t = wholeTenths % 10
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${t}`
}

function formatTargetSolveTime(tenths: number): string {
  const wholeSeconds = Math.floor(Math.max(0, tenths) / 10)
  const minutes = Math.floor(wholeSeconds / 60)
  const seconds = wholeSeconds % 60

  if (minutes === 0) {
    return `${seconds}s`
  }

  if (seconds === 0) {
    return `${minutes}m`
  }

  return `${minutes}m ${seconds}s`
}

function positionStatusLabel(status: PositionStatus): string {
  switch (status) {
    case 'solved': return 'Solved'
    case 'solved_with_retries': return 'Solved'
    case 'failed': return 'Failed'
    case 'will_be_retried': return 'Will retry'
    case 'in_progress': return 'In progress'
    case 'not_started': return 'Not started'
  }
}

function computeFinalFen(fen: string, solutionMoves: string[]): string {
  const chess = new Chess(fen)
  for (const uci of solutionMoves) applyUci(chess, uci)
  return chess.fen()
}

const POSITION_STATUS_CLASS: Record<PositionStatus, string> = {
  not_started: '',
  in_progress: 'border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
  will_be_retried: 'border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
  solved: 'border-green-600/30 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  solved_with_retries: 'border-green-600/30 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  failed: 'border-red-600/30 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400',
}

const ATTEMPT_STATUS_CLASS: Record<string, string> = {
  solved: 'border-green-600/30 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  failed: 'border-red-600/30 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  in_progress: 'border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
}

const ATTEMPT_STATUS_LABEL: Record<string, string> = {
  solved: 'Solved',
  failed: 'Failed',
  in_progress: 'In progress',
}

type StatsResult = {
  accuracy: number | null
  avgTimeMs: number | null
  solvedCount: number
  resolvedCount: number
  timeCount: number
}

function computeStats(puzzles: RunPuzzleListItem[], excludeId?: number): StatsResult {
  const items = excludeId !== undefined ? puzzles.filter((p) => p.runPuzzleId !== excludeId) : puzzles
  const resolved = items.filter((p) =>
    p.positionStatus === 'solved' || p.positionStatus === 'solved_with_retries' || p.positionStatus === 'failed',
  )
  const solvedItems = resolved.filter(
    (p) => p.positionStatus === 'solved' || p.positionStatus === 'solved_with_retries',
  )
  const times = solvedItems.map((p) => p.timeMs).filter((t): t is number => t !== null)
  return {
    accuracy: resolved.length > 0 ? (solvedItems.length / resolved.length) * 100 : null,
    avgTimeMs: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    solvedCount: solvedItems.length,
    resolvedCount: resolved.length,
    timeCount: times.length,
  }
}

type DeltaBadgeProps = {
  delta: number | null
  goodWhenPositive: boolean
  format: (n: number) => string
}

function DeltaBadge({ delta, goodWhenPositive, format }: DeltaBadgeProps): React.ReactElement | null {
  if (delta === null || delta === 0) return null
  const isGood = goodWhenPositive ? delta > 0 : delta < 0
  const arrow = delta > 0 ? '▲' : '▼'
  const sign = delta > 0 ? '+' : '−'
  const cls = isGood
    ? 'border-green-600/30 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    : 'border-red-600/30 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
  return (
    <Badge variant="outline" className={`text-xs ${cls}`}>
      {arrow} {sign}{format(Math.abs(delta))}
    </Badge>
  )
}

type AttemptScoringProps = {
  currentTryNumber: number
  maxTriesPerPuzzle: number
  positionStatus: PositionStatus
  attemptActive: boolean
}

function AttemptScoring({ currentTryNumber, maxTriesPerPuzzle, positionStatus, attemptActive }: AttemptScoringProps): React.ReactElement | null {
  const withinWindow = currentTryNumber <= maxTriesPerPuzzle

  if (!withinWindow) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Practice attempt</span>
        <Badge variant="outline" className="w-fit text-xs">{positionStatusLabel(positionStatus)}</Badge>
        <span className="text-xs text-muted-foreground">Won't affect your score.</span>
      </div>
    )
  }

  if (maxTriesPerPuzzle <= 1) return null

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        Attempt {currentTryNumber} / {maxTriesPerPuzzle}
      </span>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: maxTriesPerPuzzle }).map((_, i) => {
          const n = i + 1
          const isUsed = n < currentTryNumber || (n === currentTryNumber && !attemptActive)
          const isCurrent = n === currentTryNumber && attemptActive
          return (
            <div
              key={i}
              className={`rounded-full ${
                isUsed
                  ? 'h-2 w-2 bg-foreground/35'
                  : isCurrent
                    ? 'h-2.5 w-2.5 bg-foreground'
                    : 'h-2 w-2 bg-foreground/10'
              }`}
            />
          )
        })}
      </div>
    </div>
  )
}

type PromotionPickerProps = {
  pending: PendingPromotion
  orientation: Orientation
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void
  onCancel: () => void
}

function PromotionPicker({ pending, orientation, onSelect, onCancel }: PromotionPickerProps): React.ReactElement {
  const fileIndex = pending.dest.charCodeAt(0) - 97
  const colIndex = orientation === 'white' ? fileIndex : 7 - fileIndex
  const leftPct = colIndex * 12.5

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  const pieces: Array<{ piece: 'q' | 'r' | 'b' | 'n'; label: string }> = [
    { piece: 'q', label: 'Q' },
    { piece: 'r', label: 'R' },
    { piece: 'b', label: 'B' },
    { piece: 'n', label: 'N' },
  ]

  return (
    <div
      className="absolute inset-0 z-10"
      onClick={onCancel}
      onContextMenu={(e) => { e.preventDefault(); onCancel() }}
    >
      <div
        className="absolute top-0 flex flex-col border border-border bg-background shadow-md"
        style={{ left: `${leftPct}%`, width: '12.5%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {pieces.map(({ piece, label }) => (
          <button
            key={piece}
            type="button"
            className="flex w-full items-center justify-center border-b border-border py-2 text-sm font-semibold hover:bg-accent last:border-b-0"
            onClick={() => onSelect(piece)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

type MoveFeedbackBadgeProps = {
  result: MoveFeedbackResult
  square: string
  orientation: Orientation
}

function MoveFeedbackBadge({ result, square, orientation }: MoveFeedbackBadgeProps): React.ReactElement | null {
  if (square.length !== 2) return null

  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1])
  if (Number.isNaN(rank) || file < 0 || file > 7 || rank < 1 || rank > 8) return null

  const col = orientation === 'white' ? file : 7 - file
  const row = orientation === 'white' ? 8 - rank : rank - 1
  const left = col * 12.5
  const top = row * 12.5
  const isCorrect = result === 'correct'

  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{ left: `${left}%`, top: `${top}%`, width: '12.5%', height: '12.5%' }}
    >
      <div
        className={`absolute right-[6%] top-[6%] flex h-[38%] w-[38%] items-center justify-center rounded-full border shadow-sm ${
          isCorrect
            ? 'border-emerald-300/90 bg-emerald-500/85 text-white'
            : 'border-red-300/90 bg-red-500/85 text-white'
        }`}
      >
        {isCorrect ? <Check className="h-[65%] w-[65%]" strokeWidth={3} /> : <X className="h-[65%] w-[65%]" strokeWidth={3} />}
      </div>
    </div>
  )
}

type TimerCardProps = {
  timerText: string
  elapsedTenths: number
  targetSolveTenths: number | null
  muted?: boolean
}

function TimerCard({ timerText, elapsedTenths, targetSolveTenths, muted = false }: TimerCardProps): React.ReactElement {
  const hasTarget = targetSolveTenths !== null && targetSolveTenths > 0
  const isExpired = hasTarget && elapsedTenths >= targetSolveTenths
  const shouldShowBar = hasTarget && !isExpired
  const rawLeftPct = hasTarget ? ((targetSolveTenths - elapsedTenths) / targetSolveTenths) * 100 : 0
  const leftPct = Math.max(0, Math.min(100, rawLeftPct))
  const targetText = hasTarget ? formatTargetSolveTime(targetSolveTenths) : ''
  const progressHue = leftPct >= 60
    ? 60 + ((leftPct - 60) / 40) * 60
    : leftPct >= 20
      ? ((leftPct - 20) / 40) * 60
      : 0
  const progressColor = `hsl(${progressHue} 55% 48%)`

  return (
    <div className="min-h-24 rounded-md px-3 py-3">
      <div className="flex min-h-16 flex-col items-start justify-center">
        <div className="inline-flex flex-col items-start">
          <div className="flex items-center gap-2">
            <span className={`tabular-nums text-3xl font-semibold leading-none ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>
              {timerText}
            </span>
            {isExpired && (
              <Badge variant="secondary" className="h-6 rounded-sm px-2 text-[11px] font-medium">
                Target time missed
              </Badge>
            )}
          </div>
          {hasTarget && (
            <div className="mt-3 h-1.5 w-full max-w-full">
              {shouldShowBar && (
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <div className="w-full cursor-default">
                      <div className="h-1.5 bg-foreground/15">
                        <div
                          className="ml-auto h-full transition-[width,background-color] duration-100 ease-linear"
                          style={{ width: `${leftPct}%`, backgroundColor: progressColor }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {`Target solve time: ${targetText}. This bar shows how much of that time is remaining.`}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function BoardPage(): React.ReactElement | null {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { attemptHistory, registerAttemptStart, markAttemptResolved } = useSolveSession()
  useChessTheme(user?.boardTheme, user?.pieceTheme)

  const { runId: runIdStr, runPuzzleId: runPuzzleIdStr, attemptId: attemptIdStr } = useParams({
    from: '/app/solve-flow/runs/$runId/puzzles/$runPuzzleId/attempts/$attemptId',
  })
  const runId = parseInt(runIdStr, 10)
  const runPuzzleId = parseInt(runPuzzleIdStr, 10)
  const attemptId = parseInt(attemptIdStr, 10)

  const chessRef = useRef<Chess | null>(null)
  const modeRef = useRef<Mode>('loading')
  const moveIndexRef = useRef(1)
  const inputBlockedRef = useRef(false)
  const movesPlayedRef = useRef<string[]>([])
  const solutionMovesRef = useRef<string[]>([])
  const currentAttemptIdRef = useRef<number | null>(null)
  const displayFenRef = useRef('')
  const puzzleRef = useRef<RunPuzzleFull | null>(null)
  const elapsedRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingPromotionRef = useRef<PendingPromotion | null>(null)
  const committedLastMoveRef = useRef<[string, string] | undefined>(undefined)
  const moveFeedbackRef = useRef<MoveFeedbackState>({
    lastMoveResult: null,
    lastMoveSquare: null,
    isShowingMoveFeedback: false,
  })

  const concludeFnRef = useRef<(status: 'solved' | 'failed') => Promise<void>>(async () => {})
  const concludingRef = useRef(false)
  const skipNextLoadRef = useRef(false)

  const [mode, setMode] = useState<Mode>('loading')
  const [puzzle, setPuzzle] = useState<RunPuzzleFull | null>(null)
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
  const [participationId, setParticipationId] = useState<number | null>(null)
  const [boardKey, setBoardKey] = useState(0)
  const [isLoadingNextPuzzle, setIsLoadingNextPuzzle] = useState(false)

  const [overviewRun, setOverviewRun] = useState<Run | null>(null)
  const [overviewPuzzleList, setOverviewPuzzleList] = useState<RunPuzzleList | null>(null)
  const [overviewFreshPuzzle, setOverviewFreshPuzzle] = useState<RunPuzzleFull | null>(null)

  const [, setCompleteResult] = useState<CompleteAttemptResult | null>(null)
  const [lastMoveResult, setLastMoveResult] = useState<MoveFeedbackResult | null>(null)
  const [lastMoveSquare, setLastMoveSquare] = useState<string | null>(null)
  const [isShowingMoveFeedback, setIsShowingMoveFeedback] = useState(false)

  const [boardSize, setBoardSize] = useState(480)

  useEffect(() => {
    const compute = (): void => {
      const isDesktop = window.innerWidth >= 768
      const availH = window.innerHeight - HEADER_H - FOOTER_H
      if (isDesktop) {
        const availW = window.innerWidth - H_PAD_MD - 2 * MIN_SIDEBAR - 2 * BOARD_GAP
        setBoardSize(Math.max(200, Math.min(availH, availW, MAX_BOARD)))
      } else {
        setBoardSize(Math.max(200, Math.min(window.innerWidth - H_PAD_SM, MAX_BOARD)))
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
    moveFeedbackRef.current = {
      lastMoveResult: result,
      lastMoveSquare: square,
      isShowingMoveFeedback: visible,
    }
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

  useEffect(() => {
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false
      return
    }
    void (async () => {
      try {
        setParticipationId(null)
        const [data, run] = await Promise.all([
          api.runs.getPuzzle(runId, runPuzzleId),
          api.runs.get(runId),
        ])
        const solutionMoves = data.solution.split(' ')

        let resolvedTargetSolveTenths: number | null = null
        try {
          const participation = await api.participations.get(run.participationId)
          const runTarget = participation.runTargets.find((t) => t.runIndex === data.runIndex)
          resolvedTargetSolveTenths = runTarget?.targetSolveSeconds !== null && runTarget?.targetSolveSeconds !== undefined
            ? Math.max(0, Math.round(runTarget.targetSolveSeconds * 10))
            : null
        } catch {
          resolvedTargetSolveTenths = null
        }

        if (solutionMoves.length < 2) {
          toast.error('Invalid puzzle', { description: 'Puzzle solution is too short.' })
          void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
          return
        }

        let targetMode: 'focus' | 'overview'
        let resolvedAttemptId: number | null = null

        if (attemptId === data.currentAttemptId) {
          targetMode = 'focus'
          resolvedAttemptId = attemptId
        } else if (data.tries.some((t) => t.id === attemptId)) {
          targetMode = 'overview'
        } else {
          toast.error('Invalid attempt', { description: 'Attempt not found for this puzzle.' })
          void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
          return
        }

        const chess = new Chess(data.fen)
        applyUci(chess, solutionMoves[0])

        chessRef.current = chess
        solutionMovesRef.current = solutionMoves
        moveIndexRef.current = 1
        inputBlockedRef.current = false
        movesPlayedRef.current = []
        currentAttemptIdRef.current = resolvedAttemptId
        puzzleRef.current = data
        elapsedRef.current = 0

        const initialFen = chess.fen()
        const initialLastMove: [string, string] = [
          solutionMoves[0].slice(0, 2),
          solutionMoves[0].slice(2, 4),
        ]

          setPuzzle(data)
          setParticipationId(run.participationId)
        setTargetSolveTenths(resolvedTargetSolveTenths)
        setOrientation(playerColor(data.fen))
        setCurrentAttemptId(resolvedAttemptId)
        setElapsedSeconds(0)
        setPendingPromotionBoth(null)
        setBlocked(false)
        clearMoveFeedback()
        setHintSquare(null)

        if (targetMode === 'overview') {
          const finalFen = computeFinalFen(data.fen, solutionMoves)
          setFen(finalFen)
          setDests(new Map())
          setLastMove(undefined)
        } else {
          setFen(initialFen)
          setDests(computeDests(chess))
          setLastMove(initialLastMove)
          committedLastMoveRef.current = initialLastMove
        }

        modeRef.current = targetMode
        setMode(targetMode)
      } catch {
        toast.error('Failed to load puzzle', { description: 'Please try again.' })
        void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
      }
    })()
  }, [runId, runPuzzleId, attemptId, clearMoveFeedback])

  useEffect(() => {
    if (mode !== 'focus') return
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
  }, [mode])

  useEffect(() => {
    if (currentAttemptId === null) return
    const handler = (e: BeforeUnloadEvent): void => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [currentAttemptId])

  useEffect(() => {
    if (mode !== 'overview') return
    setOverviewFreshPuzzle(null)
    setOverviewRun(null)
    setOverviewPuzzleList(null)
    void (async () => {
      try {
        const [freshPuzzle, runData, listData] = await Promise.all([
          api.runs.getPuzzle(runId, runPuzzleId),
          api.runs.get(runId),
          api.runs.puzzles(runId),
        ])
        setOverviewFreshPuzzle(freshPuzzle)
        setOverviewRun(runData)
        setOverviewPuzzleList(listData)
      } catch {
        toast.error('Failed to load overview', { description: 'Please try again.' })
      }
    })()
  }, [mode, runId, runPuzzleId])

  useEffect(() => {
    if (mode !== 'focus') return
    if (!puzzle || currentAttemptId === null) return

    registerAttemptStart({
      attemptId: currentAttemptId,
      runPuzzleId: puzzle.runPuzzleId,
      puzzlePosition: puzzle.position + 1,
    })
  }, [mode, puzzle, currentAttemptId, registerAttemptStart])

  const enterOverview = useCallback((): void => {
    const data = puzzleRef.current
    if (!data) return
    const finalFen = computeFinalFen(data.fen, solutionMovesRef.current)
    setFen(finalFen)
    setDests(new Map())
    setLastMove(undefined)
    setHintSquare(null)
    setPendingPromotionBoth(null)
    modeRef.current = 'overview'
    setMode('overview')
  }, [setFen, setPendingPromotionBoth])

  const handleNextPuzzle = useCallback(async (): Promise<void> => {
    setIsLoadingNextPuzzle(true)
    try {
      const data = await api.runs.continue(runId)
      if (data.currentAttemptId === null) {
        toast.error('Run complete', { description: 'No more puzzles to solve.' })
        void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
        return
      }

      const solutionMoves = data.solution.split(' ')
      if (solutionMoves.length < 2) {
        toast.error('Invalid puzzle', { description: 'Puzzle solution is too short.' })
        void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
        return
      }

      const chess = new Chess(data.fen)
      applyUci(chess, solutionMoves[0])
      const initialLastMove: [string, string] = [solutionMoves[0].slice(0, 2), solutionMoves[0].slice(2, 4)]

      chessRef.current = chess
      solutionMovesRef.current = solutionMoves
      moveIndexRef.current = 1
      inputBlockedRef.current = false
      movesPlayedRef.current = []
      currentAttemptIdRef.current = data.currentAttemptId
      puzzleRef.current = data
      elapsedRef.current = 0
      committedLastMoveRef.current = initialLastMove

      setOverviewFreshPuzzle(null)
      setOverviewRun(null)
      setOverviewPuzzleList(null)
      setPuzzle(data)
      setCurrentAttemptId(data.currentAttemptId)
      setOrientation(playerColor(data.fen))
      setElapsedSeconds(0)
      setPendingPromotionBoth(null)
      setBlocked(false)
      clearMoveFeedback()
      setHintSquare(null)
      setFen(chess.fen())
      setDests(computeDests(chess))
      setLastMove(initialLastMove)
      modeRef.current = 'focus'
      setMode('focus')
      setBoardKey((k) => k + 1)

      skipNextLoadRef.current = true
      void navigate({
        to: '/app/runs/$runId/puzzles/$runPuzzleId/attempts/$attemptId',
        params: {
          runId: runIdStr,
          runPuzzleId: String(data.runPuzzleId),
          attemptId: String(data.currentAttemptId),
        },
      })
    } catch {
      toast.error('Failed to load next puzzle', { description: 'Please try again.' })
    } finally {
      setIsLoadingNextPuzzle(false)
    }
  }, [navigate, runId, runIdStr, setFen, setBlocked, setPendingPromotionBoth, clearMoveFeedback])

  const handleRetake = useCallback(async (): Promise<void> => {
    setIsLoadingNextPuzzle(true)
    try {
      const data = await api.runs.startPuzzle(runId, runPuzzleId)
      if (data.currentAttemptId === null) {
        toast.error('Could not start puzzle', { description: 'Please try again.' })
        return
      }

      const solutionMoves = data.solution.split(' ')
      if (solutionMoves.length < 2) {
        toast.error('Invalid puzzle', { description: 'Puzzle solution is too short.' })
        return
      }

      const chess = new Chess(data.fen)
      applyUci(chess, solutionMoves[0])
      const initialLastMove: [string, string] = [solutionMoves[0].slice(0, 2), solutionMoves[0].slice(2, 4)]

      chessRef.current = chess
      solutionMovesRef.current = solutionMoves
      moveIndexRef.current = 1
      inputBlockedRef.current = false
      movesPlayedRef.current = []
      currentAttemptIdRef.current = data.currentAttemptId
      puzzleRef.current = data
      elapsedRef.current = 0
      committedLastMoveRef.current = initialLastMove

      setOverviewFreshPuzzle(null)
      setOverviewRun(null)
      setOverviewPuzzleList(null)
      setPuzzle(data)
      setCurrentAttemptId(data.currentAttemptId)
      setOrientation(playerColor(data.fen))
      setElapsedSeconds(0)
      setPendingPromotionBoth(null)
      setBlocked(false)
      clearMoveFeedback()
      setHintSquare(null)
      setFen(chess.fen())
      setDests(computeDests(chess))
      setLastMove(initialLastMove)
      modeRef.current = 'focus'
      setMode('focus')
      setBoardKey((k) => k + 1)

      skipNextLoadRef.current = true
      void navigate({
        to: '/app/runs/$runId/puzzles/$runPuzzleId/attempts/$attemptId',
        params: {
          runId: runIdStr,
          runPuzzleId: String(data.runPuzzleId),
          attemptId: String(data.currentAttemptId),
        },
      })
    } catch {
      toast.error('Failed to start puzzle', { description: 'Please try again.' })
    } finally {
      setIsLoadingNextPuzzle(false)
    }
  }, [navigate, runId, runPuzzleId, runIdStr, setFen, setBlocked, setPendingPromotionBoth, clearMoveFeedback])

  const enterFailed = useCallback((): void => {
    modeRef.current = 'failed'
    setMode('failed')
    setHintSquare(null)
  }, [])

  const conclude = useCallback(async (status: 'solved' | 'failed'): Promise<void> => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const id = currentAttemptIdRef.current
    if (id === null) return

    concludingRef.current = true
    try {
      const result = await api.attempts.complete(id, status, movesPlayedRef.current)
      setCompleteResult(result)
      markAttemptResolved(id, status)
      setCurrentAttemptId(null)
      currentAttemptIdRef.current = null

      if (result.markedForRetry || status === 'solved') {
        enterOverview()
      } else {
        enterFailed()
      }
    } catch {
      toast.error('Failed to submit attempt', { description: 'Please try again.' })
    } finally {
      concludingRef.current = false
    }
  }, [enterFailed, enterOverview, markAttemptResolved])

  concludeFnRef.current = conclude

  const applyOpponentMove = useCallback((uci: string): void => {
    const chess = chessRef.current
    if (!chess) return
    applyUci(chess, uci)
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
      setTimeout(() => {
        if (modeRef.current === 'focus') {
          void concludeFnRef.current('solved')
        } else {
          setTimeout(() => enterOverview(), FAILED_TO_OVERVIEW_MS)
        }
      }, MOVE_FEEDBACK_SUCCESS_MS)
      return
    }

    const opponentUci = solutionMoves[moveIndexRef.current]
    setTimeout(() => {
      hideMoveFeedbackBadge()
      applyOpponentMove(opponentUci)
    }, MOVE_FEEDBACK_SUCCESS_MS)
  }, [setFen, applyOpponentMove, hideMoveFeedbackBadge, setMoveFeedback, enterOverview])

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
    }

    chess.move({ from: orig, to: dest, promotion: promotionPiece ?? 'q' })
    setFen(chess.fen())
    setLastMove([orig, dest])

    setTimeout(() => {
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
        void concludeFnRef.current('failed')
      }
    }, WRONG_REVERT_MS)
  }, [setFen, setMoveFeedback, hideMoveFeedbackBadge])

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
      if (orig + dest !== expectedBase) {
        resolveWrongMove(orig, dest)
      } else {
        inputBlockedRef.current = true
        setInputBlocked(true)
        pendingPromotionRef.current = { orig, dest }
        setPendingPromotion({ orig, dest })
      }
      return
    }

    const uci = orig + dest
    if (uci === solutionMoves[moveIndex]) {
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
    if (uci === solutionMovesRef.current[moveIndexRef.current]) {
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
      setTimeout(() => {
        inputBlockedRef.current = false
        setInputBlocked(false)
        enterOverview()
      }, FAILED_TO_OVERVIEW_MS)
      return
    }

    const opponentUci = solutionMoves[moveIndexRef.current]
    setTimeout(() => {
      applyOpponentMove(opponentUci)
      inputBlockedRef.current = false
      setInputBlocked(false)
    }, 150)
  }, [setFen, applyOpponentMove, enterOverview])

  if (!puzzle || mode === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  const sidebarH = { height: boardSize }

  const breadcrumb = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/app">Dashboard</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {participationId !== null ? (
            <BreadcrumbLink asChild>
              <Link
                to="/app/participations/$participationId"
                params={{ participationId: String(participationId) }}
                title={puzzle.scheduleName}
              >
                {puzzle.scheduleName.length > 8 ? `${puzzle.scheduleName.slice(0, 5)}...` : puzzle.scheduleName}
              </Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage title={puzzle.scheduleName}>
              {puzzle.scheduleName.length > 8 ? `${puzzle.scheduleName.slice(0, 5)}...` : puzzle.scheduleName}
            </BreadcrumbPage>
          )}
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/app/runs/$runId" params={{ runId: runIdStr }}>
              Run {puzzle.runIndex + 1}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Puzzle {puzzle.position + 1}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )

  const turnToMove: Orientation = displayFen.split(' ')[1] === 'b' ? 'black' : 'white'
  const turnLabel = turnToMove === 'white' ? 'White' : 'Black'
  const pieceSet = resolvePieceSet(user?.pieceTheme ?? '')
  const kingPieceUrl = turnToMove === 'white' ? pieceSet.pieces.wK : pieceSet.pieces.bK
  const moveStatusTitle = lastMoveResult === 'correct'
    ? 'Correct, continue'
    : lastMoveResult === 'wrong'
      ? 'Wrong, try again'
      : `${turnLabel} to move`
  const moveStatusHelp = lastMoveResult === 'correct'
    ? 'Great move. Stay sharp for the next position.'
    : lastMoveResult === 'wrong'
      ? 'Try another idea from this position.'
      : `Find the best move for ${turnToMove}.`

  const moveStatusIcon = lastMoveResult === 'correct'
    ? (
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-600/35 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/35 dark:bg-emerald-400/15 dark:text-emerald-300">
        <Check className="h-6 w-6" strokeWidth={2.75} />
      </span>
    )
    : lastMoveResult === 'wrong'
      ? (
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-600/35 bg-red-500/15 text-red-700 dark:border-red-400/35 dark:bg-red-400/15 dark:text-red-300">
          <X className="h-6 w-6" strokeWidth={2.75} />
        </span>
      )
      : (
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white">
          <img
            src={kingPieceUrl}
            alt={`${turnLabel} king`}
            className="h-9 w-9 object-contain"
            draggable={false}
          />
        </span>
      )

  const moveStatusCard = (
    <div className="min-h-24 rounded-md border border-border px-3 py-3 text-foreground">
      <div className="flex min-h-16 items-center gap-3">
        {moveStatusIcon}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-base font-semibold leading-tight">{moveStatusTitle}</span>
          <span className="text-xs text-muted-foreground leading-tight">{moveStatusHelp}</span>
        </div>
      </div>
    </div>
  )

  const activeBoard = (
    <div className="chess-board-container relative shrink-0" style={{ width: boardSize, height: boardSize }}>
      <Chessground
        key={boardKey}
        width={boardSize}
        height={boardSize}
        fen={displayFen}
        orientation={orientation}
        turnColor={orientation}
        coordinates={true}
        movable={{
          color: orientation,
          dests,
          showDests: true,
          free: false,
          events: { after: handleUserMove },
        }}
        draggable={{ showGhost: true }}
        lastMove={lastMove}
        animation={{ enabled: true, duration: 150 }}
        highlight={{ lastMove: true, check: true }}
        premovable={{ enabled: false }}
        drawable={{
          enabled: true,
          visible: true,
          autoShapes: hintSquare ? [{ orig: hintSquare, brush: 'yellow' }] : [],
        }}
      />
      {pendingPromotion && (
        <PromotionPicker
          pending={pendingPromotion}
          orientation={orientation}
          onSelect={onPromotionPieceSelected}
          onCancel={onPromotionCancel}
        />
      )}
      {isShowingMoveFeedback && lastMoveResult && lastMoveSquare && (
        <MoveFeedbackBadge
          result={lastMoveResult}
          square={lastMoveSquare}
          orientation={orientation}
        />
      )}
    </div>
  )

  const outerCls = 'flex flex-1 items-center justify-center overflow-hidden px-6'
  const innerCls = 'flex w-full items-start gap-6'
  const sidebarCls = 'hidden flex-1 flex-col md:flex'

  if (mode === 'focus') {
    return (
      <div className={outerCls}>
        <div className={innerCls}>
          <aside className={sidebarCls} style={sidebarH}>
            <div className="mb-6">{breadcrumb}</div>
            <AttemptScoring
              currentTryNumber={puzzle.currentTryNumber}
              maxTriesPerPuzzle={puzzle.maxTriesPerPuzzle}
              positionStatus={puzzle.positionStatus}
              attemptActive={true}
            />
          </aside>

          <div className="flex shrink-0 flex-col">
            <div className="mb-3 md:hidden">
              {breadcrumb}
              {puzzle.maxTriesPerPuzzle > 1 && (
                <div className="mt-1">
                  {puzzle.currentTryNumber <= puzzle.maxTriesPerPuzzle ? (
                    <span className="text-xs text-muted-foreground">
                      Attempt {puzzle.currentTryNumber} / {puzzle.maxTriesPerPuzzle}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Practice attempt</span>
                  )}
                </div>
              )}
            </div>

            {activeBoard}

            <SessionAttemptStrip items={attemptHistory} />

            <div className="mt-3 flex items-center justify-between md:hidden">
              <span className="tabular-nums text-sm font-medium">
                {formatTimer(elapsedSeconds)}
              </span>
            </div>
          </div>

          <aside className={sidebarCls} style={sidebarH}>
            <TimerCard
              timerText={formatTimer(elapsedSeconds)}
              elapsedTenths={elapsedSeconds}
              targetSolveTenths={targetSolveTenths}
            />
            <div className="mt-auto">{moveStatusCard}</div>
          </aside>
        </div>
      </div>
    )
  }

  if (mode === 'failed') {
    const elapsed = formatTimer(elapsedRef.current)
    return (
      <div className={outerCls}>
        <div className={innerCls}>
          <aside className={sidebarCls} style={sidebarH}>
            <div className="mb-6">{breadcrumb}</div>
            <Badge variant="outline" className="w-fit">Failed</Badge>
            <div className="mt-4">
              <AttemptScoring
                currentTryNumber={puzzle.currentTryNumber}
                maxTriesPerPuzzle={puzzle.maxTriesPerPuzzle}
                positionStatus={puzzle.positionStatus}
                attemptActive={false}
              />
            </div>
          </aside>

          <div className="flex shrink-0 flex-col">
            <div className="mb-3 md:hidden">
              {breadcrumb}
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline">Failed</Badge>
                {puzzle.maxTriesPerPuzzle > 1 && (
                  <span className="text-xs text-muted-foreground">
                    {puzzle.currentTryNumber <= puzzle.maxTriesPerPuzzle
                      ? `Attempt ${puzzle.currentTryNumber} / ${puzzle.maxTriesPerPuzzle}`
                      : 'Practice attempt'}
                  </span>
                )}
              </div>
            </div>

            {activeBoard}

            <SessionAttemptStrip items={attemptHistory} />

            <div className="mt-3 flex items-center justify-between md:hidden">
              <span className="tabular-nums text-sm text-muted-foreground">{elapsed}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleShowHint} disabled={inputBlocked}>
                  Show Hint
                </Button>
                <Button variant="outline" size="sm" onClick={handleShowSolution} disabled={inputBlocked}>
                  Show Solution
                </Button>
              </div>
            </div>
          </div>

          <aside className={sidebarCls} style={sidebarH}>
            <TimerCard
              timerText={elapsed}
              elapsedTenths={elapsedRef.current}
              targetSolveTenths={targetSolveTenths}
              muted={true}
            />
            <div className="mt-auto flex flex-col gap-3">
              <Button variant="outline" size="sm" onClick={handleShowHint} disabled={inputBlocked}>
                Show Hint
              </Button>
              <Button variant="outline" size="sm" onClick={handleShowSolution} disabled={inputBlocked}>
                Show Solution
              </Button>
              {moveStatusCard}
            </div>
          </aside>
        </div>
      </div>
    )
  }

  const overviewAfterStats = overviewPuzzleList ? computeStats(overviewPuzzleList.puzzles) : null
  const overviewBeforeStats = overviewPuzzleList ? computeStats(overviewPuzzleList.puzzles, runPuzzleId) : null

  const accuracyDelta =
    overviewAfterStats?.accuracy != null &&
    overviewBeforeStats?.accuracy != null &&
    overviewBeforeStats.resolvedCount > 0
      ? overviewAfterStats.accuracy - overviewBeforeStats.accuracy
      : null

  const timeDelta =
    overviewAfterStats?.avgTimeMs != null &&
    overviewBeforeStats?.avgTimeMs != null &&
    overviewBeforeStats.timeCount > 0
      ? overviewAfterStats.avgTimeMs - overviewBeforeStats.avgTimeMs
      : null

  const overviewAttemptHistory = overviewFreshPuzzle && (
    <div className="flex flex-col gap-1.5">
      {overviewFreshPuzzle.tries.map((attempt, idx) => (
        <React.Fragment key={attempt.id}>
          {overviewFreshPuzzle.maxTriesPerPuzzle > 1 && idx === overviewFreshPuzzle.maxTriesPerPuzzle && (
            <div className="my-1 flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">Practice</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-xs text-muted-foreground">Try {attempt.tryNumber}</span>
            <Badge variant="outline" className={`text-xs ${ATTEMPT_STATUS_CLASS[attempt.status] ?? ''}`}>
              {ATTEMPT_STATUS_LABEL[attempt.status] ?? attempt.status}
            </Badge>
            <span className="ml-auto tabular-nums text-xs text-muted-foreground">
              {attempt.timeSpentMs !== null ? formatSolveTimeMs(attempt.timeSpentMs) : '—'}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  )

  const overviewStatsSection = overviewAfterStats && (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Accuracy</span>
        <div className="flex items-baseline gap-2">
          <span className="tabular-nums text-2xl font-semibold">
            {overviewAfterStats.accuracy !== null ? `${overviewAfterStats.accuracy.toFixed(1)}%` : '—'}
          </span>
          <DeltaBadge delta={accuracyDelta} goodWhenPositive={true} format={(n) => `${n.toFixed(1)}%`} />
        </div>
        {overviewAfterStats.resolvedCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {overviewAfterStats.solvedCount} of {overviewAfterStats.resolvedCount} resolved
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Avg solve time</span>
        <div className="flex items-baseline gap-2">
          <span className="tabular-nums text-2xl font-semibold">
            {overviewAfterStats.avgTimeMs !== null ? formatSolveTimeMs(overviewAfterStats.avgTimeMs) : '—'}
          </span>
          <DeltaBadge delta={timeDelta} goodWhenPositive={false} format={formatSolveTimeMs} />
        </div>
        {overviewAfterStats.timeCount > 0 && (
          <span className="text-xs text-muted-foreground">
            across {overviewAfterStats.timeCount} solved puzzle{overviewAfterStats.timeCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )

  const overviewActionsSection = overviewRun && (
    <div className="mt-auto flex flex-col gap-3">
      <Button
        className="w-full bg-foreground text-background hover:bg-foreground/90"
        disabled={overviewRun.status !== 'active' || isLoadingNextPuzzle}
        onClick={() => void handleNextPuzzle()}
      >
        Next puzzle
      </Button>
      {overviewRun.status === 'completed' && (
        <p className="text-center text-xs text-muted-foreground">Run complete</p>
      )}
      {overviewRun.status === 'aborted' && (
        <p className="text-center text-xs text-muted-foreground">Run aborted</p>
      )}
      <Button
        variant="outline"
        className="w-full"
        disabled={overviewRun.status !== 'active' || isLoadingNextPuzzle}
        onClick={() => void handleRetake()}
      >
        Retake
      </Button>
    </div>
  )

  return (
    <div className={outerCls}>
      <div className={innerCls}>
        <aside className={sidebarCls} style={sidebarH}>
          <div className="mb-6">{breadcrumb}</div>
          {overviewFreshPuzzle ? (
            <div className="flex flex-col gap-4">
              <Badge
                variant="outline"
                className={`w-fit ${POSITION_STATUS_CLASS[overviewFreshPuzzle.positionStatus]}`}
              >
                {positionStatusLabel(overviewFreshPuzzle.positionStatus)}
              </Badge>
              {overviewAttemptHistory}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </aside>

        <div className="flex shrink-0 flex-col">
          <div className="mb-3 md:hidden">
            {breadcrumb}
            {overviewFreshPuzzle && (
              <div className="mt-1">
                <Badge
                  variant="outline"
                  className={`text-xs ${POSITION_STATUS_CLASS[overviewFreshPuzzle.positionStatus]}`}
                >
                  {positionStatusLabel(overviewFreshPuzzle.positionStatus)}
                </Badge>
              </div>
            )}
          </div>
          {activeBoard}
          <SessionAttemptStrip items={attemptHistory} />
          {overviewFreshPuzzle && overviewAfterStats && overviewRun && (
            <div className="mt-4 flex flex-col gap-6 md:hidden">
              {overviewStatsSection}
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full bg-foreground text-background hover:bg-foreground/90"
                  disabled={overviewRun.status !== 'active'}
                  onClick={() => void navigate({ to: '/app/runs/$runId/solve', params: { runId: runIdStr } })}
                >
                  Next puzzle
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={overviewRun.status !== 'active' || isLoadingNextPuzzle}
                  onClick={() => void handleRetake()}
                >
                  Retake
                </Button>
              </div>
            </div>
          )}
        </div>

        <aside className={sidebarCls} style={sidebarH}>
          {overviewAfterStats && overviewRun ? (
            <>
              {overviewStatsSection}
              {overviewActionsSection}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </aside>
      </div>
    </div>
  )
}
