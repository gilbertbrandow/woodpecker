import * as React from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'
import { ProgressBar } from '../../components/ProgressBar'
import { BoardBreadcrumbs } from './BoardBreadcrumbs'
import { BoardCenterColumn } from './BoardCenterColumn'
import { OverviewSidebarLeft } from './OverviewSidebarLeft'
import { OverviewSidebarRight } from './OverviewSidebarRight'
import { AttemptTable } from './AttemptTable'
import { OverviewStatsSection } from './OverviewStatsSection'
import { OverviewActionsSection } from './OverviewActionsSection'
import { DeltaBadge } from './DeltaBadge'
import { useOverviewSelectionModel } from './useOverviewSelectionModel'
import { formatTimer } from './boardPage.helpers'
import { formatNumber } from '../../lib/utils'
import type { BoardPageControllerResult } from './useBoardPageController'
import type { RunPuzzleFull } from '../../lib/api'

type BoardOverviewViewProps = {
  puzzle: RunPuzzleFull
  ctrl: BoardPageControllerResult
  runIdStr: string
  runPuzzleIdStr: string
  requestedAttemptId: number | null
}

export function BoardOverviewView({
  puzzle,
  ctrl,
  runIdStr,
  runPuzzleIdStr,
  requestedAttemptId,
}: BoardOverviewViewProps): React.ReactElement {
  const navigate = useNavigate()
  const location = useLocation({ select: (loc) => loc.pathname })
  const { board, session, participationId, overview, timer, isLoadingNextPuzzle, actions } = ctrl
  const { freshPuzzle, run, afterStats, accuracyDelta, timeDelta, participation } = overview

  const [selectedAttemptId, setSelectedAttemptId] = React.useState<number | null>(null)

  const isOverviewPath = React.useMemo(
    () => /^\/app\/runs\/\d+\/puzzles\/\d+\/overview$/.test(location),
    [location],
  )

  const setOverviewAttemptInUrl = React.useCallback((attemptId: number | null, replace: boolean): void => {
    if (!isOverviewPath) return
    void navigate({
      to: '/app/runs/$runId/puzzles/$runPuzzleId/overview',
      params: { runId: runIdStr, runPuzzleId: runPuzzleIdStr },
      search: attemptId === null ? {} : { attempt: attemptId },
      replace,
    })
  }, [isOverviewPath, navigate, runIdStr, runPuzzleIdStr])

  React.useEffect(() => {
    if (!freshPuzzle) return
    const sortedAttempts = [...freshPuzzle.tries]
      .filter((a) => a.status !== 'in_progress')
      .sort((a, b) => b.tryNumber - a.tryNumber)
    const latestAttemptId = sortedAttempts[0]?.id ?? null
    const validRequestedAttemptId = requestedAttemptId !== null && sortedAttempts.some((item) => item.id === requestedAttemptId)
      ? requestedAttemptId
      : null
    const nextSelectedAttemptId = latestAttemptId === null ? null : (validRequestedAttemptId ?? latestAttemptId)

    if (nextSelectedAttemptId !== selectedAttemptId) {
      setSelectedAttemptId(nextSelectedAttemptId)
    }

    if (nextSelectedAttemptId === null) {
      if (requestedAttemptId !== null) {
        setOverviewAttemptInUrl(null, true)
      }
      return
    }

    if (requestedAttemptId !== nextSelectedAttemptId) {
      setOverviewAttemptInUrl(nextSelectedAttemptId, true)
    }
  }, [freshPuzzle, requestedAttemptId, selectedAttemptId, setOverviewAttemptInUrl])

  const handleSelectAttempt = React.useCallback((attemptId: number): void => {
    if (attemptId === selectedAttemptId) return
    setSelectedAttemptId(attemptId)
    setOverviewAttemptInUrl(attemptId, false)
  }, [selectedAttemptId, setOverviewAttemptInUrl])

  const selectionModel = useOverviewSelectionModel(
    freshPuzzle,
    run,
    participation,
    selectedAttemptId,
    timer.targetSolveTenths,
    accuracyDelta,
    timeDelta,
  )

  const isLoading = freshPuzzle === null || run === null

  const loadingMobileHeader = (
    <BoardBreadcrumbs puzzle={puzzle} participationId={participationId} runIdStr={runIdStr} />
  )

  if (isLoading || selectionModel === null) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-hidden px-6">
        <div className="flex w-full items-start gap-6">
          <aside className="hidden flex-1 flex-col md:flex" style={{ height: board.boardSize }}>
            <BoardBreadcrumbs puzzle={puzzle} participationId={participationId} runIdStr={runIdStr} />
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          </aside>
          <BoardCenterColumn
            board={board}
            actions={actions}
            attemptHistory={session.attemptHistory}
            mobileHeader={loadingMobileHeader}
            mobileExtras={null}
          />
          <aside className="hidden flex-1 flex-col md:flex" style={{ height: board.boardSize }}>
            <p className="text-sm text-muted-foreground">Loading…</p>
          </aside>
        </div>
      </div>
    )
  }

  const {
    selectedAttempt,
    frozenTimerTenths,
    metTargetTime,
    runProgressPct,
    runProgressDelta,
    displayedAccuracyDelta,
    displayedTimeDelta,
  } = selectionModel

  const resolvedCount = run.solvedCount + run.solvedWithRetriesCount + run.failedCount

  const mobileHeader = (
    <>
      <BoardBreadcrumbs puzzle={puzzle} participationId={participationId} runIdStr={runIdStr} />
      <div className="mt-1 flex items-center gap-2">
        <span className="tabular-nums text-sm font-medium">
          {formatTimer(frozenTimerTenths)}
        </span>
        {metTargetTime !== null && (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <span
                className={`inline-flex cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                  metTargetTime
                    ? 'border-green-600/20 bg-green-500/15 text-green-700 dark:text-green-400'
                    : 'border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                }`}
              >
                <Clock className="h-3 w-3" />
                Time
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {metTargetTime ? 'Moved within target time' : 'Target time missed'}
            </TooltipContent>
          </Tooltip>
        )}
        {selectedAttempt !== null && (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <span
                className={`inline-flex cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                  selectedAttempt.status === 'solved'
                    ? 'border-green-600/20 bg-green-500/15 text-green-700 dark:text-green-400'
                    : 'border-red-600/20 bg-red-500/15 text-red-700 dark:text-red-400'
                }`}
              >
                {selectedAttempt.status === 'solved'
                  ? <CheckCircle2 className="h-3 w-3" />
                  : <XCircle className="h-3 w-3" />}
                {selectedAttempt.status === 'solved' ? 'Solved' : 'Failed'}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {selectedAttempt.status === 'solved' ? 'Correctly solved' : 'Not solved'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </>
  )

  const mobileExtras = (
    <div className="mt-4 flex flex-col gap-5">
      <AttemptTable
        tries={freshPuzzle.tries}
        maxTriesPerPuzzle={freshPuzzle.maxTriesPerPuzzle}
        selectedAttemptId={selectedAttemptId}
        onSelect={handleSelectAttempt}
      />
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Run progress
        </span>
        <ProgressBar
          value={runProgressPct}
          tooltipLabel={`${formatNumber(resolvedCount)} of ${formatNumber(run.totalPuzzles)} puzzles resolved`}
          className="w-full"
        />
        <DeltaBadge
          delta={runProgressDelta}
          goodWhenPositive={true}
          format={(n) => `${n.toFixed(1)}%`}
        />
      </div>
      {afterStats !== null && (
        <OverviewStatsSection
          afterStats={afterStats}
          accuracyDelta={displayedAccuracyDelta}
          timeDelta={displayedTimeDelta}
        />
      )}
      <OverviewActionsSection
        run={run}
        isLoadingNextPuzzle={isLoadingNextPuzzle}
        gameUrl={freshPuzzle.gameUrl}
        onNextPuzzle={() => void actions.handleNextPuzzle()}
        onRetake={() => void actions.handleRetake()}
      />
    </div>
  )

  return (
    <div className="flex flex-1 items-center justify-center overflow-hidden px-6">
      <div className="flex w-full items-start gap-6">
        <OverviewSidebarLeft
          puzzle={freshPuzzle}
          participationId={participationId}
          runIdStr={runIdStr}
          run={run}
          afterStats={afterStats}
          accuracyDelta={displayedAccuracyDelta}
          timeDelta={displayedTimeDelta}
          selectedAttemptId={selectedAttemptId}
          runProgressPct={runProgressPct}
          runProgressDelta={runProgressDelta}
          onSelectAttempt={handleSelectAttempt}
          boardSize={board.boardSize}
        />
        <BoardCenterColumn
          board={board}
          actions={actions}
          attemptHistory={session.attemptHistory}
          mobileHeader={mobileHeader}
          mobileExtras={mobileExtras}
        />
        <OverviewSidebarRight
          puzzle={freshPuzzle}
          run={run}
          frozenTimerTenths={frozenTimerTenths}
          selectedAttempt={selectedAttempt}
          metTargetTime={metTargetTime}
          isLoadingNextPuzzle={isLoadingNextPuzzle}
          onNextPuzzle={() => void actions.handleNextPuzzle()}
          onRetake={() => void actions.handleRetake()}
          boardSize={board.boardSize}
        />
      </div>
    </div>
  )
}
