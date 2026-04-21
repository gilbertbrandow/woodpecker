import * as React from 'react'
import { BoardSurface } from './BoardSurface'
import { SessionAttemptStrip } from '../../components/SessionAttemptStrip'
import type { BoardSurfaceProps } from './BoardSurface'
import type { BoardState, BoardPageActions } from './useBoardPageController'
import type { SessionAttemptHistoryItem } from '../../context/solveSession'

type BoardCenterColumnProps = {
  board: BoardState
  actions: BoardPageActions
  attemptHistory: SessionAttemptHistoryItem[]
  mobileHeader?: React.ReactNode
  mobileExtras?: React.ReactNode
}

export function BoardCenterColumn({
  board,
  actions,
  attemptHistory,
  mobileHeader,
  mobileExtras,
}: BoardCenterColumnProps): React.ReactElement {
  const boardSurfaceProps: BoardSurfaceProps = {
    boardKey: board.boardKey,
    boardSize: board.boardSize,
    fen: board.fen,
    orientation: board.orientation,
    dests: board.dests,
    lastMove: board.lastMove,
    hintSquare: board.hintSquare,
    pendingPromotion: board.pendingPromotion,
    moveFeedback: board.moveFeedback,
    onMove: actions.handleUserMove,
    onPromotionSelect: actions.onPromotionPieceSelected,
    onPromotionCancel: actions.onPromotionCancel,
  }

  return (
    <div className="flex shrink-0 flex-col">
      {mobileHeader && (
        <div className="mb-3 md:hidden">
          {mobileHeader}
        </div>
      )}
      <BoardSurface {...boardSurfaceProps} />
      <SessionAttemptStrip items={attemptHistory} />
      {mobileExtras && (
        <div className="md:hidden">
          {mobileExtras}
        </div>
      )}
    </div>
  )
}
