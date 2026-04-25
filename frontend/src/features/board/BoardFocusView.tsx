import * as React from 'react'
import { BoardBreadcrumbs } from './BoardBreadcrumbs'
import { TimerCard } from './TimerCard'
import { MoveStatusCard } from './MoveStatusCard'
import { BoardCenterColumn } from './BoardCenterColumn'
import { PuzzleMetaCard } from './PuzzleMetaCard'
import { AttemptTypeCard } from './AttemptTypeCard'
import { buildPgnDisplay } from './boardOverview.pgn'
import { formatTimer, formatTargetSolveTime } from './boardPage.helpers'
import type { BoardPageControllerResult, BoardState } from './useBoardPageController'
import type { RunPuzzleFull } from '../../lib/api'
import type { PlySelection } from './boardOverview.pgn'

type BoardFocusViewProps = {
  puzzle: RunPuzzleFull
  ctrl: BoardPageControllerResult
  runIdStr: string
}

export function BoardFocusView({ puzzle, ctrl, runIdStr }: BoardFocusViewProps): React.ReactElement {
  const { board, timer, session, participationId, actions } = ctrl
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

  const mobileExtras = (
    <div className="mt-3 flex items-center justify-between">
      <span className="tabular-nums text-sm font-medium">{timerText}</span>
      <MoveStatusCard
        lastMoveResult={displayBoard.moveFeedback.result}
        turnToMove={board.turnToMove}
        kingPieceUrl={board.kingPieceUrl}
        compact={true}
      />
    </div>
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-4 lg:px-0">
      <div className="flex-none pt-3 pb-2 lg:hidden">
        <BoardBreadcrumbs puzzle={puzzle} participationId={participationId} runIdStr={runIdStr} linksDisabled={true} />
      </div>
      <div className="flex flex-1 items-start justify-center overflow-hidden lg:items-center lg:px-6">
        <div className="flex w-full items-start justify-center gap-6">
          <aside className="hidden flex-1 flex-col gap-4 lg:flex" style={{ height: board.boardSize }}>
            <BoardBreadcrumbs puzzle={puzzle} participationId={participationId} runIdStr={runIdStr} linksDisabled={true} />
            <AttemptTypeCard
              currentTryNumber={puzzle.currentTryNumber}
              maxTriesPerPuzzle={puzzle.maxTriesPerPuzzle}
              tries={puzzle.tries}
            />
          </aside>

          <BoardCenterColumn
            board={displayBoard}
            actions={actions}
            attemptHistory={session.attemptHistory}
            runId={runIdStr}
            stripInteractive={false}
            mobileHeader={
              <AttemptTypeCard
                currentTryNumber={puzzle.currentTryNumber}
                maxTriesPerPuzzle={puzzle.maxTriesPerPuzzle}
                tries={puzzle.tries}
                compact={true}
              />
            }
            mobileExtras={mobileExtras}
            timerBar={session.allPliesPlayed.length === 0 ? null : (() => {
              const { elapsedTenths, targetSolveTenths } = timer
              if (targetSolveTenths === null || targetSolveTenths <= 0 || elapsedTenths >= targetSolveTenths) return null
              const leftPct = Math.max(0, Math.min(100, ((targetSolveTenths - elapsedTenths) / targetSolveTenths) * 100))
              const hue = leftPct >= 60 ? 60 + ((leftPct - 60) / 40) * 60 : leftPct >= 20 ? ((leftPct - 20) / 40) * 60 : 0
              const targetText = formatTargetSolveTime(targetSolveTenths)
              return { leftPct, color: `hsl(${hue} 55% 48%)`, tooltipText: `Target solve time: ${targetText}. This bar shows how much of that time is remaining.` }
            })()}
          />

          <aside className="hidden flex-1 flex-col gap-2 lg:flex" style={{ height: board.boardSize }}>
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
    </div>
  )
}
