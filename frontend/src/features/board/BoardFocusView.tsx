import * as React from 'react'
import { BoardBreadcrumbs } from './BoardBreadcrumbs'
import { AttemptScoring } from './AttemptScoring'
import { TimerCard } from './TimerCard'
import { MoveStatusCard } from './MoveStatusCard'
import { BoardCenterColumn } from './BoardCenterColumn'
import { formatTimer } from './boardPage.helpers'
import type { BoardPageControllerResult } from './useBoardPageController'
import type { RunPuzzleFull } from '../../lib/api'

type BoardFocusViewProps = {
  puzzle: RunPuzzleFull
  ctrl: BoardPageControllerResult
  runIdStr: string
}

export function BoardFocusView({ puzzle, ctrl, runIdStr }: BoardFocusViewProps): React.ReactElement {
  const { board, timer, session, participationId, actions } = ctrl
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

  return (
    <div className="flex flex-1 items-center justify-center overflow-hidden px-6">
      <div className="flex w-full items-start gap-6">
        <aside className="hidden flex-1 flex-col md:flex" style={{ height: board.boardSize }}>
          <BoardBreadcrumbs puzzle={puzzle} participationId={participationId} runIdStr={runIdStr} linksDisabled={true} />
          <div className="mb-6" />
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
