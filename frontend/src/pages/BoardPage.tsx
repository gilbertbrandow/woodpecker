import * as React from 'react'
import { Chess } from 'chess.js'
import { useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { Clock, CheckCircle2, XCircle, RotateCcw, ExternalLink, SkipForward } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip'
import { Button, buttonVariants } from '../components/ui/button'
import { cn } from '../lib/utils'
import { useBoardPageController } from '../features/board/useBoardPageController'
import { BoardPageShell } from '../features/board/BoardPageShell'
import { BoardBreadcrumbs } from '../features/board/BoardBreadcrumbs'
import { BoardCenterColumn } from '../features/board/BoardCenterColumn'
import { TimerCard } from '../features/board/TimerCard'
import { PuzzleMetaCard } from '../features/board/PuzzleMetaCard'
import { MoveStatusCard } from '../features/board/MoveStatusCard'
import { AttemptTypeCard } from '../features/board/AttemptTypeCard'
import { OverviewSidebarLeft } from '../features/board/OverviewSidebarLeft'
import { OverviewSidebarRight } from '../features/board/OverviewSidebarRight'
import { OverviewStatsSection } from '../features/board/OverviewStatsSection'
import { ProgressCard } from '../features/board/ProgressCard'
import { RunPaceCard } from '../features/board/RunPaceCard'
import { RunCompleteOverlay } from '../features/board/RunCompleteOverlay'
import { OverviewAttemptHistoryTable } from '../features/board/OverviewAttemptHistoryTable'
import type { OverviewAttemptHistoryRow } from '../features/board/OverviewAttemptHistoryTable'
import { buildPgnDisplay, formatTimer, formatTargetSolveTime } from '../features/board/boardPage.helpers'
import type { PlySelection } from '../features/board/boardPage.helpers'
import type { BoardState } from '../features/board/useBoardPageController'
import type { OverviewAttemptView } from '../lib/api'

type PlyPosition = { fen: string; lastMove: [string, string] }
type PlyPositions = { mainline: PlyPosition[]; variation: PlyPosition[] }

function computePlyPositions(
  startFen: string,
  mainline: { uci: string; moveStatus: 'correct' | 'wrong' | 'opponent' | null }[],
  variation: { uci: string }[] | null,
): PlyPositions {
  const chess = new Chess(startFen)
  const mainlineResult: PlyPosition[] = []
  let branchFen: string | null = null
  for (const move of mainline) {
    if (move.moveStatus === 'wrong' && branchFen === null) {
      branchFen = chess.fen()
    }
    const from = move.uci.slice(0, 2)
    const to = move.uci.slice(2, 4)
    const promotion = move.uci.length === 5 ? move.uci[4] : undefined
    chess.move({ from, to, promotion })
    mainlineResult.push({ fen: chess.fen(), lastMove: [from, to] })
  }
  const variationResult: PlyPosition[] = []
  if (variation !== null && branchFen !== null) {
    const varChess = new Chess(branchFen)
    for (const move of variation) {
      const from = move.uci.slice(0, 2)
      const to = move.uci.slice(2, 4)
      const promotion = move.uci.length === 5 ? move.uci[4] : undefined
      varChess.move({ from, to, promotion })
      variationResult.push({ fen: varChess.fen(), lastMove: [from, to] })
    }
  }
  return { mainline: mainlineResult, variation: variationResult }
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }
  return null
}

const ZERO_TIMER = formatTimer(0)

