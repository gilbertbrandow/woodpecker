import * as React from 'react'
import { Check, X } from 'lucide-react'
import type { MoveFeedbackResult, Orientation } from './boardPage.helpers'

type MoveStatusCardProps = {
  lastMoveResult: MoveFeedbackResult | null
  turnToMove: Orientation
  kingPieceUrl: string
  darkKingPieceUrl: string
  compact?: boolean
}

export function MoveStatusCard({ lastMoveResult, turnToMove, kingPieceUrl, darkKingPieceUrl, compact = false }: MoveStatusCardProps): React.ReactElement {
  const turnLabel = turnToMove === 'white' ? 'White' : 'Black'

  const title = lastMoveResult === 'correct'
    ? 'Correct move'
    : lastMoveResult === 'wrong'
      ? 'Wrong, try again'
      : `${turnLabel} to move`

  const help = lastMoveResult === 'correct'
    ? 'Find the next move...'
    : lastMoveResult === 'wrong'
      ? 'Try another move in the position.'
      : `Find the best move for ${turnToMove}.`

  const bgClass = lastMoveResult === 'correct'
    ? 'border-emerald-600/20 bg-emerald-500/8'
    : lastMoveResult === 'wrong'
      ? 'border-red-600/20 bg-red-500/8'
      : 'border-border bg-muted/30'

  const icon = lastMoveResult === 'correct'
    ? (
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-600/30 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
        <Check className="h-4 w-4" strokeWidth={2.5} />
      </span>
    )
    : lastMoveResult === 'wrong'
      ? (
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-600/30 bg-red-500/20 text-red-700 dark:text-red-300">
          <X className="h-4 w-4" strokeWidth={2.5} />
        </span>
      )
      : (
        <>
          <img
            src={kingPieceUrl}
            alt={`${turnLabel} king`}
            className="h-10 w-10 shrink-0 object-contain transition-opacity duration-150 dark:hidden"
            draggable={false}
          />
          <img
            src={darkKingPieceUrl}
            alt={`${turnLabel} king`}
            className="hidden h-10 w-10 shrink-0 object-contain transition-opacity duration-150 dark:block dark:[filter:grayscale(1)_brightness(1.3)_invert(1)]"
            draggable={false}
          />
        </>
      )

  if (compact) {
    return (
      <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${bgClass}`}>
        {icon}
        <span className="text-sm font-medium leading-tight">{title}</span>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border px-3 py-4 ${bgClass}`}>
      <div className="flex items-center gap-3">
        {icon}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-semibold leading-tight">{title}</span>
          <span className="text-xs text-muted-foreground leading-tight">{help}</span>
        </div>
      </div>
    </div>
  )
}
