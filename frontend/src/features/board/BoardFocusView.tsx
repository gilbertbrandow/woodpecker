import * as React from 'react'
import { BoardBreadcrumbs } from './BoardBreadcrumbs'
import { AttemptScoring } from './AttemptScoring'
import { TimerCard } from './TimerCard'
import { MoveStatusCard } from './MoveStatusCard'
import { BoardCenterColumn } from './BoardCenterColumn'
import { ProgressCard } from './ProgressCard'
import { PuzzleMetaCard } from './PuzzleMetaCard'
import { buildPgnDisplay } from './boardOverview.pgn'
import { formatTimer, computeRunProgressPct, computeTrainingProgressPct } from './boardPage.helpers'
import { formatNumber } from '../../lib/utils'
import type { BoardPageControllerResult, BoardState } from './useBoardPageController'
import type { RunPuzzleFull } from '../../lib/api'
import type { PlySelection } from './boardOverview.pgn'

type BoardFocusViewProps = {
  puzzle: RunPuzzleFull
  ctrl: BoardPageControllerResult
  runIdStr: string
}

export function BoardFocusView({ puzzle, ctrl, runIdStr }: BoardFocusViewProps): React.ReactElement {
  const { board, timer, session, participationId, actions, run, allRuns, participation } = ctrl
  const timerText = formatTimer(timer.elapsedTenths)

  const [selectedPly, setSelectedPly] = React.useState<PlySelection | null>(null)

  React.useEffect(() => {
    setSelectedPly(null)
  }, [board.boardKey])

  const pgnDisplay = React.useMemo(() => {
    const moves = session.liveFocusStatus === 'in_progress'
      ? session.allPliesPlayed
      : session.movesPlayed
    return buildPgnDisplay(puzzle.fen, moves, puzzle.solution, session.liveFocusStatus)
  }, [puzzle.fen, puzzle.solution, session.allPliesPlayed, session.movesPlayed, session.liveFocusStatus])

  const isAtHead =
    selectedPly === null ||
    (selectedPly.line === 'main' && selectedPly.index === pgnDisplay.mainline.length - 1)

  const displayBoard = React.useMemo((): BoardState => {
    if (isAtHead) return board
    const plyList = selectedPly?.line === 'main' ? pgnDisplay.mainline : (pgnDisplay.variation ?? [])
    const ply = selectedPly !== null ? plyList[selectedPly.index] : undefined
    if (!ply) return board
    const feedbackResult =
      ply.moveStatus === 'correct' ? 'correct' :
      ply.moveStatus === 'wrong' ? 'wrong' : null
    return {
      ...board,
      fen: ply.fen,
      lastMove: [ply.from, ply.to],
      dests: new Map(),
      moveFeedback: {
        result: feedbackResult,
        square: feedbackResult !== null ? ply.to : null,
        visible: feedbackResult !== null,
      },
    }
  }, [board, selectedPly, pgnDisplay, isAtHead])

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
            label: `${participation?.schedule.name ?? 'Training'}`,
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
          board={displayBoard}
          actions={actions}
          attemptHistory={session.attemptHistory}
          runId={runIdStr}
          stripInteractive={false}
          mobileHeader={mobileHeader}
          mobileExtras={mobileExtras}
        />

        <aside className="hidden flex-1 flex-col gap-2 md:flex" style={{ height: board.boardSize }}>
          <TimerCard
            timerText={timerText}
            elapsedTenths={timer.elapsedTenths}
            targetSolveTenths={timer.targetSolveTenths}
          />
          <PuzzleMetaCard
            puzzleId={puzzle.puzzleId}
            rating={puzzle.rating}
            themes={puzzle.themes}
            pgnDisplay={pgnDisplay}
            focusMode={true}
            selectedPly={selectedPly}
            onPlyClick={setSelectedPly}
          />
          <div className="mt-auto">
            <MoveStatusCard
              lastMoveResult={displayBoard.moveFeedback.result}
              turnToMove={board.turnToMove}
              kingPieceUrl={board.kingPieceUrl}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
