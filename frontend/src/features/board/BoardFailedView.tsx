import * as React from 'react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { BoardBreadcrumbs } from './BoardBreadcrumbs'
import { AttemptScoring } from './AttemptScoring'
import { TimerCard } from './TimerCard'
import { MoveStatusCard } from './MoveStatusCard'
import { BoardCenterColumn } from './BoardCenterColumn'
import { formatTimer } from './boardPage.helpers'
import type { BoardPageControllerResult } from './useBoardPageController'
import type { RunPuzzleFull } from '../../lib/api'

type BoardFailedViewProps = {
  puzzle: RunPuzzleFull
  ctrl: BoardPageControllerResult
  runIdStr: string
}

export function BoardFailedView({ puzzle, ctrl, runIdStr }: BoardFailedViewProps): React.ReactElement {
  const { board, timer, session, participationId, inputBlocked, actions } = ctrl
  const elapsed = formatTimer(timer.elapsedTenths)

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
          board={board}
          actions={actions}
          attemptHistory={session.attemptHistory}
          runId={runIdStr}
          mobileHeader={mobileHeader}
          mobileExtras={mobileExtras}
        />

        <aside className="hidden flex-1 flex-col md:flex" style={{ height: board.boardSize }}>
          <TimerCard
            timerText={elapsed}
            elapsedTenths={timer.elapsedTenths}
            targetSolveTenths={timer.targetSolveTenths}
            muted={true}
          />
          <div className="mt-auto flex flex-col gap-3">
            <Button variant="outline" size="sm" onClick={actions.handleShowHint} disabled={inputBlocked}>
              Show Hint
            </Button>
            <Button variant="outline" size="sm" onClick={actions.handleShowSolution} disabled={inputBlocked}>
              Show Solution
            </Button>
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
