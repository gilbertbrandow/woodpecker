import 'chessground/assets/chessground.base.css'
import * as React from 'react'
import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from '@tanstack/react-router'
import { Chess } from 'chess.js'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-chessground ships no bundled type declarations
import Chessground from 'react-chessground'
import { toast } from 'sonner'
import {
  api,
  type RunPuzzleFull,
  type Run,
  type RunPuzzleList,
  type RunPuzzleListItem,
  type PositionStatus,
} from '../lib/api'
import { useAuth } from '../context/auth'
import { useChessTheme } from '../hooks/useChessTheme'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '../components/ui/breadcrumb'
import { formatSolveTimeMs } from '../lib/utils'

const HEADER_H = 57
const FOOTER_H = 49
const BOARD_GAP = 24
const H_PAD_MD = 48
const H_PAD_SM = 32
const MIN_SIDEBAR = 96
const MAX_BOARD = 760

type Orientation = 'white' | 'black'

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

const POSITION_STATUS_CLASS: Record<PositionStatus, string> = {
  not_started: '',
  in_progress: 'border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
  will_be_retried: 'border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
  solved: 'border-green-600/30 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  solved_with_retries: 'border-green-600/30 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  failed: 'border-red-600/30 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400',
}

const POSITION_STATUS_LABEL: Record<PositionStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  will_be_retried: 'Will retry',
  solved: 'Solved',
  solved_with_retries: 'Solved',
  failed: 'Failed',
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
  const solved = resolved.filter(
    (p) => p.positionStatus === 'solved' || p.positionStatus === 'solved_with_retries',
  )
  const times = solved.map((p) => p.timeMs).filter((t): t is number => t !== null)
  return {
    accuracy: resolved.length > 0 ? (solved.length / resolved.length) * 100 : null,
    avgTimeMs: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    solvedCount: solved.length,
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

export function RunPuzzleOverviewPage(): React.ReactElement {
  const navigate = useNavigate()
  const { user } = useAuth()
  useChessTheme(user?.boardTheme, user?.pieceTheme)

  const { runId: runIdStr, runPuzzleId: runPuzzleIdStr } = useParams({
    from: '/app/solve-flow/runs/$runId/puzzles/$runPuzzleId/overview',
  })
  const runId = parseInt(runIdStr, 10)
  const runPuzzleId = parseInt(runPuzzleIdStr, 10)

  const [puzzle, setPuzzle] = useState<RunPuzzleFull | null>(null)
  const [run, setRun] = useState<Run | null>(null)
  const [puzzleList, setPuzzleList] = useState<RunPuzzleList | null>(null)
  const [boardFen, setBoardFen] = useState('')
  const [orientation, setOrientation] = useState<Orientation>('white')
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

  useEffect(() => {
    void (async () => {
      try {
        const [puzzleData, runData, listData] = await Promise.all([
          api.runs.getPuzzle(runId, runPuzzleId),
          api.runs.get(runId),
          api.runs.puzzles(runId),
        ])

        const solutionMoves = puzzleData.solution.split(' ')
        if (solutionMoves.length < 2) {
          toast.error('Invalid puzzle data', { description: 'Please try again.' })
          void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
          return
        }

        const chess = new Chess(puzzleData.fen)
        if (puzzleData.tries.length > 0) {
          for (const uci of solutionMoves) applyUci(chess, uci)
        } else {
          applyUci(chess, solutionMoves[0])
        }

        setPuzzle(puzzleData)
        setRun(runData)
        setPuzzleList(listData)
        setBoardFen(chess.fen())
        setOrientation(playerColor(puzzleData.fen))
      } catch {
        toast.error('Failed to load overview', { description: 'Please try again.' })
        void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
      }
    })()
  }, [runId, runPuzzleId])

  if (!puzzle || !run) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  const hasAttempts = puzzle.tries.length > 0
  const isActive = run.status === 'active'
  const sidebarH = { height: boardSize }

  const after = puzzleList ? computeStats(puzzleList.puzzles) : null
  const before = puzzleList ? computeStats(puzzleList.puzzles, runPuzzleId) : null

  const accuracyDelta =
    after?.accuracy !== null && after?.accuracy !== undefined &&
    before?.accuracy !== null && before?.accuracy !== undefined &&
    before.resolvedCount > 0
      ? after.accuracy - before.accuracy
      : null

  const timeDelta =
    after?.avgTimeMs !== null && after?.avgTimeMs !== undefined &&
    before?.avgTimeMs !== null && before?.avgTimeMs !== undefined &&
    before.timeCount > 0
      ? after.avgTimeMs - before.avgTimeMs
      : null

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

  const attemptHistory = (
    <div className="flex flex-col gap-1.5">
      {puzzle.tries.map((attempt, idx) => (
        <React.Fragment key={attempt.id}>
          {puzzle.maxTriesPerPuzzle > 1 && idx === puzzle.maxTriesPerPuzzle && (
            <div className="my-1 flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">Practice</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-xs text-muted-foreground">
              Try {attempt.tryNumber}
            </span>
            <Badge
              variant="outline"
              className={`text-xs ${ATTEMPT_STATUS_CLASS[attempt.status] ?? ''}`}
            >
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

  const board = (
    <div
      className="chess-board-container relative shrink-0"
      style={{ width: boardSize, height: boardSize }}
    >
      <Chessground
        width={boardSize}
        height={boardSize}
        fen={boardFen}
        orientation={orientation}
        turnColor={orientation}
        coordinates={true}
        movable={{ color: undefined, free: false }}
        lastMove={undefined}
        animation={{ enabled: false }}
        highlight={{ lastMove: false, check: false }}
        premovable={{ enabled: false }}
      />
    </div>
  )

  const statsSection = after && (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Accuracy
        </span>
        <div className="flex items-baseline gap-2">
          <span className="tabular-nums text-2xl font-semibold">
            {after.accuracy !== null ? `${after.accuracy.toFixed(1)}%` : '—'}
          </span>
          <DeltaBadge
            delta={accuracyDelta}
            goodWhenPositive={true}
            format={(n) => `${n.toFixed(1)}%`}
          />
        </div>
        {after.resolvedCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {after.solvedCount} of {after.resolvedCount} resolved
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Avg solve time
        </span>
        <div className="flex items-baseline gap-2">
          <span className="tabular-nums text-2xl font-semibold">
            {after.avgTimeMs !== null ? formatSolveTimeMs(after.avgTimeMs) : '—'}
          </span>
          <DeltaBadge
            delta={timeDelta}
            goodWhenPositive={false}
            format={formatSolveTimeMs}
          />
        </div>
        {after.timeCount > 0 && (
          <span className="text-xs text-muted-foreground">
            across {after.timeCount} solved puzzle{after.timeCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )

  const actionsSection = (
    <div className="mt-auto flex flex-col gap-3">
      <Button
        className="w-full bg-foreground text-background hover:bg-foreground/90"
        disabled={!isActive}
        onClick={() =>
          void navigate({ to: '/app/runs/$runId/solve', params: { runId: runIdStr } })
        }
      >
        Next puzzle
      </Button>
      {run.status === 'completed' && (
        <p className="text-center text-xs text-muted-foreground">Run complete</p>
      )}
      {run.status === 'aborted' && (
        <p className="text-center text-xs text-muted-foreground">Run aborted</p>
      )}
      <Button
        variant="outline"
        className="w-full"
        disabled={!isActive}
        onClick={() =>
          void navigate({
            to: '/app/runs/$runId/puzzles/$runPuzzleId',
            params: { runId: runIdStr, runPuzzleId: runPuzzleIdStr },
          })
        }
      >
        Retake
      </Button>
    </div>
  )

  const outerCls = 'flex flex-1 items-center justify-center overflow-hidden px-6'
  const innerCls = 'flex w-full items-start gap-6'
  const sidebarCls = 'hidden flex-1 flex-col md:flex'

  return (
    <div className={outerCls}>
      <div className={innerCls}>
        <aside className={sidebarCls} style={sidebarH}>
          <div className="mb-6">{breadcrumb}</div>
          {hasAttempts && (
            <div className="flex flex-col gap-4">
              <Badge
                variant="outline"
                className={`w-fit ${POSITION_STATUS_CLASS[puzzle.positionStatus]}`}
              >
                {POSITION_STATUS_LABEL[puzzle.positionStatus]}
              </Badge>
              {attemptHistory}
            </div>
          )}
        </aside>

        <div className="flex shrink-0 flex-col">
          <div className="mb-3 md:hidden">
            {breadcrumb}
            {hasAttempts && (
              <div className="mt-1">
                <Badge
                  variant="outline"
                  className={`text-xs ${POSITION_STATUS_CLASS[puzzle.positionStatus]}`}
                >
                  {POSITION_STATUS_LABEL[puzzle.positionStatus]}
                </Badge>
              </div>
            )}
          </div>

          {board}

          {!hasAttempts && (
            <div className="mt-4 md:hidden">
              <p className="text-sm text-muted-foreground">
                No attempt has been made for this puzzle in this run.
              </p>
              {isActive && (
                <Button
                  className="mt-3 bg-foreground text-background hover:bg-foreground/90"
                  onClick={() =>
                    void navigate({
                      to: '/app/runs/$runId/puzzles/$runPuzzleId',
                      params: { runId: runIdStr, runPuzzleId: runPuzzleIdStr },
                    })
                  }
                >
                  Solve
                </Button>
              )}
            </div>
          )}

          {hasAttempts && (
            <div className="mt-4 flex flex-col gap-6 md:hidden">
              {statsSection}
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full bg-foreground text-background hover:bg-foreground/90"
                  disabled={!isActive}
                  onClick={() =>
                    void navigate({ to: '/app/runs/$runId/solve', params: { runId: runIdStr } })
                  }
                >
                  Next puzzle
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!isActive}
                  onClick={() =>
                    void navigate({
                      to: '/app/runs/$runId/puzzles/$runPuzzleId',
                      params: { runId: runIdStr, runPuzzleId: runPuzzleIdStr },
                    })
                  }
                >
                  Retake
                </Button>
              </div>
            </div>
          )}
        </div>

        <aside className={sidebarCls} style={sidebarH}>
          {hasAttempts ? (
            <>
              {statsSection}
              {actionsSection}
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                No attempt has been made for this puzzle in this run.
              </p>
              {isActive && (
                <Button
                  className="w-fit bg-foreground text-background hover:bg-foreground/90"
                  onClick={() =>
                    void navigate({
                      to: '/app/runs/$runId/puzzles/$runPuzzleId',
                      params: { runId: runIdStr, runPuzzleId: runPuzzleIdStr },
                    })
                  }
                >
                  Solve
                </Button>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
