import * as React from 'react'
import { useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useAuth } from '../context/auth'
import { Clock, CheckCircle2, XCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip'
import { Button } from '../components/ui/button'
import { UserAvatar } from '../components/UserAvatar'
import { useBoardPageController } from '../features/board/useBoardPageController'
import { BoardPageShell } from '../features/board/BoardPageShell'
import { BoardCenterColumn } from '../features/board/BoardCenterColumn'
import { TimerCard } from '../features/board/TimerCard'
import { TrainingItemMetaCard, MobileOverviewMetaBar } from '../features/board/TrainingItemMetaCard'
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
import { MobileActionsBar } from '../features/board/MobileActionsBar'
import { useOverviewAttemptSelection } from '../features/board/useOverviewAttemptSelection'
import { usePgnNavigation } from '../features/board/usePgnNavigation'
import { resolveDisplayBoard, formatTimer, formatTargetSolveTime } from '../features/board/boardPage.helpers'
import type { BoardState } from '../features/board/useBoardPageController'
import { api } from '../lib/api'
import type { AttemptSpectateView, SelectableUser } from '../lib/api'

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
  const location = useLocation({ select: (loc) => loc.pathname })
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

  const isOverviewPath = React.useMemo(
    () => /^\/app\/runs\/\d+\/training-items\/\d+\/overview$/.test(location),
    [location],
  )

  const setAttemptInUrl = React.useCallback(
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

  const { selectedAttemptId, selectedAttempt, allAttempts, historyRows, handleSelectAttempt } =
    useOverviewAttemptSelection({
      overviewData: ctrl.overview.data,
      runTrainingItemId,
      requestedAttemptId: requestedOverviewAttemptId,
      onUrlAttemptChange: setAttemptInUrl,
    })

  const enrichedHistoryRows = React.useMemo(
    () =>
      user !== null
        ? historyRows.map((r) => ({
            ...r,
            userId: user.id,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
          }))
        : historyRows,
    [historyRows, user],
  )

  const [spectateState, setSpectateState] = React.useState<{
    displayName: string
    avatarUrl: string | null
    view: AttemptSpectateView
  } | null>(null)

  React.useEffect(() => {
    setSpectateState(null)
  }, [runTrainingItemId])

  const handleSpectateAttempt = React.useCallback(
    (view: AttemptSpectateView, user: { displayName: string; avatarUrl: string | null }): void => {
      setSpectateState({ view, displayName: user.displayName, avatarUrl: user.avatarUrl })
    },
    [],
  )

  const handleClearSpectate = React.useCallback((): void => {
    setSpectateState(null)
  }, [])

  const handleSelectAttemptForTable = React.useCallback(
    (row: OverviewAttemptHistoryRow): void => {
      handleClearSpectate()
      if (row.runId === Number(runIdStr)) {
        handleSelectAttempt(row.attemptId)
      } else {
        void navigate({
          to: '/app/runs/$runId/training-items/$runTrainingItemId/overview',
          params: { runId: String(row.runId), runTrainingItemId: String(row.runTrainingItemId) },
          search: { attempt: row.attemptId },
        })
      }
    },
    [runIdStr, handleSelectAttempt, navigate, handleClearSpectate],
  )

  const trainingItemId = ctrl.overview.data?.runTrainingItem.trainingItemId ?? null

  // Shared handler for both desktop sidebar and mobile drawer tables.
  // Own-user rows select/navigate normally; other-user rows enter spectate mode.
  const handleRowClick = React.useCallback(
    (row: OverviewAttemptHistoryRow): void => {
      if (user === null) return
      if (row.userId !== undefined && row.userId !== user.id) {
        if (trainingItemId === null) return
        void api.trainingItems
          .getSpectateView(trainingItemId, row.attemptId)
          .then((view) =>
            handleSpectateAttempt(view, {
              displayName: row.displayName ?? '',
              avatarUrl: row.avatarUrl ?? null,
            }),
          )
          .catch(() => {})
        return
      }
      handleSelectAttemptForTable(row)
    },
    [user, trainingItemId, handleSelectAttemptForTable, handleSpectateAttempt],
  )

  const handleUserFilterChange = React.useCallback(
    (users: SelectableUser[]): void => {
      if (users.length === 1 && user !== null && users[0].id === user.id) {
        handleClearSpectate()
      }
    },
    [user, handleClearSpectate],
  )

  const { pgnDisplay, selectedPly, setSelectedPly, isAtHead } = usePgnNavigation({
    mode: ctrl.mode,
    solvingView: ctrl.solvingView,
    session: ctrl.session,
    selectedAttempt,
    boardKey: ctrl.board.boardKey,
    overviewPgnDisplayOverride: spectateState?.view.pgnDisplay,
  })


  const overviewPgnDisplay = ctrl.mode === 'overview'
    ? (spectateState?.view.pgnDisplay ?? selectedAttempt?.pgnDisplay ?? null)
    : null

  const baseDisplayBoard = React.useMemo(
    (): BoardState =>
      resolveDisplayBoard(
        ctrl.board,
        ctrl.mode,
        selectedPly,
        ctrl.mode !== 'overview' ? pgnDisplay : null,
        selectedAttempt,
        overviewPgnDisplay,
      ),
    [ctrl.board, ctrl.mode, selectedPly, pgnDisplay, selectedAttempt, overviewPgnDisplay],
  )

  const displayBoard = React.useMemo((): BoardState => {
    if (spectateState === null || ctrl.mode !== 'overview') return baseDisplayBoard
    if (selectedPly !== null) return baseDisplayBoard
    const spectateBoard = spectateState.view.board
    if (!spectateBoard?.terminalFen) return baseDisplayBoard
    return {
      ...baseDisplayBoard,
      fen: spectateBoard.terminalFen,
      lastMove: spectateBoard.lastMove ?? undefined,
    }
  }, [baseDisplayBoard, spectateState, ctrl.mode, selectedPly])

  const lastOverviewTimerTextRef = React.useRef(ZERO_TIMER)
  const lastOverviewMetTargetTimeRef = React.useRef<boolean | null>(null)
  const lastSelectedAttemptRef = React.useRef<(typeof allAttempts)[number] | null>(null)

  React.useEffect(() => {
    lastOverviewTimerTextRef.current = ZERO_TIMER
    lastOverviewMetTargetTimeRef.current = null
    lastSelectedAttemptRef.current = null
  }, [runTrainingItemId, ZERO_TIMER])

  if ((!ctrl.overview.data && !ctrl.solvingView) || ctrl.mode === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  const overviewData = ctrl.overview.data

  const spectateTimeMs = spectateState?.view.timeSpentMs ?? null
  const frozenTimerTenths = spectateState !== null
    ? (spectateTimeMs !== null ? Math.round(spectateTimeMs / 100) : 0)
    : selectedAttempt === null || selectedAttempt.timeSpentMs === null
      ? 0
      : Math.round(selectedAttempt.timeSpentMs / 100)

  const overviewMetTargetTime = (() => {
    const tenths = overviewData?.timer.targetSolveTenths ?? null
    if (selectedAttempt === null || selectedAttempt.timeSpentMs === null) return null
    if (tenths === null || tenths <= 0) return null
    return Math.round(selectedAttempt.timeSpentMs / 100) <= tenths
  })()

  const currentOverviewTimerText = formatTimer(frozenTimerTenths, showTenths)
  if (currentOverviewTimerText !== ZERO_TIMER) lastOverviewTimerTextRef.current = currentOverviewTimerText
  const displayedOverviewTimerText =
    currentOverviewTimerText !== ZERO_TIMER ? currentOverviewTimerText : lastOverviewTimerTextRef.current
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

  const isSolvedAttempt = spectateState !== null
    ? spectateState.view.board?.result === 'correct'
    : displayedAttempt?.status === 'solved'

  const selectedAccuracyDelta = selectedAttempt?.impact?.accuracyDeltaPct ?? null
  const selectedSolveTimeDelta = selectedAttempt?.impact?.averageSolveTimeDeltaMs ?? null
  const selectedRunProgressDelta = selectedAttempt?.impact?.runProgressDeltaPct ?? null
  const selectedTrainingProgressDelta = selectedAttempt?.impact?.trainingProgressDeltaPct ?? null

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
              {displayedOverviewMetTargetTime ? 'Completed within target time' : 'Target time missed'}
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

  const sourceForMetaCard =
    ctrl.mode === 'overview' && overviewData !== null
      ? overviewData.trainingItem.source
      : (ctrl.solvingView?.trainingItem.source ?? null)

  const trainingItemIdForMetaCard =
    ctrl.mode === 'overview' && overviewData !== null
      ? overviewData.runTrainingItem.trainingItemId
      : ctrl.solvingView?.runTrainingItem.trainingItemId

  const timerBar =
    ctrl.mode === 'focus' && ctrl.session.allPliesPlayed.length > 0
      ? (() => {
          const { elapsedTenths, targetSolveTenths } = ctrl.timer
          if (targetSolveTenths === null || targetSolveTenths <= 0 || elapsedTenths >= targetSolveTenths) return null
          const leftPct = Math.max(0, Math.min(100, ((targetSolveTenths - elapsedTenths) / targetSolveTenths) * 100))
          const hue =
            leftPct >= 60 ? 60 + ((leftPct - 60) / 40) * 60 : leftPct >= 20 ? ((leftPct - 20) / 40) * 60 : 0
          return {
            leftPct,
            color: `hsl(${hue} 55% 48%)`,
            tooltipText: `Target solve time: ${formatTargetSolveTime(targetSolveTenths)}. This bar shows how much of that time is remaining.`,
          }
        })()
      : null

  const overlayNode =
    ctrl.mode === 'overview' && ctrl.runCompleteOverlayData !== null ? (
      <RunCompleteOverlay
        overlayData={ctrl.runCompleteOverlayData}
        onClose={() => ctrl.actions.dismissRunComplete()}
      />
    ) : undefined

  const centerMobileHeader =
    ctrl.mode === 'overview' && overviewData !== null ? (
      <MobileOverviewMetaBar
        source={overviewData.trainingItem.source}
        pgnDisplay={overviewPgnDisplay}
        trainingItemId={overviewData.runTrainingItem.trainingItemId}
        selectedPly={selectedPly}
        onPlyClick={setSelectedPly}
      />
    ) : ctrl.solvingView !== null ? (
      <AttemptTypeCard
        isPractice={ctrl.solvingView.attempt.attemptType === 'practice'}
        currentTryNumber={ctrl.solvingView.runTrainingItem.currentTryNumber}
        maxTriesPerPuzzle={ctrl.solvingView.runTrainingItem.maxTriesPerItem}
        compact={true}
      />
    ) : null

  const mobileExtras =
    ctrl.mode === 'focus' ? (
      <MobileActionsBar
        mode="focus"
        timerText={timerText}
        lastMoveResult={displayBoard.moveFeedback.result}
        turnToMove={ctrl.board.turnToMove}
        kingPieceUrl={ctrl.board.kingPieceUrl}
      />
    ) : ctrl.mode === 'failed' ? (
      <MobileActionsBar
        mode="failed"
        timerText={timerText}
        failedMetTargetTime={failedMetTargetTime}
        inputBlocked={ctrl.inputBlocked}
        onHint={ctrl.actions.handleShowHint}
        onSolution={ctrl.actions.handleShowSolution}
        lastMoveResult={displayBoard.moveFeedback.result}
        turnToMove={ctrl.board.turnToMove}
        kingPieceUrl={ctrl.board.kingPieceUrl}
      />
    ) : overviewData !== null ? (
      <MobileActionsBar
        mode="overview"
        timerText={displayedOverviewTimerText}
        metTargetTime={displayedOverviewMetTargetTime}
        displayedAttempt={displayedAttempt}
        analyzeUrl={overviewData.actions.analyze.url}
        nextDisabledReason={overviewData.actions.nextTrainingItem.disabledReason}
        isLoadingNextPuzzle={ctrl.isLoadingNextPuzzle}
        onRetake={() => { handleClearSpectate(); void ctrl.actions.handleRetake() }}
        onNextPuzzle={() => void ctrl.actions.handleNextPuzzle()}
      />
    ) : null

  const mobileDrawerContent =
    ctrl.mode === 'overview' && overviewData !== null ? (
      <div className="flex flex-col gap-5">
        <OverviewStatsSection
          accuracy={{ ...overviewData.stats.accuracy, deltaPct: selectedAccuracyDelta }}
          averageSolveTime={{ ...overviewData.stats.averageSolveTime, deltaMs: selectedSolveTimeDelta }}
        />
        {overviewData.runPace.chartData !== null && (
          <RunPaceCard chartData={overviewData.runPace.chartData} />
        )}
        <ProgressCard
          runProgress={{ ...overviewData.progress.runProgress, delta: selectedRunProgressDelta }}
          trainingProgress={
            overviewData.progress.trainingProgress !== null
              ? { ...overviewData.progress.trainingProgress, delta: selectedTrainingProgressDelta }
              : null
          }
        />
        {user !== null && (
          <OverviewAttemptHistoryTable
            key={overviewData.runTrainingItem.trainingItemId}
            tableId="hist-mob"
            trainingItemId={overviewData.runTrainingItem.trainingItemId}
            initialRows={enrichedHistoryRows}
            currentUser={{ id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl }}
            selectedAttemptId={spectateState?.view.attemptId ?? selectedAttemptId}
            onRowClick={handleRowClick}
            onUserFilterChange={handleUserFilterChange}
          />
        )}
      </div>
    ) : undefined

  const leftNode =
    ctrl.mode === 'overview' && overviewData !== null ? (
      <OverviewSidebarLeft
        paceChart={overviewData.runPace.chartData}
        accuracy={{ ...overviewData.stats.accuracy, deltaPct: selectedAccuracyDelta }}
        averageSolveTime={{ ...overviewData.stats.averageSolveTime, deltaMs: selectedSolveTimeDelta }}
        runProgress={{ ...overviewData.progress.runProgress, delta: selectedRunProgressDelta }}
        trainingProgress={
          overviewData.progress.trainingProgress !== null
            ? { ...overviewData.progress.trainingProgress, delta: selectedTrainingProgressDelta }
            : null
        }
      />
    ) : ctrl.solvingView !== null ? (
      <AttemptTypeCard
        isPractice={ctrl.solvingView.attempt.attemptType === 'practice'}
        currentTryNumber={ctrl.solvingView.runTrainingItem.currentTryNumber}
        maxTriesPerPuzzle={ctrl.solvingView.runTrainingItem.maxTriesPerItem}
      />
    ) : null

  const rightNode = (
    <>
      <TimerCard
        timerText={timerText}
        elapsedTenths={timerElapsedTenths}
        targetSolveTenths={timerTargetSolveTenths}
        rightSlot={timerRightSlot}
      />
      {sourceForMetaCard !== null && (
        <TrainingItemMetaCard
          source={sourceForMetaCard}
          pgnDisplay={pgnDisplay}
          trainingItemId={trainingItemIdForMetaCard}
          runPosition={ctrl.solvingView?.runTrainingItem.position}
          focusMode={ctrl.mode !== 'overview'}
          selectedPly={ctrl.mode === 'overview' ? selectedPly : null}
          onPlyClick={ctrl.mode === 'overview' ? setSelectedPly : undefined}
        />
      )}
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
      {ctrl.mode === 'overview' && overviewData !== null && user !== null && (
        <OverviewSidebarRight
          key={runTrainingItemId}
          historyRows={enrichedHistoryRows}
          selectedAttemptId={spectateState?.view.attemptId ?? selectedAttemptId}
          onRowClick={handleRowClick}
          onUserFilterChange={handleUserFilterChange}
          isLoadingNextPuzzle={ctrl.isLoadingNextPuzzle}
          onNextPuzzle={() => void ctrl.actions.handleNextPuzzle()}
          onRetake={() => { handleClearSpectate(); void ctrl.actions.handleRetake() }}
          nextPuzzleDisabledReason={overviewData.actions.nextTrainingItem.disabledReason}
          analyzeUrl={overviewData.actions.analyze.url}
          trainingItemId={overviewData.runTrainingItem.trainingItemId}
          currentUser={{ id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl }}
        />
      )}
    </>
  )

  const spectateLabelNode =
    ctrl.mode === 'overview' && spectateState !== null ? (
      <div className="flex items-center gap-1.5 rounded-full border bg-background/90 px-3 py-1 text-xs font-medium shadow-sm backdrop-blur-sm">
        <span>Inspecting</span>
        <UserAvatar
          displayName={spectateState.displayName}
          avatarUrl={spectateState.avatarUrl}
          className="h-4 w-4"
        />
        <span>{spectateState.displayName}</span>
      </div>
    ) : undefined

  const centerNode = (
    <BoardCenterColumn
      board={displayBoard}
      actions={ctrl.actions}
      attemptHistory={ctrl.session.attemptHistory}
      stripMaxVisible={8}
      runId={runIdStr}
      activeAttemptId={ctrl.mode === 'overview' ? selectedAttemptId : undefined}
      stripInteractive={ctrl.mode === 'overview'}
      pulseActive={ctrl.mode === 'focus' || ctrl.mode === 'failed'}
      boardAnimationEnabled={ctrl.mode !== 'overview'}
      mobileHeader={centerMobileHeader}
      timerBar={timerBar}
      overlay={overlayNode}
      spectateLabel={spectateLabelNode}
    />
  )

  return (
    <BoardPageShell
      boardSize={ctrl.board.boardSize}
      left={leftNode}
      center={centerNode}
      right={rightNode}
      mobileExtras={mobileExtras}
      mobileDrawerContent={mobileDrawerContent}
    />
  )
}
