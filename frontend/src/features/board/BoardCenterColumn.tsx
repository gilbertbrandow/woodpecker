import * as React from 'react'
import { BoardSurface } from './BoardSurface'
import { SessionAttemptStrip } from '../../components/SessionAttemptStrip'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'
import type { BoardSurfaceProps } from './BoardSurface'
import type { BoardState, BoardPageActions } from './useBoardPageController'
import type { SessionAttemptHistoryItem } from '../../context/solveSession'

type BoardCenterColumnProps = {
  board: BoardState
  actions: BoardPageActions
  attemptHistory: SessionAttemptHistoryItem[]
  runId: string
  activeAttemptId?: number | null
  stripInteractive?: boolean
  stripMaxVisible?: number
  pulseActive?: boolean
  boardAnimationEnabled?: boolean
  mobileHeader?: React.ReactNode
  mobileExtras?: React.ReactNode
  timerBar?: { leftPct: number; color: string; tooltipText: string } | null
  overlay?: React.ReactNode
  spectateLabel?: React.ReactNode
}

export function BoardCenterColumn({
  board,
  actions,
  attemptHistory,
  runId,
  activeAttemptId,
  stripInteractive = true,
  stripMaxVisible = 20,
  pulseActive = false,
  boardAnimationEnabled = true,
  mobileHeader,
  mobileExtras,
  timerBar,
  overlay,
  spectateLabel,
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
    animationEnabled: boardAnimationEnabled,
    onMove: actions.handleUserMove,
    onPromotionSelect: actions.onPromotionPieceSelected,
    onPromotionCancel: actions.onPromotionCancel,
  }

  return (
    <div className="flex shrink-0 flex-col">
      {mobileHeader && (
        <div className="relative z-30 mt-4 mb-6 lg:hidden" style={{ width: board.boardSize }}>
          {mobileHeader}
        </div>
      )}
      <div className="relative shrink-0" style={{ width: board.boardSize }}>
        {spectateLabel && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex -translate-y-full justify-center">
            <div className="pointer-events-auto">{spectateLabel}</div>
          </div>
        )}
        {timerBar && (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <div className="absolute inset-x-0 h-3 cursor-default overflow-hidden rounded-t-[4px]" style={{ bottom: 'calc(100% - 3px)' }}>
                <div
                  className="ml-auto h-full rounded-l-[4px] transition-[width,background-color] duration-100 ease-linear"
                  style={{ width: `${timerBar.leftPct}%`, backgroundColor: timerBar.color }}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>{timerBar.tooltipText}</TooltipContent>
          </Tooltip>
        )}
        <BoardSurface {...boardSurfaceProps} />
        {overlay}
      </div>
      <SessionAttemptStrip items={attemptHistory} runId={runId} activeAttemptId={activeAttemptId} interactive={stripInteractive} maxVisible={stripMaxVisible} pulseActive={pulseActive} />
      {mobileExtras && (
        <div className="lg:hidden">
          {mobileExtras}
        </div>
      )}
    </div>
  )
}