export function BoardPage(): React.ReactElement | null {
  const params = useParams({ strict: false })
  const search = useSearch({ strict: false })
  const location = useLocation({
    select: (loc) => loc.pathname,
  })
  const navigate = useNavigate()

  const runIdStr = typeof params.runId === 'string' ? params.runId : ''
  const runPuzzleIdStr = typeof params.runPuzzleId === 'string' ? params.runPuzzleId : ''
  const routeKind = typeof params.attemptId === 'string' ? 'attempt' : 'overview'
  const runId = parsePositiveInt(runIdStr) ?? Number.NaN
  const runPuzzleId = parsePositiveInt(runPuzzleIdStr) ?? Number.NaN
  const attemptId = routeKind === 'attempt' ? parsePositiveInt(params.attemptId) : null
  const requestedOverviewAttemptId = React.useMemo(() => {
    if (routeKind !== 'overview') return null
    return parsePositiveInt(search.attempt)
  }, [routeKind, search.attempt])

  const ctrl = useBoardPageController({
    runId,
    runPuzzleId,
    attemptId,
    runIdStr,
    runPuzzleIdStr,
    routeKind,
  })

  const [selectedAttemptId, setSelectedAttemptId] = React.useState<number | null>(null)
  const [showOverlay, setShowOverlay] = React.useState(false)

  const isOverviewPath = React.useMemo(
    () => /^\/app\/runs\/\d+\/puzzles\/\d+\/overview$/.test(location),
    [location],
  )

  const setOverviewAttemptInUrl = React.useCallback(
    (aId: number | null, replace: boolean): void => {
      if (!isOverviewPath) return
      void navigate({
        to: '/app/runs/$runId/puzzles/$runPuzzleId/overview',
        params: { runId: runIdStr, runPuzzleId: runPuzzleIdStr },
        search: aId === null ? {} : { attempt: aId },
        replace,
      })
    },
    [isOverviewPath, navigate, runIdStr, runPuzzleIdStr],
  )

  const allAttempts = React.useMemo((): OverviewAttemptView[] => {
    const data = ctrl.overview.data
    if (!data) return []
    const result: OverviewAttemptView[] = []
    for (const attempt of data.attempts) {
      if (attempt.status !== 'in_progress') result.push(attempt)
    }
    for (const samePuzzle of data.samePuzzleAcrossRuns) {
      for (const attempt of samePuzzle.attempts) {
        if (attempt.status !== 'in_progress') result.push(attempt)
      }
    }
    return result
  }, [ctrl.overview.data])

  React.useEffect(() => {
    const data = ctrl.overview.data
    if (!data) return
    const allIds = new Set(allAttempts.map((a) => a.id))
    const validRequested =
      requestedOverviewAttemptId !== null && allIds.has(requestedOverviewAttemptId)
        ? requestedOverviewAttemptId
        : null
    const nextId = validRequested ?? data.selectedAttemptId
    setSelectedAttemptId(nextId)
    if (nextId !== null && nextId !== requestedOverviewAttemptId) {
      setOverviewAttemptInUrl(nextId, true)
    }
  }, [ctrl.overview.data, allAttempts, requestedOverviewAttemptId, setOverviewAttemptInUrl])

  React.useEffect(() => {
    if (ctrl.overview.data !== null && ctrl.runJustCompleted) {
      setShowOverlay(true)
    }
  }, [ctrl.overview.data, ctrl.runJustCompleted])

  const handleSelectAttempt = React.useCallback(
    (aId: number): void => {
      if (aId === selectedAttemptId) return
      setSelectedAttemptId(aId)
      setOverviewAttemptInUrl(aId, false)
    },
    [selectedAttemptId, setOverviewAttemptInUrl],
  )

  const selectedAttempt = React.useMemo(
    () => allAttempts.find((a) => a.id === selectedAttemptId) ?? null,
    [allAttempts, selectedAttemptId],
  )

  const frozenTimerTenths = React.useMemo((): number => {
    if (selectedAttempt === null || selectedAttempt.timeSpentMs === null) return 0
    return Math.round(selectedAttempt.timeSpentMs / 100)
  }, [selectedAttempt])

  const overviewMetTargetTime = React.useMemo((): boolean | null => {
    const tenths = ctrl.overview.data?.timer.targetSolveTenths ?? null
    if (selectedAttempt === null || selectedAttempt.timeSpentMs === null) return null
    if (tenths === null || tenths <= 0) return null
    return Math.round(selectedAttempt.timeSpentMs / 100) <= tenths
  }, [selectedAttempt, ctrl.overview.data])

  const historyRows = React.useMemo((): OverviewAttemptHistoryRow[] => {
    return allAttempts.map((attempt) => ({
      attemptId: attempt.id,
      runId: attempt.runId,
      runLabel: `Run ${attempt.runIndex + 1}`,
      runOrder: attempt.runIndex,
      runPuzzleId: attempt.runPuzzleId,
      tryNumber: attempt.tryNumber,
      countsTowardsTraining: attempt.countsTowardsTraining,
      result: attempt.status as 'solved' | 'failed',
      timeSpentMs: attempt.timeSpentMs,
    }))
  }, [allAttempts])

  const handleSelectAttemptForTable = React.useCallback(
    (aId: number): void => {
      const row = historyRows.find((r) => r.attemptId === aId)
      if (!row) return
      if (row.runId === Number(runIdStr)) {
        handleSelectAttempt(aId)
      } else {
        void navigate({
          to: '/app/runs/$runId/puzzles/$runPuzzleId/overview',
          params: { runId: String(row.runId), runPuzzleId: String(row.runPuzzleId) },
          search: { attempt: aId },
        })
      }
    },
    [historyRows, runIdStr, handleSelectAttempt, navigate],
  )

  const [selectedPly, setSelectedPly] = React.useState<PlySelection | null>(null)

  React.useEffect(() => {
    setSelectedPly(null)
  }, [ctrl.board.boardKey])

  const focusPgnDisplay = React.useMemo(() => {
    if (ctrl.mode !== 'focus' && ctrl.mode !== 'failed') return null
    if (ctrl.solvingView === null) return null
    const moves =
      ctrl.mode === 'focus' && ctrl.session.liveFocusStatus === 'in_progress'
        ? ctrl.session.allPliesPlayed
        : ctrl.session.movesPlayed
    return buildPgnDisplay(
      ctrl.solvingView.puzzle.fen,
      moves,
      ctrl.solvingView.puzzle.solution.join(' '),
      ctrl.mode === 'failed' ? 'failed' : ctrl.session.liveFocusStatus,
      ctrl.mode === 'failed' ? ctrl.session.failedRetryPlies : undefined,
      false,
    )
  }, [ctrl.mode, ctrl.solvingView, ctrl.session])

  const overviewPgnDisplay = ctrl.mode === 'overview' ? (selectedAttempt?.pgnDisplay ?? null) : null
  const pgnDisplay = ctrl.mode === 'overview' ? overviewPgnDisplay : focusPgnDisplay

  const plyPositions = React.useMemo((): PlyPositions | null => {
    if (overviewPgnDisplay === null || ctrl.overview.data === null) return null
    return computePlyPositions(
      ctrl.overview.data.puzzle.fen,
      overviewPgnDisplay.mainline,
      overviewPgnDisplay.variation,
    )
  }, [overviewPgnDisplay, ctrl.overview.data])

  React.useEffect(() => {
    if (ctrl.mode !== 'overview') return
    if (overviewPgnDisplay === null || overviewPgnDisplay.mainline.length === 0) {
      setSelectedPly(null)
      return
    }
    const lastMove = overviewPgnDisplay.mainline[overviewPgnDisplay.mainline.length - 1]
    if (lastMove.moveStatus === 'wrong') {
      if (overviewPgnDisplay.variation && overviewPgnDisplay.variation.length > 0) {
        setSelectedPly({ line: 'variation', index: overviewPgnDisplay.variation.length - 1 })
      } else {
        setSelectedPly(null)
      }
      return
    }
    setSelectedPly({ line: 'main', index: overviewPgnDisplay.mainline.length - 1 })
  }, [overviewPgnDisplay, ctrl.mode])

  const displayBoard = React.useMemo((): BoardState => {
    if (ctrl.mode === 'overview') {
      const base: BoardState = { ...ctrl.board, dests: new Map() }
      if (selectedPly !== null && plyPositions !== null) {
        const plyList =
          selectedPly.line === 'main' ? plyPositions.mainline : plyPositions.variation
        const pos = plyList[selectedPly.index]
        if (pos) {
          const moveStatus =
            selectedPly.line === 'main'
              ? (overviewPgnDisplay?.mainline[selectedPly.index]?.moveStatus ?? null)
              : (overviewPgnDisplay?.variation?.[selectedPly.index]?.moveStatus ?? null)
          const feedbackResult: 'correct' | 'wrong' | null =
            moveStatus === 'correct' ? 'correct' : moveStatus === 'wrong' ? 'wrong' : null
          return {
            ...base,
            fen: pos.fen,
            lastMove: pos.lastMove,
            moveFeedback: {
              result: feedbackResult,
              square: feedbackResult !== null ? pos.lastMove[1] : null,
              visible: feedbackResult !== null,
            },
          }
        }
      }
      if (selectedAttempt?.board !== null && selectedAttempt?.board !== undefined) {
        return {
          ...base,
          fen: selectedAttempt.board.terminalFen ?? ctrl.board.fen,
          lastMove: selectedAttempt.board.lastMove ?? undefined,
          moveFeedback: {
            result: selectedAttempt.board.result,
            square:
              selectedAttempt.board.result !== null
                ? (selectedAttempt.board.lastMove?.[1] ?? null)
                : null,
            visible: selectedAttempt.board.result !== null,
          },
        }
      }
      return base
    }

    if (selectedPly === null || focusPgnDisplay === null) return ctrl.board
    const isAtHeadPly =
      selectedPly.line === 'main' && selectedPly.index === focusPgnDisplay.mainline.length - 1
    if (isAtHeadPly) return ctrl.board
    const plyList =
      selectedPly.line === 'main' ? focusPgnDisplay.mainline : (focusPgnDisplay.variation ?? [])
    const ply = plyList[selectedPly.index]
    if (!ply) return ctrl.board
    const feedbackResult: 'correct' | 'wrong' | null =
      ply.moveStatus === 'correct' ? 'correct' : ply.moveStatus === 'wrong' ? 'wrong' : null
    return {
      ...ctrl.board,
      fen: ply.fen,
      lastMove: [ply.from, ply.to],
      dests: new Map(),
      moveFeedback: {
        result: feedbackResult,
        square: feedbackResult !== null ? ply.to : null,
        visible: feedbackResult !== null,
      },
    }
  }, [
    ctrl.board,
    ctrl.mode,
    ctrl.overview.data,
    selectedPly,
    focusPgnDisplay,
    plyPositions,
    selectedAttempt,
    overviewPgnDisplay,
  ])

  const isAtHead =
    selectedPly === null ||
    (focusPgnDisplay !== null &&
      selectedPly.line === 'main' &&
      selectedPly.index === focusPgnDisplay.mainline.length - 1)

  const lastOverviewTimerTextRef = React.useRef(ZERO_TIMER)
  const lastOverviewMetTargetTimeRef = React.useRef<boolean | null>(null)
  const lastSelectedAttemptRef = React.useRef<OverviewAttemptView | null>(null)

  if ((!ctrl.overview.data && !ctrl.solvingView) || ctrl.mode === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  const overviewData = ctrl.overview.data

  const currentOverviewTimerText = formatTimer(frozenTimerTenths)
  if (currentOverviewTimerText !== ZERO_TIMER) lastOverviewTimerTextRef.current = currentOverviewTimerText
  const displayedOverviewTimerText =
    currentOverviewTimerText !== ZERO_TIMER
      ? currentOverviewTimerText
      : lastOverviewTimerTextRef.current
  if (overviewMetTargetTime !== null) lastOverviewMetTargetTimeRef.current = overviewMetTargetTime
  const displayedOverviewMetTargetTime = overviewMetTargetTime ?? lastOverviewMetTargetTimeRef.current
  if (selectedAttempt !== null) lastSelectedAttemptRef.current = selectedAttempt
  const displayedAttempt = selectedAttempt ?? lastSelectedAttemptRef.current

  const failedMetTargetTime =
    ctrl.mode === 'failed' &&
    ctrl.timer.targetSolveTenths !== null &&
    ctrl.timer.targetSolveTenths > 0
      ? ctrl.timer.elapsedTenths <= ctrl.timer.targetSolveTenths
      : null

  const timerText =
    ctrl.mode === 'overview' ? displayedOverviewTimerText : formatTimer(ctrl.timer.elapsedTenths)
  const timerElapsedTenths = ctrl.mode === 'overview' ? frozenTimerTenths : ctrl.timer.elapsedTenths
  const timerTargetSolveTenths = ctrl.mode === 'focus' ? ctrl.timer.targetSolveTenths : null

  const isSolvedAttempt = displayedAttempt?.status === 'solved'

  const timerRightSlot =
    ctrl.mode === 'focus' ? undefined : ctrl.mode === 'failed' ? (
      <>
        {failedMetTargetTime !== null && (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <span
                className={`inline-flex cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                  failedMetTargetTime
                    ? 'border-green-600/20 bg-green-500/15 text-green-700 dark:text-green-400'
                    : 'border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                }`}
              >
                <Clock className="h-3 w-3" />
                Time
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {failedMetTargetTime ? 'Completed within target time' : 'Target time missed'}
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-default items-center gap-1 rounded-full border border-red-600/20 bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
              <XCircle className="h-3 w-3" />
              Failed
            </span>
          </TooltipTrigger>
          <TooltipContent>Not solved</TooltipContent>
        </Tooltip>
      </>
    ) : (
      <>
        {displayedOverviewMetTargetTime !== null && (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <span
                className={`inline-flex cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                  displayedOverviewMetTargetTime
                    ? 'border-green-600/20 bg-green-500/15 text-green-700 dark:text-green-400'
                    : 'border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                }`}
              >
                <Clock className="h-3 w-3" />
                Time
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {displayedOverviewMetTargetTime
                ? 'Completed within target time'
                : 'Target time missed'}
            </TooltipContent>
          </Tooltip>
        )}
        {displayedAttempt !== null && (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <span
                className={`inline-flex cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                  isSolvedAttempt
                    ? 'border-green-600/20 bg-green-500/15 text-green-700 dark:text-green-400'
                    : 'border-red-600/20 bg-red-500/15 text-red-700 dark:text-red-400'
                }`}
              >
                {isSolvedAttempt ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {isSolvedAttempt ? 'Solved' : 'Failed'}
              </span>
            </TooltipTrigger>
            <TooltipContent>{isSolvedAttempt ? 'Correctly solved' : 'Not solved'}</TooltipContent>
          </Tooltip>
        )}
      </>
    )

  const puzzleId =
    ctrl.mode === 'overview' && overviewData !== null
      ? overviewData.puzzle.puzzleId
      : (ctrl.solvingView?.puzzle.puzzleId ?? '')
  const rating =
    ctrl.mode === 'overview' && overviewData !== null
      ? overviewData.puzzle.rating
      : (ctrl.solvingView?.puzzle.rating ?? 0)
  const themes =
    ctrl.mode === 'overview' && overviewData !== null
      ? overviewData.puzzle.themes
      : (ctrl.solvingView?.puzzle.themes ?? [])

  const timerBar =
    ctrl.mode === 'focus' && ctrl.session.allPliesPlayed.length > 0
      ? (() => {
          const { elapsedTenths, targetSolveTenths } = ctrl.timer
          if (
            targetSolveTenths === null ||
            targetSolveTenths <= 0 ||
            elapsedTenths >= targetSolveTenths
          )
            return null
          const leftPct = Math.max(
            0,
            Math.min(100, ((targetSolveTenths - elapsedTenths) / targetSolveTenths) * 100),
          )
          const hue =
            leftPct >= 60
              ? 60 + ((leftPct - 60) / 40) * 60
              : leftPct >= 20
                ? ((leftPct - 20) / 40) * 60
                : 0
          const targetText = formatTargetSolveTime(targetSolveTenths)
          return {
            leftPct,
            color: `hsl(${hue} 55% 48%)`,
            tooltipText: `Target solve time: ${targetText}. This bar shows how much of that time is remaining.`,
          }
        })()
      : null

  const overlayData = overviewData?.runCompleteOverlay ?? null
  const overlayNode =
    ctrl.mode === 'overview' && showOverlay && overlayData !== null ? (
      <RunCompleteOverlay
        overlayData={overlayData}
        onStartNextRun={ctrl.actions.startNextRun}
        isLoading={ctrl.isStartingNextRun}
        onClose={() => {
          setShowOverlay(false)
          ctrl.actions.dismissRunComplete()
        }}
      />
    ) : undefined

  const mobileHeader =
    ctrl.mode === 'overview' && overviewData !== null ? (
      <BoardBreadcrumbs
        runIndex={overviewData.runPuzzle.runIndex}
        position={overviewData.runPuzzle.position}
        participationId={overviewData.runPuzzle.participationId}
        scheduleName={overviewData.runPuzzle.scheduleName}
        runIdStr={runIdStr}
      />
    ) : ctrl.solvingView !== null ? (
      <BoardBreadcrumbs
        runIndex={ctrl.solvingView.runPuzzle.runIndex}
        position={ctrl.solvingView.runPuzzle.position}
        participationId={ctrl.solvingView.runPuzzle.participationId}
        scheduleName={ctrl.solvingView.runPuzzle.scheduleName}
        runIdStr={runIdStr}
        linksDisabled={ctrl.mode === 'focus'}
      />
    ) : null

  const centerMobileHeader =
    ctrl.solvingView !== null ? (
      <AttemptTypeCard
        isPractice={ctrl.solvingView.attempt.attemptType === 'practice'}
        currentTryNumber={ctrl.solvingView.runPuzzle.currentTryNumber}
        maxTriesPerPuzzle={ctrl.solvingView.runPuzzle.maxTriesPerPuzzle}
        compact={true}
      />
    ) : overviewData !== null ? (
      <AttemptTypeCard
        isPractice={false}
        currentTryNumber={
          overviewData.runPuzzle.maxTriesPerPuzzle - overviewData.runPuzzle.triesRemaining + 1
        }
        maxTriesPerPuzzle={overviewData.runPuzzle.maxTriesPerPuzzle}
        compact={true}
      />
    ) : null

  const mobileExtras =
    ctrl.mode === 'focus' ? (
      <div className="mt-3 flex items-center justify-between">
        <span className="tabular-nums text-sm font-medium">{timerText}</span>
        <MoveStatusCard
          lastMoveResult={displayBoard.moveFeedback.result}
          turnToMove={ctrl.board.turnToMove}
          kingPieceUrl={ctrl.board.kingPieceUrl}
          compact={true}
        />
      </div>
    ) : ctrl.mode === 'failed' ? (
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-sm font-medium">{timerText}</span>
          {failedMetTargetTime !== null && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                failedMetTargetTime
                  ? 'border-green-600/20 bg-green-500/15 text-green-700 dark:text-green-400'
                  : 'border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
              }`}
            >
              <Clock className="h-3 w-3" />
              {failedMetTargetTime ? 'Time met' : 'Time missed'}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-red-600/20 bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={ctrl.actions.handleShowHint}
            disabled={ctrl.inputBlocked}
          >
            Hint
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={ctrl.actions.handleShowSolution}
            disabled={ctrl.inputBlocked}
          >
            Solution
          </Button>
        </div>
      </div>
    ) : overviewData !== null ? (
      <div className="mt-3 flex flex-col gap-2 pb-3">
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-sm font-medium">{displayedOverviewTimerText}</span>
          {displayedOverviewMetTargetTime !== null && (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <span
                  className={`inline-flex cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                    displayedOverviewMetTargetTime
                      ? 'border-green-600/20 bg-green-500/15 text-green-700 dark:text-green-400'
                      : 'border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  Time
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {displayedOverviewMetTargetTime
                  ? 'Completed within target time'
                  : 'Target time missed'}
              </TooltipContent>
            </Tooltip>
          )}
          {displayedAttempt !== null && (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <span
                  className={`inline-flex cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                    isSolvedAttempt
                      ? 'border-green-600/20 bg-green-500/15 text-green-700 dark:text-green-400'
                      : 'border-red-600/20 bg-red-500/15 text-red-700 dark:text-red-400'
                  }`}
                >
                  {isSolvedAttempt ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {isSolvedAttempt ? 'Solved' : 'Failed'}
                </span>
              </TooltipTrigger>
              <TooltipContent>{isSolvedAttempt ? 'Correctly solved' : 'Not solved'}</TooltipContent>
            </Tooltip>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={ctrl.isLoadingNextPuzzle}
                  onClick={() => void ctrl.actions.handleRetake()}
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="sr-only">Retake</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retake</TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <a
                  href={overviewData.actions.analyze.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-8 w-8')}
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="sr-only">Analyze</span>
                </a>
              </TooltipTrigger>
              <TooltipContent>Analyze</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <span className="w-full">
              <Button
                className="w-full bg-foreground text-background hover:bg-foreground/90"
                disabled={
                  overviewData.actions.nextPuzzle.disabledReason !== null ||
                  ctrl.isLoadingNextPuzzle
                }
                onClick={() => void ctrl.actions.handleNextPuzzle()}
              >
                <SkipForward className="mr-2 h-4 w-4" />
                Next puzzle
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {overviewData.actions.nextPuzzle.disabledReason !== null
              ? overviewData.actions.nextPuzzle.disabledReason
              : null}
          </TooltipContent>
        </Tooltip>
      </div>
    ) : null

  const mobileDrawerContent =
    ctrl.mode === 'overview' && overviewData !== null ? (
      <div className="flex flex-col gap-5">
        <OverviewStatsSection
          runIndex={overviewData.stats.runIndex}
          accuracy={overviewData.stats.accuracy}
          averageSolveTime={overviewData.stats.averageSolveTime}
        />
        {overviewData.runPace.chartData !== null && (
          <RunPaceCard
            chartData={overviewData.runPace.chartData}
            isRunActive={overviewData.runPace.isRunActive}
          />
        )}
        <ProgressCard
          runProgress={overviewData.progress.runProgress}
          trainingProgress={overviewData.progress.trainingProgress}
        />
        <OverviewAttemptHistoryTable
          rows={historyRows}
          selectedAttemptId={selectedAttemptId}
          onSelectAttempt={handleSelectAttemptForTable}
        />
        {overviewPgnDisplay !== null && (
          <PuzzleMetaCard
            puzzleId={overviewData.puzzle.puzzleId}
            rating={overviewData.puzzle.rating}
            themes={overviewData.puzzle.themes}
            pgnDisplay={overviewPgnDisplay}
            selectedPly={ctrl.mode === 'overview' ? selectedPly : null}
            onPlyClick={ctrl.mode === 'overview' ? setSelectedPly : undefined}
          />
        )}
      </div>
    ) : undefined

  const leftNode =
    ctrl.mode === 'overview' && overviewData !== null ? (
      <OverviewSidebarLeft
        runIndex={overviewData.stats.runIndex}
        paceChart={overviewData.runPace.chartData}
        isRunActive={overviewData.runPace.isRunActive}
        accuracy={overviewData.stats.accuracy}
        averageSolveTime={overviewData.stats.averageSolveTime}
        runProgress={overviewData.progress.runProgress}
        trainingProgress={overviewData.progress.trainingProgress}
        breadcrumbs={
          <BoardBreadcrumbs
            runIndex={overviewData.runPuzzle.runIndex}
            position={overviewData.runPuzzle.position}
            participationId={overviewData.runPuzzle.participationId}
            scheduleName={overviewData.runPuzzle.scheduleName}
            runIdStr={runIdStr}
          />
        }
      />
    ) : ctrl.solvingView !== null ? (
      <>
        <BoardBreadcrumbs
          runIndex={ctrl.solvingView.runPuzzle.runIndex}
          position={ctrl.solvingView.runPuzzle.position}
          participationId={ctrl.solvingView.runPuzzle.participationId}
          scheduleName={ctrl.solvingView.runPuzzle.scheduleName}
          runIdStr={runIdStr}
          linksDisabled={ctrl.mode === 'focus'}
        />
        <AttemptTypeCard
          isPractice={ctrl.solvingView.attempt.attemptType === 'practice'}
          currentTryNumber={ctrl.solvingView.runPuzzle.currentTryNumber}
          maxTriesPerPuzzle={ctrl.solvingView.runPuzzle.maxTriesPerPuzzle}
        />
      </>
    ) : null

  const rightNode = (
    <>
      <TimerCard
        timerText={timerText}
        elapsedTenths={timerElapsedTenths}
        targetSolveTenths={timerTargetSolveTenths}
        rightSlot={timerRightSlot}
      />
      <PuzzleMetaCard
        puzzleId={puzzleId}
        rating={rating}
        themes={themes}
        pgnDisplay={pgnDisplay}
        focusMode={ctrl.mode !== 'overview'}
        selectedPly={ctrl.mode === 'overview' ? selectedPly : null}
        onPlyClick={ctrl.mode === 'overview' ? setSelectedPly : undefined}
      />
      {ctrl.mode === 'focus' && (
        <div className="mt-auto">
          <MoveStatusCard
            lastMoveResult={displayBoard.moveFeedback.result}
            turnToMove={ctrl.board.turnToMove}
            kingPieceUrl={ctrl.board.kingPieceUrl}
          />
        </div>
      )}
      {ctrl.mode === 'failed' && ctrl.solvingView !== null && (
        <div className="mt-auto flex flex-col gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={ctrl.actions.handleShowHint}
            disabled={ctrl.inputBlocked || !isAtHead}
          >
            Show Hint
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={ctrl.actions.handleShowSolution}
            disabled={ctrl.inputBlocked || !isAtHead}
          >
            Show Solution
          </Button>
          <MoveStatusCard
            lastMoveResult={displayBoard.moveFeedback.result}
            turnToMove={ctrl.board.turnToMove}
            kingPieceUrl={ctrl.board.kingPieceUrl}
          />
        </div>
      )}
      {ctrl.mode === 'overview' && overviewData !== null && (
        <OverviewSidebarRight
          historyRows={historyRows}
          selectedAttemptId={selectedAttemptId}
          onSelectAttempt={handleSelectAttemptForTable}
          isLoadingNextPuzzle={ctrl.isLoadingNextPuzzle}
          onNextPuzzle={() => void ctrl.actions.handleNextPuzzle()}
          onRetake={() => void ctrl.actions.handleRetake()}
          nextPuzzleDisabledReason={overviewData.actions.nextPuzzle.disabledReason}
          analyzeUrl={overviewData.actions.analyze.url}
        />
      )}
    </>
  )

  const centerNode = (
    <BoardCenterColumn
      board={displayBoard}
      actions={ctrl.actions}
      attemptHistory={ctrl.session.attemptHistory}
      runId={runIdStr}
      activeAttemptId={ctrl.mode === 'overview' ? selectedAttemptId : undefined}
      stripInteractive={ctrl.mode === 'overview'}
      boardAnimationEnabled={ctrl.mode !== 'overview'}
      mobileHeader={centerMobileHeader}
      timerBar={timerBar}
      overlay={overlayNode}
    />
  )

  return (
    <BoardPageShell
      boardSize={ctrl.board.boardSize}
      left={leftNode}
      center={centerNode}
      right={rightNode}
      mobileHeader={mobileHeader}
      mobileExtras={mobileExtras}
      mobileDrawerContent={mobileDrawerContent}
    />
  )
}
