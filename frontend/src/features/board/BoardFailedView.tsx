import * as React from 'react'
import { Clock, XCircle } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'
import { BoardBreadcrumbs } from './BoardBreadcrumbs'
import { BoardCenterColumn } from './BoardCenterColumn'
import { MoveStatusCard } from './MoveStatusCard'
import { PuzzleMetaCard } from './PuzzleMetaCard'
import { TimerCard } from './TimerCard'
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

  const metTargetTime = timer.targetSolveTenths !== null && timer.targetSolveTenths > 0
    ? timer.elapsedTenths <= timer.targetSolveTenths
    : null

  const timerRightSlot = (
    <>
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
          <TooltipContent>{metTargetTime ? 'Completed within target time' : 'Target time missed'}</TooltipContent>
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
  )

  const [selectedPly, setSelectedPly] = React.useState<PlySelection | null>(null)

  React.useEffect(() => {
    setSelectedPly(null)
  }, [board.boardKey])

  const pgnDisplay = React.useMemo(
    () => buildPgnDisplay(puzzle.fen, session.movesPlayed, puzzle.solution, 'failed', session.failedRetryPlies, false),
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

  const mobileExtras = (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="tabular-nums text-sm font-medium">{elapsed}</span>
        {metTargetTime !== null && (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
              metTargetTime
                ? 'border-green-600/20 bg-green-500/15 text-green-700 dark:text-green-400'
                : 'border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
            }`}
          >
            <Clock className="h-3 w-3" />
            {metTargetTime ? 'Time met' : 'Time missed'}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full border border-red-600/20 bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
          <XCircle className="h-3 w-3" />
          Failed
        </span>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={actions.handleShowHint} disabled={inputBlocked}>
          Hint
        </Button>
        <Button variant="outline" className="flex-1" onClick={actions.handleShowSolution} disabled={inputBlocked}>
          Solution
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-none px-4 pt-3 pb-2 lg:hidden">
        <BoardBreadcrumbs puzzle={puzzle} participationId={participationId} runIdStr={runIdStr} />
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="outline">Failed</Badge>
          {puzzle.maxTriesPerPuzzle > 1 && (
            <span className="text-xs text-muted-foreground">
              {(puzzle.currentTryNumber > puzzle.maxTriesPerPuzzle ||
                puzzle.tries.some(
                  (t) => t.status === 'solved' && t.tryNumber < puzzle.currentTryNumber,
                ))
                ? 'Practice attempt'
                : `Attempt ${puzzle.currentTryNumber} / ${puzzle.maxTriesPerPuzzle}`}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden lg:px-6">
        <div className="flex w-full items-start justify-center gap-6">
          <aside className="hidden flex-1 flex-col gap-4 lg:flex" style={{ height: board.boardSize }}>
            <BoardBreadcrumbs puzzle={puzzle} participationId={participationId} runIdStr={runIdStr} />
            <div className="rounded-lg border bg-card p-4">
              {(puzzle.currentTryNumber > puzzle.maxTriesPerPuzzle ||
                puzzle.tries.some(
                  (t) => t.status === 'solved' && t.tryNumber < puzzle.currentTryNumber,
                )) ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Practice attempt</span>
                  <span className="text-xs text-muted-foreground">This attempt will not count towards your score.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Attempt {puzzle.currentTryNumber}</span>
                    {puzzle.maxTriesPerPuzzle > 1 && (
                      <span className="text-xs text-muted-foreground">of {puzzle.maxTriesPerPuzzle}</span>
                    )}
                  </div>
                  {puzzle.maxTriesPerPuzzle > 1 && (
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: puzzle.maxTriesPerPuzzle }).map((_, i) => {
                        const n = i + 1
                        const isCurrent = n === puzzle.currentTryNumber
                        const isUsed = n < puzzle.currentTryNumber
                        return (
                          <div
                            key={i}
                            className={`rounded-full ${
                              isCurrent
                                ? 'h-2.5 w-2.5 bg-foreground'
                                : isUsed
                                  ? 'h-2 w-2 bg-foreground/35'
                                  : 'h-2 w-2 bg-foreground/10'
                            }`}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>

          <BoardCenterColumn
            board={displayBoard}
            actions={actions}
            attemptHistory={session.attemptHistory}
            runId={runIdStr}
            mobileExtras={mobileExtras}
          />

          <aside className="hidden flex-1 flex-col gap-2 lg:flex" style={{ height: board.boardSize }}>
            <TimerCard
              timerText={elapsed}
              elapsedTenths={timer.elapsedTenths}
              targetSolveTenths={null}
              rightSlot={timerRightSlot}
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
    </div>
  )
}
