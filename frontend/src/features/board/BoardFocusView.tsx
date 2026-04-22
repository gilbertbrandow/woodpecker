import * as React from 'react'
import { BoardBreadcrumbs } from './BoardBreadcrumbs'
import { AttemptScoring } from './AttemptScoring'
import { TimerCard } from './TimerCard'
import { MoveStatusCard } from './MoveStatusCard'
import { BoardCenterColumn } from './BoardCenterColumn'
import { ProgressCard } from './ProgressCard'
import { formatTimer, computeRunProgressPct, computeTrainingProgressPct } from './boardPage.helpers'
import { formatNumber } from '../../lib/utils'
import type { BoardPageControllerResult } from './useBoardPageController'
import type { RunPuzzleFull } from '../../lib/api'

type BoardFocusViewProps = {
  puzzle: RunPuzzleFull
  ctrl: BoardPageControllerResult
  runIdStr: string
}

export function BoardFocusView({ puzzle, ctrl, runIdStr }: BoardFocusViewProps): React.ReactElement {
  const { board, timer, session, participationId, actions, run, allRuns, participation } = ctrl
  const timerText = formatTimer(timer.elapsedTenths)

  const mobileHeader = (
    <>
      <BoardBreadcrumbs puzzle={puzzle} participationId={participationId} runIdStr={runIdStr} linksDisabled={true} />
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
    </>
  )

  const mobileExtras = (
    <div className="mt-3 flex items-center justify-between">
      <span className="tabular-nums text-sm font-medium">{timerText}</span>
    </div>
  )

  const progressCard = run !== null ? (
    (() => {
      const resolvedCount = run.solvedCount + run.solvedWithRetriesCount + run.failedCount
      const trainingResolved = allRuns !== null
        ? allRuns.reduce((s, r) => s + r.solvedCount + r.solvedWithRetriesCount + r.failedCount, 0)
        : 0
      const trainingTotal = allRuns !== null
        ? allRuns.reduce((s, r) => s + r.totalPuzzles, 0)
        : 0
      return (
        <ProgressCard
          runProgress={{
            label: `Run ${run.runIndex + 1}`,
            value: computeRunProgressPct(run),
            tooltipLabel: `${formatNumber(resolvedCount)} of ${formatNumber(run.totalPuzzles)} puzzles completed`,
            delta: null,
          }}
          trainingProgress={allRuns !== null ? {
            label: participation?.schedule.name ?? 'Training',
            value: computeTrainingProgressPct(allRuns),
            tooltipLabel: `${formatNumber(trainingResolved)} of ${formatNumber(trainingTotal)} puzzles completed across all runs`,
            delta: null,
          } : null}
        />
      )
    })()
  ) : null

  return (
    <div className="flex flex-1 items-center justify-center overflow-hidden px-6">
      <div className="flex w-full items-start gap-6">
        <aside className="hidden flex-1 flex-col gap-4 md:flex" style={{ height: board.boardSize }}>
          <BoardBreadcrumbs puzzle={puzzle} participationId={participationId} runIdStr={runIdStr} linksDisabled={true} />
          {progressCard}
          <AttemptScoring
            currentTryNumber={puzzle.currentTryNumber}
            maxTriesPerPuzzle={puzzle.maxTriesPerPuzzle}
            positionStatus={puzzle.positionStatus}
            attemptActive={true}
          />
        </aside>

        <BoardCenterColumn
          board={board}
          actions={actions}
          attemptHistory={session.attemptHistory}
          runId={runIdStr}
          stripInteractive={false}
          mobileHeader={mobileHeader}
          mobileExtras={mobileExtras}
        />

        <aside className="hidden flex-1 flex-col md:flex" style={{ height: board.boardSize }}>
          <TimerCard
            timerText={timerText}
            elapsedTenths={timer.elapsedTenths}
            targetSolveTenths={timer.targetSolveTenths}
          />
          <div className="mt-auto">
            <MoveStatusCard
              lastMoveResult={board.moveFeedback.result}
              turnToMove={board.turnToMove}
              kingPieceUrl={board.kingPieceUrl}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
