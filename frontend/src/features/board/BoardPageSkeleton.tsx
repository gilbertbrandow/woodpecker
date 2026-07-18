import * as React from 'react'
import { Skeleton } from '../../components/ui/skeleton'
import { BoardSurface } from './BoardSurface'
import { BoardPageShell } from './BoardPageShell'
import { computeBoardSize } from './boardPage.helpers'

const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1'
const EMPTY_DESTS = new Map<string, string[]>()
const noop = (): void => {}

function BoardLoadingCenter({ boardSize }: { boardSize: number }): React.ReactElement {
  return (
    <div className="flex shrink-0 flex-col">
      {/* Placeholder for the mobile header (AttemptTypeCard / MobileOverviewMetaBar) */}
      <div className="mt-4 mb-6 lg:hidden" style={{ width: boardSize }}>
        <Skeleton className="h-14 w-full" />
      </div>
      <div className="relative shrink-0" style={{ width: boardSize, height: boardSize }}>
        <BoardSurface
          boardKey={0}
          boardSize={boardSize}
          fen={EMPTY_FEN}
          orientation="white"
          dests={EMPTY_DESTS}
          lastMove={undefined}
          hintSquare={null}
          pendingPromotion={null}
          moveFeedback={{ result: null, square: null, visible: false }}
          onMove={noop}
          onPromotionSelect={noop}
          onPromotionCancel={noop}
        />
      </div>
      <div className="mt-3 h-6" />
    </div>
  )
}

function BoardSkeletonLeft(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

function BoardSkeletonRight(): React.ReactElement {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <Skeleton className="flex-1" />
      <div className="mt-auto flex flex-col gap-3 pt-3">
        <div className="flex gap-3">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 flex-1" />
        </div>
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  )
}

function BoardSkeletonMobileExtras(): React.ReactElement {
  return (
    <>
      <div className="mt-3 flex flex-col gap-2 pb-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-full" />
      </div>
      {/* Skeleton for the Stats & history drawer button */}
      <Skeleton className="h-10 w-full" />
    </>
  )
}

export function BoardPageSkeleton({ boardSize = computeBoardSize() }: { boardSize?: number }): React.ReactElement {
  return (
    <BoardPageShell
      boardSize={boardSize}
      left={<BoardSkeletonLeft />}
      center={<BoardLoadingCenter boardSize={boardSize} />}
      right={<BoardSkeletonRight />}
      mobileExtras={<BoardSkeletonMobileExtras />}
    />
  )
}
