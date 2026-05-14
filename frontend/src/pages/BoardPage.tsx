import * as React from 'react'
import { useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useAuth } from '../context/auth'
import { Clock, CheckCircle2, XCircle, RotateCcw, ExternalLink, SkipForward } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip'
import { Button, buttonVariants } from '../components/ui/button'
import { cn } from '../lib/utils'
import { useBoardPageController } from '../features/board/useBoardPageController'
import { BoardPageShell } from '../features/board/BoardPageShell'
import { BoardBreadcrumbs } from '../features/board/BoardBreadcrumbs'
import { BoardCenterColumn } from '../features/board/BoardCenterColumn'
import { TimerCard } from '../features/board/TimerCard'
import { TrainingItemMetaCard } from '../features/board/TrainingItemMetaCard'
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

export function BoardPage(): React.ReactElement | null {
  const { user } = useAuth()
  const showTenths = user?.showTimerTenths ?? true
  const ZERO_TIMER = formatTimer(0, showTenths)

  const params = useParams({ strict: false })
  const search = useSearch({ strict: false })
  const location = useLocation({
    select: (loc) => loc.pathname,
  })
  const navigate = useNavigate()

  const runIdStr = typeof params.runId === 'string' ? params.runId : ''
  const runTrainingItemIdStr = typeof params.runTrainingItemId === 'string' ? params.runTrainingItemId : ''
  const routeKind = typeof params.attemptId === 'string' ? 'attempt' : 'overview'
  const runId = parsePositiveInt(runIdStr) ?? Number.NaN
  const runTrainingItemId = parsePositiveInt(runTrainingItemIdStr) ?? Number.NaN
  const attemptId = routeKind === 'attempt' ? parsePositiveInt(params.attemptId) : null
  const requestedOverviewAttemptId = React.useMemo(() => {
    if (routeKind !== 'overview') return null
    return parsePositiveInt(search.attempt)
  }, [routeKind, search.attempt])

  const ctrl = useBoardPageController({
    runId,
    runTrainingItemId,
    attemptId,
    runIdStr,
    runTrainingItemIdStr,
    routeKind,
  })

  const [selectedAttemptId, setSelectedAttemptId] = React.useState<number | null>(null)
  const [showOverlay, setShowOverlay] = React.useState(false)

  const isOverviewPath = React.useMemo(
    () => /^\/app\/runs\/\d+\/training-items\/\d+\/overview$/.test(location),
    [location],
  )

  const setOverviewAttemptInUrl = React.useCallback(
    (aId: number | null, replace: boolean): void => {
      if (!isOverviewPath) return
      void navigate({
        to: '/app/runs/$runId/training-items/$runTrainingItemId/overview',
        params: { runId: runIdStr, runTrainingItemId: runTrainingItemIdStr },
        search: aId === null ? {} : { attempt: aId },
        replace,
      })
    },
    [isOverviewPath, navigate, runIdStr, runTrainingItemIdStr],
  )

  const allAttempts = React.useMemo((): OverviewAttemptView[] => {
    const data = ctrl.overview.data
    if (!data) return []
    const result: OverviewAttemptView[] = []
    for (const attempt of data.attempts) {
      if (attempt.status !== 'in_progress') result.push(attempt)
    }
    for (const samePuzzle of data.sameTrainingItemAcrossRuns) {
      for (const attempt of samePuzzle.attempts) {
        if (attempt.status !== 'in_progress') result.push(attempt)
      }
    }
    return result
  }, [ctrl.overview.data])

  const currentPuzzleAttempts = React.useMemo(
    () => ctrl.session.attemptHistory.filter((item) => item.runTrainingItemId === runTrainingItemId),
    [ctrl.session.attemptHistory, runTrainingItemId],
  )

  React.useEffect(() => {
    const data = ctrl.overview.data
    if (!data) return
    if (data.runTrainingItem.id !== Number(runTrainingItemIdStr)) return
    const allIds = new Set(allAttempts.map((a) => a.id))
    const validRequested =
      requestedOverviewAttemptId !== null && allIds.has(requestedOverviewAttemptId)
        ? requestedOverviewAttemptId
        : null
    const nextId = validRequested ?? data.selectedAttemptId
    setSelectedAttemptId(nextId)
    if (validRequested !== null && nextId !== null && nextId !== requestedOverviewAttemptId) {
      setOverviewAttemptInUrl(nextId, true)
    }
  }, [ctrl.overview.data, allAttempts, requestedOverviewAttemptId, setOverviewAttemptInUrl, runTrainingItemIdStr])

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
      runTrainingItemId: attempt.runTrainingItemId,
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
          to: '/app/runs/$runId/training-items/$runTrainingItemId/overview',
          params: { runId: String(row.runId), runTrainingItemId: String(row.runTrainingItemId) },
          search: { attempt: aId },
        })
      }
    },
    [historyRows, runIdStr, handleSelectAttempt, navigate],
  )

  const [selectedPly, setSelectedPly] = React.useState<PlySelection | null>(null)

  const lastOverviewTimerTextRef = React.useRef(ZERO_TIMER)
  const lastOverviewMetTargetTimeRef = React.useRef<boolean | null>(null)
  const lastSelectedAttemptRef = React.useRef<OverviewAttemptView | null>(null)

  React.useEffect(() => {
    setSelectedPly(null)
  }, [ctrl.board.boardKey])

  React.useEffect(() => {
    setSelectedAttemptId(null)
  }, [runTrainingItemId])

  React.useEffect(() => {
    lastOverviewTimerTextRef.current = ZERO_TIMER
    lastOverviewMetTargetTimeRef.current = null
    lastSelectedAttemptRef.current = null
  }, [runTrainingItemId, ZERO_TIMER])

  const focusPgnDisplay = React.useMemo(() => {
    if (ctrl.mode !== 'focus' && ctrl.mode !== 'failed') return null
    if (ctrl.solvingView === null) return null
    const moves =
      ctrl.mode === 'focus' && ctrl.session.liveFocusStatus === 'in_progress'
        ? ctrl.session.allPliesPlayed
        : ctrl.session.movesPlayed
    return buildPgnDisplay(
      ctrl.solvingView.trainingItem.fen,
      moves,
      ctrl.solvingView.trainingItem.solution.join(' '),
      ctrl.mode === 'failed' ? 'failed' : ctrl.session.liveFocusStatus,
      ctrl.mode === 'failed' ? ctrl.session.failedRetryPlies : undefined,
      false,
    )
  }, [ctrl.mode, ctrl.solvingView, ctrl.session])

  const overviewPgnDisplay = ctrl.mode === 'overview' ? (selectedAttempt?.pgnDisplay ?? null) : null
  const pgnDisplay = ctrl.mode === 'overview' ? overviewPgnDisplay : focusPgnDisplay

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
      if (selectedPly !== null && overviewPgnDisplay !== null) {
        const plyList =
          selectedPly.line === 'main'
            ? overviewPgnDisplay.mainline
            : (overviewPgnDisplay.variation ?? [])
        const ply = plyList[selectedPly.index]
        if (ply) {
          const feedbackResult: 'correct' | 'wrong' | null =
            ply.moveStatus === 'correct' ? 'correct' : ply.moveStatus === 'wrong' ? 'wrong' : null
          return {
            ...base,
            fen: ply.fen,
            lastMove: [ply.from, ply.to],
            moveFeedback: {
              result: feedbackResult,
              square: feedbackResult !== null ? ply.to : null,
              visible: feedbackResult !== null,
            },
          }
        }
      }
      if (
        selectedAttempt?.board !== null &&
        selectedAttempt?.board !== undefined &&
        selectedAttempt.status !== 'failed'
      ) {
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
    selectedPly,
    focusPgnDisplay,
    selectedAttempt,
    overviewPgnDisplay,
  ])

  const isAtHead =
    selectedPly === null ||
    (focusPgnDisplay !== null &&
      selectedPly.line === 'main' &&
      selectedPly.index === focusPgnDisplay.mainline.length - 1)

  if ((!ctrl.overview.data && !ctrl.solvingView) || ctrl.mode === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  const overviewData = ctrl.overview.data

  const currentOverviewTimerText = formatTimer(frozenTimerTenths, showTenths)
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
    ctrl.mode === 'overview' ? displayedOverviewTimerText : formatTimer(ctrl.timer.elapsedTenths, showTenths)
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

  const displayId =
    ctrl.mode === 'overview' && overviewData !== null
      ? overviewData.trainingItem.displayId
      : (ctrl.solvingView?.trainingItem.displayId ?? '')
  const rating =
    ctrl.mode === 'overview' && overviewData !== null
      ? overviewData.trainingItem.rating
      : (ctrl.solvingView?.trainingItem.rating ?? 0)
  const themes =
    ctrl.mode === 'overview' && overviewData !== null
      ? overviewData.trainingItem.themes
      : (ctrl.solvingView?.trainingItem.themes ?? [])

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
        onClose={() => {
          setShowOverlay(false)
          ctrl.actions.dismissRunComplete()
        }}
      />
    ) : undefined

  const mobileHeader =
    ctrl.mode === 'overview' && overviewData !== null ? (
      <BoardBreadcrumbs
        runIndex={overviewData.runTrainingItem.runIndex}
        position={overviewData.runTrainingItem.position}
        trainingId={overviewData.runTrainingItem.trainingId}
        scheduleName={overviewData.runTrainingItem.scheduleName}
        runIdStr={runIdStr}
      />
    ) : ctrl.solvingView !== null ? (
      <BoardBreadcrumbs
        runIndex={ctrl.solvingView.runTrainingItem.runIndex}
        position={ctrl.solvingView.runTrainingItem.position}
        trainingId={ctrl.solvingView.runTrainingItem.trainingId}
        scheduleName={ctrl.solvingView.runTrainingItem.scheduleName}
        runIdStr={runIdStr}
        linksDisabled={ctrl.mode === 'focus'}
      />
    ) : null

  const centerMobileHeader =
    ctrl.solvingView !== null ? (
      <AttemptTypeCard
        isPractice={ctrl.solvingView.attempt.attemptType === 'practice'}
        currentTryNumber={ctrl.solvingView.runTrainingItem.currentTryNumber}
        maxTriesPerPuzzle={ctrl.solvingView.runTrainingItem.maxTriesPerItem}
        compact={true}
      />
    ) : overviewData !== null ? (
      <AttemptTypeCard
        isPractice={false}
        currentTryNumber={
          overviewData.runTrainingItem.maxTriesPerItem - overviewData.runTrainingItem.triesRemaining + 1
        }
        maxTriesPerPuzzle={overviewData.runTrainingItem.maxTriesPerItem}
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
                  overviewData.actions.nextTrainingItem.disabledReason !== null ||
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
            {overviewData.actions.nextTrainingItem.disabledReason !== null
              ? overviewData.actions.nextTrainingItem.disabledReason
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
          key={runTrainingItemId}
          rows={historyRows}
          selectedAttemptId={selectedAttemptId}
          onSelectAttempt={handleSelectAttemptForTable}
        />
        {overviewPgnDisplay !== null && (
          <TrainingItemMetaCard
            displayId={overviewData.trainingItem.displayId}
            rating={overviewData.trainingItem.rating}
            themes={overviewData.trainingItem.themes}
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
            runIndex={overviewData.runTrainingItem.runIndex}
            position={overviewData.runTrainingItem.position}
            trainingId={overviewData.runTrainingItem.trainingId}
            scheduleName={overviewData.runTrainingItem.scheduleName}
            runIdStr={runIdStr}
          />
        }
      />
    ) : ctrl.solvingView !== null ? (
      <>
        <BoardBreadcrumbs
          runIndex={ctrl.solvingView.runTrainingItem.runIndex}
          position={ctrl.solvingView.runTrainingItem.position}
          trainingId={ctrl.solvingView.runTrainingItem.trainingId}
          scheduleName={ctrl.solvingView.runTrainingItem.scheduleName}
          runIdStr={runIdStr}
          linksDisabled={ctrl.mode === 'focus'}
        />
        <AttemptTypeCard
          isPractice={ctrl.solvingView.attempt.attemptType === 'practice'}
          currentTryNumber={ctrl.solvingView.runTrainingItem.currentTryNumber}
          maxTriesPerPuzzle={ctrl.solvingView.runTrainingItem.maxTriesPerItem}
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
      <TrainingItemMetaCard
        displayId={displayId}
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
          key={runTrainingItemId}
          historyRows={historyRows}
          selectedAttemptId={selectedAttemptId}
          onSelectAttempt={handleSelectAttemptForTable}
          isLoadingNextPuzzle={ctrl.isLoadingNextPuzzle}
          onNextPuzzle={() => void ctrl.actions.handleNextPuzzle()}
          onRetake={() => void ctrl.actions.handleRetake()}
          nextPuzzleDisabledReason={overviewData.actions.nextTrainingItem.disabledReason}
          analyzeUrl={overviewData.actions.analyze.url}
        />
      )}
    </>
  )

  const centerNode = (
    <BoardCenterColumn
      board={displayBoard}
      actions={ctrl.actions}
      attemptHistory={currentPuzzleAttempts}
      stripMaxVisible={8}
      runId={runIdStr}
      activeAttemptId={ctrl.mode === 'overview' ? selectedAttemptId : undefined}
      stripInteractive={ctrl.mode === 'overview'}
      pulseActive={ctrl.mode === 'focus' || ctrl.mode === 'failed'}
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
