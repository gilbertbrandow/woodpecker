import * as React from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'
import { ProgressBar } from '../../components/ProgressBar'
import { BoardBreadcrumbs } from './BoardBreadcrumbs'
import { BoardCenterColumn } from './BoardCenterColumn'
import { OverviewSidebarLeft } from './OverviewSidebarLeft'
import { OverviewSidebarRight } from './OverviewSidebarRight'
import { OverviewStatsSection } from './OverviewStatsSection'
import { OverviewActionsSection } from './OverviewActionsSection'
import { OverviewAttemptHistoryTable } from './OverviewAttemptHistoryTable'
import { DeltaBadge } from './DeltaBadge'
import { useOverviewSelectionModel } from './useOverviewSelectionModel'
import { computeOverviewBoardState } from './boardOverview.helpers'
import { buildPgnDisplay } from './boardOverview.pgn'
import { formatTimer, computeTrainingProgressDelta } from './boardPage.helpers'
import { formatNumber } from '../../lib/utils'
import { api } from '../../lib/api'
import type { PuzzleRunReference, RunPuzzleFull } from '../../lib/api'
import type { BoardPageControllerResult, BoardState } from './useBoardPageController'
import type { OverviewAttemptHistoryRow } from './OverviewAttemptHistoryTable'
import type { PlySelection, PuzzleMetaPgnDisplay } from './boardOverview.pgn'

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
  const [selectedPly, setSelectedPly] = React.useState<PlySelection | null>(null)
  const [crossRunRefs, setCrossRunRefs] = React.useState<PuzzleRunReference[]>([])
  const [crossRunPuzzles, setCrossRunPuzzles] = React.useState<Map<number, RunPuzzleFull>>(new Map())

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
    if (freshPuzzle.runPuzzleId !== Number(runPuzzleIdStr)) return
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
  }, [freshPuzzle, runPuzzleIdStr, requestedAttemptId, selectedAttemptId, setOverviewAttemptInUrl])

  const handleSelectAttempt = React.useCallback((attemptId: number): void => {
    if (attemptId === selectedAttemptId) return
    setSelectedAttemptId(attemptId)
    setOverviewAttemptInUrl(attemptId, false)
  }, [selectedAttemptId, setOverviewAttemptInUrl])

  React.useEffect(() => {
    if (!freshPuzzle || !participation) return
    let ignore = false
    setCrossRunRefs([])
    void api.participations.getCrossRunPuzzle(participation.id, freshPuzzle.puzzleId)
      .then((refs) => { if (!ignore) setCrossRunRefs(refs) })
      .catch(() => {
        if (!ignore) toast.error('Could not load run switcher', { description: 'Run comparison unavailable.' })
      })
    return () => { ignore = true }
  }, [freshPuzzle?.puzzleId, participation?.id])

  React.useEffect(() => {
    let ignore = false
    const refsToFetch = crossRunRefs.filter((ref) => ref.hasAttempts)
    if (refsToFetch.length === 0) {
      setCrossRunPuzzles(new Map())
      return
    }
    void Promise.all(
      refsToFetch.map((ref) =>
        api.runs.getPuzzle(ref.runId, ref.runPuzzleId).then((puzzle) => ({ runId: ref.runId, puzzle })),
      ),
    )
      .then((results) => {
        if (ignore) return
        const map = new Map<number, RunPuzzleFull>()
        for (const { runId, puzzle } of results) {
          map.set(runId, puzzle)
        }
        setCrossRunPuzzles(map)
      })
      .catch(() => undefined)
    return () => { ignore = true }
  }, [crossRunRefs])

  const historyRows = React.useMemo((): OverviewAttemptHistoryRow[] => {
    if (!run) return []
    const currentRunId = Number(runIdStr)
    const freshIsForCurrentRun =
      freshPuzzle !== null && freshPuzzle.runPuzzleId === Number(runPuzzleIdStr)
    const rows: OverviewAttemptHistoryRow[] = []

    if (freshIsForCurrentRun && freshPuzzle) {
      for (const attempt of freshPuzzle.tries) {
        if (attempt.status === 'in_progress') continue
        const hasPriorSolve = freshPuzzle.tries.some(
          (a) => a.tryNumber < attempt.tryNumber && a.status === 'solved',
        )
        rows.push({
          attemptId: attempt.id,
          runId: run.id,
          runLabel: `Run ${run.runIndex + 1}`,
          runOrder: run.runIndex,
          runPuzzleId: freshPuzzle.runPuzzleId,
          tryNumber: attempt.tryNumber,
          countsTowardsTraining:
            attempt.tryNumber <= freshPuzzle.maxTriesPerPuzzle && !hasPriorSolve,
          result: attempt.status as 'solved' | 'failed',
          timeSpentMs: attempt.timeSpentMs,
        })
      }
    }

    for (const [runId, puzzle] of crossRunPuzzles) {
      const isCurrent = runId === currentRunId
      if (freshIsForCurrentRun && isCurrent) continue
      const ref = crossRunRefs.find((r) => r.runId === runId)
      if (!ref) continue
      for (const attempt of puzzle.tries) {
        if (attempt.status === 'in_progress') continue
        const hasPriorSolve = puzzle.tries.some(
          (a) => a.tryNumber < attempt.tryNumber && a.status === 'solved',
        )
        rows.push({
          attemptId: attempt.id,
          runId,
          runLabel: `Run ${ref.runIndex + 1}`,
          runOrder: ref.runIndex,
          runPuzzleId: ref.runPuzzleId,
          tryNumber: attempt.tryNumber,
          countsTowardsTraining:
            attempt.tryNumber <= puzzle.maxTriesPerPuzzle && !hasPriorSolve,
          result: attempt.status as 'solved' | 'failed',
          timeSpentMs: attempt.timeSpentMs,
        })
      }
    }

    return rows
  }, [freshPuzzle, run, crossRunPuzzles, crossRunRefs, runIdStr, runPuzzleIdStr])

  const handleSelectAttemptForTable = React.useCallback(
    (attemptId: number): void => {
      const row = historyRows.find((r) => r.attemptId === attemptId)
      if (!row) return
      if (row.runId === Number(runIdStr)) {
        handleSelectAttempt(attemptId)
      } else {
        setSelectedAttemptId(attemptId)
        void navigate({
          to: '/app/runs/$runId/puzzles/$runPuzzleId/overview',
          params: { runId: String(row.runId), runPuzzleId: String(row.runPuzzleId) },
          search: { attempt: attemptId },
        })
      }
    },
    [historyRows, runIdStr, handleSelectAttempt, navigate],
  )

  const currentRunIdNum = Number(runIdStr)
  const currentRunPuzzleIdNum = Number(runPuzzleIdStr)

  const effectivePuzzle = React.useMemo((): RunPuzzleFull | null => {
    if (freshPuzzle !== null && freshPuzzle.runPuzzleId === currentRunPuzzleIdNum) {
      return freshPuzzle
    }
    return crossRunPuzzles.get(currentRunIdNum) ?? null
  }, [freshPuzzle, currentRunPuzzleIdNum, crossRunPuzzles, currentRunIdNum])

  const selectionModel = useOverviewSelectionModel(
    effectivePuzzle,
    run,
    participation,
    selectedAttemptId,
    timer.targetSolveTenths,
    accuracyDelta,
    timeDelta,
  )

  const isLoading = effectivePuzzle === null || run === null

  const pgnDisplay = React.useMemo((): PuzzleMetaPgnDisplay | null => {
    const attempt = selectionModel?.selectedAttempt
    if (!attempt || !effectivePuzzle) return null
    const status = attempt.status === 'solved' || attempt.status === 'failed' ? attempt.status : null
    if (!status) return null
    return buildPgnDisplay(effectivePuzzle.fen, attempt.moves, effectivePuzzle.solution, status)
  }, [selectionModel, effectivePuzzle])

  React.useEffect(() => {
    if (pgnDisplay === null || pgnDisplay.mainline.length === 0) {
      setSelectedPly(null)
      return
    }
    setSelectedPly({ line: 'main', index: pgnDisplay.mainline.length - 1 })
  }, [pgnDisplay])

  const lastOverviewBoardRef = React.useRef<BoardState | null>(null)
  const lastOverviewAllRunsRef = React.useRef<import('../../lib/api').Run[] | null>(null)
  if (overview.allRuns !== null) lastOverviewAllRunsRef.current = overview.allRuns
  const lastMoveFeedbackRef = React.useRef<BoardState['moveFeedback']>({
    result: null,
    square: null,
    visible: false,
  })

  const overviewBoard: BoardState = React.useMemo(() => {
    if (!effectivePuzzle || !selectionModel) {
      return lastOverviewBoardRef.current ?? { ...board, dests: new Map() }
    }
    const derived = computeOverviewBoardState(effectivePuzzle, selectionModel.selectedAttempt)
    const moveFeedback = derived.moveFeedback.visible
      ? derived.moveFeedback
      : lastMoveFeedbackRef.current
    if (derived.moveFeedback.visible) lastMoveFeedbackRef.current = derived.moveFeedback

    if (selectedPly !== null && pgnDisplay !== null) {
      const plyList = selectedPly.line === 'main' ? pgnDisplay.mainline : (pgnDisplay.variation ?? [])
      const ply = plyList[selectedPly.index]
      if (ply) {
        const plyFeedbackResult =
          ply.moveStatus === 'correct' ? 'correct' :
          ply.moveStatus === 'wrong' ? 'wrong' : null
        const next: BoardState = {
          ...board,
          fen: ply.fen,
          lastMove: [ply.from, ply.to],
          moveFeedback: {
            result: plyFeedbackResult,
            square: plyFeedbackResult !== null ? ply.to : null,
            visible: plyFeedbackResult !== null,
          },
          dests: new Map(),
        }
        lastOverviewBoardRef.current = next
        return next
      }
    }

    const next: BoardState = {
      ...board,
      fen: derived.fen,
      lastMove: derived.lastMove,
      moveFeedback,
      dests: new Map(),
    }
    lastOverviewBoardRef.current = next
    return next
  }, [board, effectivePuzzle, selectionModel, selectedPly, pgnDisplay])

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
            board={overviewBoard}
            actions={actions}
            attemptHistory={session.attemptHistory}
            runId={runIdStr}
            boardAnimationEnabled={false}
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

  const stableAllRuns = overview.allRuns ?? lastOverviewAllRunsRef.current
  const trainingProgressDelta = computeTrainingProgressDelta(runProgressDelta, stableAllRuns ?? [])

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
              {metTargetTime ? 'Completed within target time' : 'Target time missed'}
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
      <OverviewAttemptHistoryTable
        rows={historyRows}
        selectedAttemptId={selectedAttemptId}
        onSelectAttempt={handleSelectAttemptForTable}
      />
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Run progress
        </span>
        <ProgressBar
          value={runProgressPct}
          tooltipLabel={`${formatNumber(resolvedCount)} of ${formatNumber(run.totalPuzzles)} puzzles completed`}
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
        gameUrl={effectivePuzzle.gameUrl}
        onNextPuzzle={() => void actions.handleNextPuzzle()}
        onRetake={() => void actions.handleRetake()}
      />
    </div>
  )

  return (
    <div className="flex flex-1 items-center justify-center overflow-hidden px-6">
      <div className="flex w-full items-start gap-6">
        <OverviewSidebarLeft
          puzzle={effectivePuzzle}
          participationId={participation?.id ?? null}
          runIdStr={runIdStr}
          run={run}
          afterStats={afterStats}
          accuracyDelta={displayedAccuracyDelta}
          timeDelta={displayedTimeDelta}
          runProgressPct={runProgressPct}
          runProgressDelta={runProgressDelta}
          allRuns={stableAllRuns}
          trainingProgressDelta={trainingProgressDelta}
          scheduleName={participation?.schedule.name ?? null}
          boardSize={board.boardSize}
        />
        <BoardCenterColumn
          board={overviewBoard}
          actions={actions}
          attemptHistory={session.attemptHistory}
          runId={runIdStr}
          activeAttemptId={selectedAttemptId}
          boardAnimationEnabled={false}
          mobileHeader={mobileHeader}
          mobileExtras={mobileExtras}
        />
        <OverviewSidebarRight
          puzzle={effectivePuzzle}
          run={run}
          frozenTimerTenths={frozenTimerTenths}
          selectedAttempt={selectedAttempt}
          metTargetTime={metTargetTime}
          isLoadingNextPuzzle={isLoadingNextPuzzle}
          onNextPuzzle={() => void actions.handleNextPuzzle()}
          onRetake={() => void actions.handleRetake()}
          boardSize={board.boardSize}
          historyRows={historyRows}
          selectedAttemptId={selectedAttemptId}
          onSelectAttempt={handleSelectAttemptForTable}
          pgnDisplay={pgnDisplay}
          selectedPly={selectedPly}
          onPlyClick={setSelectedPly}
        />
      </div>
    </div>
  )
}
