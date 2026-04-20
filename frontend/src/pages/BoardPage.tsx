import 'chessground/assets/chessground.base.css'
import * as React from 'react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, Link } from '@tanstack/react-router'
import { Chess, type Square } from 'chess.js'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-chessground ships no bundled type declarations
import Chessground from 'react-chessground'
import { toast } from 'sonner'
import { api, type RunPuzzleFull, type CompleteAttemptResult } from '../lib/api'
import { useAuth } from '../context/auth'
import { useChessTheme } from '../hooks/useChessTheme'
import { Button } from '../components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '../components/ui/breadcrumb'
import { Badge } from '../components/ui/badge'

const HEADER_H = 57
const FOOTER_H = 49
const BOARD_GAP = 24
const H_PAD_MD = 48
const H_PAD_SM = 32
const MIN_SIDEBAR = 96
const MAX_BOARD = 760

type Mode = 'loading' | 'focus' | 'failed' | 'overview'
type Orientation = 'white' | 'black'
type PendingPromotion = { orig: string; dest: string }

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
  const capped = Math.min(seconds, 600)
  const m = Math.floor(capped / 60)
  const s = capped % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function computeFinalFen(fen: string, solutionMoves: string[]): string {
  const chess = new Chess(fen)
  for (const uci of solutionMoves) applyUci(chess, uci)
  return chess.fen()
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

export function BoardPage(): React.ReactElement {
  const navigate = useNavigate()
  const { user } = useAuth()
  useChessTheme(user?.boardTheme, user?.pieceTheme)

  const { runId: runIdStr, runPuzzleId: runPuzzleIdStr, attemptId: attemptIdStr } = useParams({
    from: '/app/runs/$runId/puzzles/$runPuzzleId/attempts/$attemptId',
  })
  const runId = parseInt(runIdStr, 10)
  const runPuzzleId = parseInt(runPuzzleIdStr, 10)
  const attemptId = parseInt(attemptIdStr, 10)

  // ── Refs: mutable game state read by stable callbacks ──────────────────────
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

  // Refs to the latest conclude/enterOverview — so handleUserMove never goes stale
  const concludeFnRef = useRef<(status: 'solved' | 'failed') => Promise<void>>(async () => {})
  const enterOverviewFnRef = useRef<() => void>(() => {})
  const concludingRef = useRef(false)

  // ── State: drives rendering ─────────────────────────────────────────────────
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
  const [overviewFen, setOverviewFen] = useState('')
  const [boardKey, setBoardKey] = useState(0)

  const [showGiveUpDialog, setShowGiveUpDialog] = useState(false)
  const [concluding, setConcluding] = useState(false)
  const [, setCompleteResult] = useState<CompleteAttemptResult | null>(null)

  // ── Board sizing: fill viewport height minus chrome ────────────────────────
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

  // ── Sync helpers (update ref + state together) ──────────────────────────────
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

  // ── Load puzzle on mount ────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const data = await api.runs.getPuzzle(runId, runPuzzleId)
        const solutionMoves = data.solution.split(' ')

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
        setOrientation(playerColor(data.fen))
        setCurrentAttemptId(resolvedAttemptId)
        setElapsedSeconds(0)
        setPendingPromotionBoth(null)
        setBlocked(false)
        setHintSquare(null)

        if (targetMode === 'overview') {
          const finalFen = computeFinalFen(data.fen, solutionMoves)
          setOverviewFen(finalFen)
          setFen(finalFen)
          setDests(new Map())
          setLastMove(undefined)
        } else {
          setFen(initialFen)
          setDests(computeDests(chess))
          setLastMove(initialLastMove)
        }

        modeRef.current = targetMode
        setMode(targetMode)
      } catch {
        toast.error('Failed to load puzzle', { description: 'Please try again.' })
        void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
      }
    })()
  }, [runId, runPuzzleId, attemptId])

  // ── Timer: runs only in focus mode ─────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'focus') return
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1
      setElapsedSeconds(elapsedRef.current)
    }, 1000)
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [mode])

  // ── beforeunload: registered while an attempt is live ──────────────────────
  useEffect(() => {
    if (currentAttemptId === null) return
    const handler = (e: BeforeUnloadEvent): void => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [currentAttemptId])

  // ── Mode transitions ────────────────────────────────────────────────────────
  const enterOverview = useCallback((): void => {
    const data = puzzleRef.current
    if (!data) return
    const finalFen = computeFinalFen(data.fen, solutionMovesRef.current)
    setOverviewFen(finalFen)
    setFen(finalFen)
    setDests(new Map())
    setLastMove(undefined)
    setHintSquare(null)
    modeRef.current = 'overview'
    setMode('overview')
  }, [setFen])

  const enterFailed = useCallback((): void => {
    modeRef.current = 'failed'
    setMode('failed')
    setHintSquare(null)
  }, [])

  // Keep fn refs up-to-date so stable handleUserMove always calls the latest
  enterOverviewFnRef.current = enterOverview

  const conclude = useCallback(async (status: 'solved' | 'failed'): Promise<void> => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const id = currentAttemptIdRef.current
    if (id === null) return

    concludingRef.current = true
    setConcluding(true)
    try {
      const result = await api.attempts.complete(id, status, movesPlayedRef.current)
      setCompleteResult(result)
      setCurrentAttemptId(null)
      currentAttemptIdRef.current = null

      if (result.markedForRetry || status === 'solved') {
        enterOverviewFnRef.current()
      } else {
        enterFailed()
      }
    } catch {
      toast.error('Failed to submit attempt', { description: 'Please try again.' })
    } finally {
      concludingRef.current = false
      setConcluding(false)
    }
  }, [enterFailed])

  concludeFnRef.current = conclude

  // ── Core board logic (stable — reads only from refs) ────────────────────────
  const applyOpponentMove = useCallback((uci: string): void => {
    const chess = chessRef.current
    if (!chess) return
    applyUci(chess, uci)
    setFen(chess.fen())
    setLastMove([uci.slice(0, 2), uci.slice(2, 4)])
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
    setDests(computeDests(chess))
    setHintSquare(null)
    moveIndexRef.current += 1

    const solutionMoves = solutionMovesRef.current
    if (moveIndexRef.current >= solutionMoves.length) {
      if (modeRef.current === 'focus') {
        void concludeFnRef.current('solved')
      } else {
        setTimeout(() => enterOverviewFnRef.current(), 300)
      }
      return
    }

    const opponentUci = solutionMoves[moveIndexRef.current]
    setTimeout(() => applyOpponentMove(opponentUci), 150)
  }, [setFen, applyOpponentMove])

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

    const uci = orig + dest + (promotionPiece ?? '')
    if (modeRef.current === 'focus') {
      movesPlayedRef.current = [...movesPlayedRef.current, uci]
      void concludeFnRef.current('failed')
    }

    chess.move({ from: orig, to: dest, promotion: promotionPiece ?? 'q' })
    setFen(chess.fen())
    setLastMove([orig, dest])

    setTimeout(() => {
      chess.undo()
      displayFenRef.current = prevFen
      setDisplayFen(prevFen)
      setDests(computeDests(chess))
      setLastMove(undefined)
      setHintSquare(null)
      inputBlockedRef.current = false
      setInputBlocked(false)
    }, 500)
  }, [setFen])

  // Stable — safe to pass to chessground events
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
        enterOverviewFnRef.current()
      }, 300)
      return
    }

    const opponentUci = solutionMoves[moveIndexRef.current]
    setTimeout(() => {
      applyOpponentMove(opponentUci)
      inputBlockedRef.current = false
      setInputBlocked(false)
    }, 150)
  }, [setFen, applyOpponentMove])

  // ── Render ──────────────────────────────────────────────────────────────────
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
            <Link to="/app">Training</Link>
          </BreadcrumbLink>
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

  const puzzleInfo = (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">
        Puzzle {puzzle.position + 1} of {puzzle.totalPuzzles}
      </span>
      {puzzle.maxTriesPerPuzzle > 1 && (
        <span className="text-xs text-muted-foreground">
          Try {puzzle.currentTryNumber}
        </span>
      )}
    </div>
  )

  // Active board (focus / failed)
  const activeBoard = (
    <div className="chess-board-container relative shrink-0" style={{ width: boardSize, height: boardSize }}>
      <Chessground
        key={boardKey}
        width={boardSize}
        height={boardSize}
        fen={displayFen}
        orientation={orientation}
        turnColor={orientation}
        movable={{
          color: orientation,
          dests,
          free: false,
          events: { after: handleUserMove },
        }}
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
    </div>
  )

  // Static board (overview)
  const staticBoard = (
    <div className="chess-board-container shrink-0" style={{ width: boardSize, height: boardSize }}>
      <Chessground
        width={boardSize}
        height={boardSize}
        fen={overviewFen}
        orientation={orientation}
        turnColor={orientation}
        movable={{ color: undefined, free: false }}
        lastMove={undefined}
        animation={{ enabled: false }}
        highlight={{ lastMove: false, check: false }}
        premovable={{ enabled: false }}
      />
    </div>
  )

  const outerCls = 'flex flex-1 items-center justify-center overflow-hidden px-6'
  const innerCls = 'flex w-full items-start gap-6'
  const sidebarCls = 'hidden flex-1 flex-col md:flex'

  // ── Focus mode ──────────────────────────────────────────────────────────────
  if (mode === 'focus') {
    return (
      <div className={outerCls}>
        <div className={innerCls}>
          <aside className={sidebarCls} style={sidebarH}>
            <div className="mb-6">{breadcrumb}</div>
            {puzzleInfo}
          </aside>

          <div className="flex shrink-0 flex-col">
            <div className="mb-3 md:hidden">
              {breadcrumb}
              <div className="mt-1">{puzzleInfo}</div>
            </div>

            {activeBoard}

            <div className="mt-3 flex items-center justify-between md:hidden">
              <span className="tabular-nums text-sm font-medium">
                {formatTimer(elapsedSeconds)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGiveUpDialog(true)}
                disabled={concluding}
              >
                Give Up
              </Button>
            </div>
          </div>

          <aside className={sidebarCls} style={sidebarH}>
            <span className="tabular-nums text-sm font-medium">
              {formatTimer(elapsedSeconds)}
            </span>
            <div className="mt-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGiveUpDialog(true)}
                disabled={concluding}
              >
                Give Up
              </Button>
            </div>
          </aside>
        </div>

        <AlertDialog open={showGiveUpDialog} onOpenChange={setShowGiveUpDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Give up on this puzzle?</AlertDialogTitle>
              <AlertDialogDescription>
                Your progress on this try will be recorded.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void conclude('failed')}
                disabled={concluding}
              >
                {concluding ? 'Submitting…' : 'Give Up'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  // ── Failed mode ─────────────────────────────────────────────────────────────
  if (mode === 'failed') {
    const elapsed = formatTimer(elapsedRef.current)
    return (
      <div className={outerCls}>
        <div className={innerCls}>
          <aside className={sidebarCls} style={sidebarH}>
            <div className="mb-6">{breadcrumb}</div>
            <Badge variant="outline" className="w-fit">Failed</Badge>
            <div className="mt-4">{puzzleInfo}</div>
          </aside>

          <div className="flex shrink-0 flex-col">
            <div className="mb-3 md:hidden">
              {breadcrumb}
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline">Failed</Badge>
              </div>
              <div className="mt-1">{puzzleInfo}</div>
            </div>

            {activeBoard}

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
            <span className="tabular-nums text-sm text-muted-foreground">{elapsed}</span>
            <div className="mt-auto flex flex-col gap-2">
              <Button variant="outline" size="sm" onClick={handleShowHint} disabled={inputBlocked}>
                Show Hint
              </Button>
              <Button variant="outline" size="sm" onClick={handleShowSolution} disabled={inputBlocked}>
                Show Solution
              </Button>
            </div>
          </aside>
        </div>
      </div>
    )
  }

  // ── Overview mode (shell — content defined by future spec) ──────────────────
  return (
    <div className={outerCls}>
      <div className={innerCls}>
        <aside className={sidebarCls} style={sidebarH}>
          <div className="mb-6">{breadcrumb}</div>
          {puzzleInfo}
        </aside>

        <div className="flex shrink-0 flex-col">
          <div className="mb-3 md:hidden">
            {breadcrumb}
            <div className="mt-1">{puzzleInfo}</div>
          </div>
          {staticBoard}
        </div>

        <aside className={sidebarCls} style={sidebarH}>
          <p className="text-sm text-muted-foreground">Overview coming soon.</p>
        </aside>
      </div>
    </div>
  )
}
