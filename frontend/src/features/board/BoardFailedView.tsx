import * as React from 'react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { BoardBreadcrumbs } from './BoardBreadcrumbs'
import { AttemptScoring } from './AttemptScoring'
import { TimerCard } from './TimerCard'
import { MoveStatusCard } from './MoveStatusCard'
import { PuzzleMetaCard } from './PuzzleMetaCard'
import { BoardCenterColumn } from './BoardCenterColumn'
import { buildPgnDisplay } from './boardOverview.pgn'
import { formatTimer } from './boardPage.helpers'
import type { BoardPageControllerResult, BoardState } from './useBoardPageController'
import type { RunPuzzleFull } from '../../lib/api'
import type { PlySelection } from './boardOverview.pgn'

type BoardFailedViewProps = {
  puzzle: RunPuzzleFull
  ctrl: BoardPageControllerResult
  runIdStr: string
}

export function BoardFailedView({ puzzle, ctrl, runIdStr }: BoardFailedViewProps): React.ReactElement {
  const { board, timer, session, participationId, inputBlocked, actions } = ctrl
  const elapsed = formatTimer(timer.elapsedTenths)

  const [selectedPly, setSelectedPly] = React.useState<PlySelection | null>(null)

  React.useEffect(() => {
    setSelectedPly(null)
  }, [board.boardKey])

  const pgnDisplay = React.useMemo(
    () => buildPgnDisplay(puzzle.fen, session.movesPlayed, puzzle.solution, 'failed', session.failedRetryPlies),
    [puzzle.fen, puzzle.solution, session.movesPlayed, session.failedRetryPlies],
  )

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
      <BoardBreadcrumbs puzzle={puzzle} participationId={participationId} runIdStr={runIdStr} />
      <div className="mt-1 flex items-center gap-2">
        <Badge variant="outline">Failed</Badge>
        {puzzle.maxTriesPerPuzzle > 1 && (
          <span className="text-xs text-muted-foreground">
            {puzzle.currentTryNumber <= puzzle.maxTriesPerPuzzle
              ? `Attempt ${puzzle.currentTryNumber} / ${puzzle.maxTriesPerPuzzle}`
              : 'Practice attempt'}
          </span>
        )}
      </div>
    </>
  )

  const mobileExtras = (
    <div className="mt-3 flex items-center justify-between">
      <span className="tabular-nums text-sm text-muted-foreground">{elapsed}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={actions.handleShowHint} disabled={inputBlocked}>
          Show Hint
        </Button>
        <Button variant="outline" size="sm" onClick={actions.handleShowSolution} disabled={inputBlocked}>
          Show Solution
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-1 items-center justify-center overflow-hidden px-6">
      <div className="flex w-full items-start gap-6">
        <aside className="hidden flex-1 flex-col md:flex" style={{ height: board.boardSize }}>
          <div className="mb-6">
            <BoardBreadcrumbs puzzle={puzzle} participationId={participationId} runIdStr={runIdStr} />
          </div>
          <Badge variant="outline" className="w-fit">Failed</Badge>
          <div className="mt-4">
            <AttemptScoring
              currentTryNumber={puzzle.currentTryNumber}
              maxTriesPerPuzzle={puzzle.maxTriesPerPuzzle}
              positionStatus={puzzle.positionStatus}
              attemptActive={false}
            />
          </div>
        </aside>

        <BoardCenterColumn
          board={displayBoard}
          actions={actions}
          attemptHistory={session.attemptHistory}
          runId={runIdStr}
          mobileHeader={mobileHeader}
          mobileExtras={mobileExtras}
        />

        <aside className="hidden flex-1 flex-col gap-2 md:flex" style={{ height: board.boardSize }}>
          <TimerCard
            timerText={elapsed}
            elapsedTenths={timer.elapsedTenths}
            targetSolveTenths={timer.targetSolveTenths}
            muted={true}
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
          <div className="mt-auto flex flex-col gap-3">
            <Button variant="outline" size="sm" onClick={actions.handleShowHint} disabled={inputBlocked || !isAtHead}>
              Show Hint
            </Button>
            <Button variant="outline" size="sm" onClick={actions.handleShowSolution} disabled={inputBlocked || !isAtHead}>
              Show Solution
            </Button>
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
