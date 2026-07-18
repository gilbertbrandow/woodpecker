import * as React from 'react'
import { useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useAuth } from '../context/auth'
import { Clock, CheckCircle2, XCircle, ClockArrowUp, ClockArrowDown, ExternalLink } from 'lucide-react'
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
import type { AttemptSpectateView, SelectableUser, TrainingItemMetaPgnDisplay } from '../lib/api'
import { useBoardSounds, sanToSoundEvents } from '../features/board/useBoardSounds'
import { BoardPageSkeleton } from '../features/board/BoardPageSkeleton'
import { useIsDesktop } from '../hooks/use-mobile'

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
  const { user, updateUser } = useAuth()
  const isDesktop = useIsDesktop()
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

  const playSound = useBoardSounds(user?.soundEnabled ?? false, user?.soundTheme ?? 'standard')

  const handleToggleSound = React.useCallback((pressed: boolean): void => {
    if (!user) return
    const prev = user
    updateUser({ ...prev, soundEnabled: pressed })
    void api.settings.update({ soundEnabled: pressed })
      .then(updateUser)
      .catch(() => updateUser(prev))
  }, [user, updateUser])

  const ctrl = useBoardPageController({
    runId,
    runTrainingItemId,
    attemptId,
    runIdStr,
    runTrainingItemIdStr,
    routeKind,
    onPlaySound: playSound,
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

  const { selectedAttemptId, selectedAttempt, allAttempts, handleSelectAttempt } =
    useOverviewAttemptSelection({
      overviewData: ctrl.overview.data,
      runTrainingItemId,
      requestedAttemptId: requestedOverviewAttemptId,
      onUrlAttemptChange: setAttemptInUrl,
    })

  type SpectateState =
    | { kind: 'other'; displayName: string; avatarUrl: string | null; view: AttemptSpectateView }
    | { kind: 'self'; runId: number; runTrainingItemId: number; view: AttemptSpectateView }

  const [spectateState, setSpectateState] = React.useState<SpectateState | null>(null)

  React.useEffect(() => {
    setSpectateState(null)
  }, [runTrainingItemId])

  const handleSpectateOther = React.useCallback(
    (view: AttemptSpectateView, otherUser: { displayName: string; avatarUrl: string | null }): void => {
      setSpectateState({ kind: 'other', view, displayName: otherUser.displayName, avatarUrl: otherUser.avatarUrl })
    },
    [],
  )

  const handleSpectateSelf = React.useCallback(
    (view: AttemptSpectateView, runId: number, runTrainingItemId: number): void => {
      setSpectateState({ kind: 'self', view, runId, runTrainingItemId })
    },
    [],
  )

  const handleClearSpectate = React.useCallback((): void => {
    setSpectateState(null)
  }, [])

  const handleSelectAttemptForTable = React.useCallback(
    (row: OverviewAttemptHistoryRow): void => {
      handleClearSpectate()
      handleSelectAttempt(row.attemptId)
    },
    [handleSelectAttempt, handleClearSpectate],
  )

  const trainingItemId = ctrl.overview.data?.runTrainingItem.trainingItemId ?? null

  // Shared handler for both desktop sidebar and mobile drawer tables.
  // Other-user rows enter Attempt Spectate (other variant).
  // Own-user rows from a different run enter Attempt Spectate (self variant).
  // Own-user rows from the current run select the attempt normally.
  const handleRowClick = React.useCallback(
    (row: OverviewAttemptHistoryRow): void => {
      if (user === null) return
      if (trainingItemId === null) return
      if (row.userId !== undefined && row.userId !== user.id) {
        void api.trainingItems
          .getSpectateView(trainingItemId, row.attemptId)
          .then((view) => handleSpectateOther(view, { displayName: row.displayName ?? '', avatarUrl: row.avatarUrl ?? null }))
          .catch(() => {})
        return
      }
      if (row.runId !== Number(runIdStr)) {
        void api.trainingItems
          .getSpectateView(trainingItemId, row.attemptId)
          .then((view) => handleSpectateSelf(view, row.runId, row.runTrainingItemId))
          .catch(() => {})
        return
      }
      handleSelectAttemptForTable(row)
    },
    [user, trainingItemId, runIdStr, handleSelectAttemptForTable, handleSpectateOther, handleSpectateSelf],
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

  const pgnDisplayRef = React.useRef<TrainingItemMetaPgnDisplay | null>(null)
  pgnDisplayRef.current = pgnDisplay

  const handlePlyClick = React.useCallback((ply: typeof selectedPly): void => {
    setSelectedPly(ply)
    if (ply === null) return
    const pgn = pgnDisplayRef.current
    if (!pgn) return
    let san: string | undefined
    if (ply.line === 'subvariation') {
      san = pgn.subvariations?.[ply.subIndex]?.[ply.index]?.san
    } else {
      const list = ply.line === 'main' ? pgn.mainline : (pgn.variation ?? [])
      san = list[ply.index]?.san
    }
    if (!san) return
    for (const event of sanToSoundEvents(san)) {
      playSound(event)
    }
  }, [setSelectedPly, playSound])

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
  const lastOverviewMetTargetTimeRef = React.useRef<'fast' | 'in_window' | 'missed' | null>(null)
  const lastSelectedAttemptRef = React.useRef<(typeof allAttempts)[number] | null>(null)

  React.useEffect(() => {
    lastOverviewTimerTextRef.current = ZERO_TIMER
    lastOverviewMetTargetTimeRef.current = null
    lastSelectedAttemptRef.current = null
  }, [runTrainingItemId, ZERO_TIMER])

  if ((!ctrl.overview.data && !ctrl.solvingView) || ctrl.mode === 'loading') {
    return <BoardPageSkeleton boardSize={ctrl.board.boardSize} />
  }

  const overviewData = ctrl.overview.data

  const spectateTimeMs = spectateState?.view.timeSpentMs ?? null
  const frozenTimerTenths = spectateState !== null
    ? (spectateTimeMs !== null ? Math.round(spectateTimeMs / 100) : 0)
    : selectedAttempt === null || selectedAttempt.timeSpentMs === null
      ? 0
      : Math.round(selectedAttempt.timeSpentMs / 100)

  const overviewMetTargetTime = ((): 'fast' | 'in_window' | 'missed' | null => {
    const maxTenths = overviewData?.timer.targetMaxSolveTenths ?? null
    const minTenths = overviewData?.timer.targetMinSolveTenths ?? null
    if (selectedAttempt === null || selectedAttempt.timeSpentMs === null) return null
    if (maxTenths === null || maxTenths <= 0) return null
    const elapsedTenths = Math.round(selectedAttempt.timeSpentMs / 100)
    if (elapsedTenths > maxTenths) return 'missed'
    if (minTenths !== null && minTenths > 0 && elapsedTenths < minTenths) return 'fast'
    return 'in_window'
  })()

  const currentOverviewTimerText = formatTimer(frozenTimerTenths, showTenths)
  if (currentOverviewTimerText !== ZERO_TIMER) lastOverviewTimerTextRef.current = currentOverviewTimerText
  const displayedOverviewTimerText =
    currentOverviewTimerText !== ZERO_TIMER ? currentOverviewTimerText : lastOverviewTimerTextRef.current
  if (overviewMetTargetTime !== null) lastOverviewMetTargetTimeRef.current = overviewMetTargetTime
  const displayedOverviewMetTargetTime = overviewMetTargetTime ?? lastOverviewMetTargetTimeRef.current
  if (selectedAttempt !== null) lastSelectedAttemptRef.current = selectedAttempt
  const displayedAttempt = selectedAttempt ?? lastSelectedAttemptRef.current

  const failedTimeTargetState = ((): 'fast' | 'in_window' | 'missed' | null => {
    if (ctrl.mode !== 'failed') return null
    const { targetMaxSolveTenths, targetMinSolveTenths, elapsedTenths } = ctrl.timer
    if (targetMaxSolveTenths === null || targetMaxSolveTenths <= 0) return null
    if (elapsedTenths > targetMaxSolveTenths) return 'missed'
    if (targetMinSolveTenths !== null && targetMinSolveTenths > 0 && elapsedTenths < targetMinSolveTenths) return 'fast'
    return 'in_window'
  })()

  const timerText =
    ctrl.mode === 'overview' ? displayedOverviewTimerText : formatTimer(ctrl.timer.elapsedTenths, showTenths)
  const timerElapsedTenths = ctrl.mode === 'overview' ? frozenTimerTenths : ctrl.timer.elapsedTenths
  const timerTargetMinSolveTenths = ctrl.mode === 'focus' ? ctrl.timer.targetMinSolveTenths : null
  const timerTargetMaxSolveTenths = ctrl.mode === 'focus' ? ctrl.timer.targetMaxSolveTenths : null

  const isSolvedAttempt = spectateState !== null
    ? spectateState.view.board?.result === 'correct'
    : displayedAttempt?.status === 'solved'

  const selectedAccuracyDelta = selectedAttempt?.impact?.accuracyDeltaPct ?? null
  const selectedSolveTimeDelta = selectedAttempt?.impact?.averageSolveTimeDeltaMs ?? null
  const selectedRunProgressDelta = selectedAttempt?.impact?.runProgressDeltaPct ?? null
  const selectedTrainingProgressDelta = selectedAttempt?.impact?.trainingProgressDeltaPct ?? null

  const timeTargetBadge = (state: 'fast' | 'in_window' | 'missed' | null) => {
    if (state === null) return null
    const classes =
      state === 'fast'
        ? 'border-stone-400/30 bg-stone-500/10 text-stone-600 dark:text-stone-400'
        : state === 'in_window'
          ? 'border-green-600/20 bg-green-500/15 text-green-700 dark:text-green-400'
          : 'border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
    const label = state === 'fast' ? 'Hasty' : state === 'in_window' ? 'Time' : 'Too slow'
    const icon =
      state === 'fast' ? <ClockArrowUp className="h-3 w-3" /> :
      state === 'missed' ? <ClockArrowDown className="h-3 w-3" /> :
      <Clock className="h-3 w-3" />
    const tooltip =
      state === 'fast'
        ? 'Solved puzzle faster than target'
        : state === 'in_window'
          ? 'Completed within target time'
          : 'Solved puzzle slower than target'
    return (
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <span className={`inline-flex cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${classes}`}>
            {icon}
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    )
  }

  const timerRightSlot =
    ctrl.mode === 'focus' ? undefined : ctrl.mode === 'failed' ? (
      <>
        {timeTargetBadge(failedTimeTargetState)}
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
        {timeTargetBadge(spectateState !== null ? null : displayedOverviewMetTargetTime)}
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
          const { elapsedTenths, targetMinSolveTenths, targetMaxSolveTenths } = ctrl.timer
          if (targetMaxSolveTenths === null || targetMaxSolveTenths <= 0 || elapsedTenths >= targetMaxSolveTenths) return null

          if (targetMinSolveTenths !== null && targetMinSolveTenths > 0 && elapsedTenths < targetMinSolveTenths) {
            const leftPct = Math.max(0, Math.min(100, (elapsedTenths / targetMinSolveTenths) * 100))
            return {
              leftPct,
              color: 'hsl(220 15% 55%)',
              tooltipText: `Minimum target time: ${formatTargetSolveTime(targetMinSolveTenths)}. Take your time before moving.`,
            }
          }

          const rangeStart = targetMinSolveTenths !== null && targetMinSolveTenths > 0 ? targetMinSolveTenths : 0
          const leftPct = Math.max(0, Math.min(100, ((targetMaxSolveTenths - elapsedTenths) / (targetMaxSolveTenths - rangeStart)) * 100))
          const hue =
            leftPct >= 60 ? 60 + ((leftPct - 60) / 40) * 60 : leftPct >= 20 ? ((leftPct - 20) / 40) * 60 : 0
          return {
            leftPct,
            color: `hsl(${hue} 55% 48%)`,
            tooltipText: `Maximum target time: ${formatTargetSolveTime(targetMaxSolveTenths)}. This bar shows how much of that time is remaining.`,
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
        onPlyClick={handlePlyClick}
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
        timeTargetState={failedTimeTargetState}
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
        timeTargetState={spectateState !== null ? null : displayedOverviewMetTargetTime}
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
        {user !== null && !isDesktop && (
          <OverviewAttemptHistoryTable
            key={overviewData.runTrainingItem.trainingItemId}
            trainingItemId={overviewData.runTrainingItem.trainingItemId}
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
        targetMinSolveTenths={timerTargetMinSolveTenths}
        targetMaxSolveTenths={timerTargetMaxSolveTenths}
        rightSlot={timerRightSlot}
      />
      {sourceForMetaCard !== null && ctrl.mode !== 'overview' && (
        <TrainingItemMetaCard
          source={sourceForMetaCard}
          pgnDisplay={pgnDisplay}
          trainingItemId={trainingItemIdForMetaCard}
          runPosition={ctrl.solvingView?.runTrainingItem.position}
          focusMode={true}
          selectedPly={null}
          onPlyClick={undefined}
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
          showTable={isDesktop}
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
          topSlot={
            sourceForMetaCard !== null ? (
              <TrainingItemMetaCard
                source={sourceForMetaCard}
                pgnDisplay={pgnDisplay}
                trainingItemId={trainingItemIdForMetaCard}
                focusMode={false}
                selectedPly={selectedPly}
                onPlyClick={handlePlyClick}
              />
            ) : undefined
          }
        />
      )}
    </>
  )

  const spectateLabelNode =
    ctrl.mode === 'overview' && spectateState !== null ? (
      <div className="flex items-center overflow-hidden rounded-full border bg-background/90 text-xs font-medium shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-1.5 px-3 py-1">
          <span>Inspecting</span>
          <UserAvatar
            displayName={spectateState.kind === 'other' ? spectateState.displayName : (user?.displayName ?? '')}
            avatarUrl={spectateState.kind === 'other' ? spectateState.avatarUrl : (user?.avatarUrl ?? null)}
            className="h-4 w-4"
          />
          <span>{spectateState.kind === 'other' ? spectateState.displayName : (user?.displayName ?? '')}</span>
        </div>
        {spectateState.kind === 'self' && (
          <>
            <div className="self-stretch w-px bg-border" />
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <a
                  href={`/app/runs/${spectateState.runId}/training-items/${spectateState.runTrainingItemId}/overview?attempt=${spectateState.view.attemptId}`}
                  className="flex self-stretch items-center px-2 hover:bg-muted/60"
                  onClick={(e) => {
                    e.preventDefault()
                    void navigate({
                      to: '/app/runs/$runId/training-items/$runTrainingItemId/overview',
                      params: { runId: String(spectateState.runId), runTrainingItemId: String(spectateState.runTrainingItemId) },
                      search: { attempt: spectateState.view.attemptId },
                    })
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </TooltipTrigger>
              <TooltipContent>Go to attempt</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    ) : undefined

  const centerNode = (
    <BoardCenterColumn
      board={displayBoard}
      actions={ctrl.actions}
      attemptHistory={ctrl.session.attemptHistory}
      runId={runIdStr}
      activeAttemptId={ctrl.mode === 'overview' ? selectedAttemptId : undefined}
      stripInteractive={ctrl.mode === 'overview'}
      pulseActive={ctrl.mode === 'focus' || ctrl.mode === 'failed'}
      boardAnimationEnabled={ctrl.mode !== 'overview'}
      mobileHeader={centerMobileHeader}
      timerBar={timerBar}
      overlay={overlayNode}
      spectateLabel={spectateLabelNode}
      soundEnabled={user?.soundEnabled ?? false}
      onToggleSound={user !== null ? handleToggleSound : undefined}
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
