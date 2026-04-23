import * as React from 'react'
import { Check, X } from 'lucide-react'
import type { MoveFeedbackResult, Orientation } from './boardPage.helpers'

type MoveStatusCardProps = {
  lastMoveResult: MoveFeedbackResult | null
  turnToMove: Orientation
  kingPieceUrl: string
  compact?: boolean
}

export function MoveStatusCard({ lastMoveResult, turnToMove, kingPieceUrl, compact = false }: MoveStatusCardProps): React.ReactElement {
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

  const iconSize = compact ? 'h-7 w-7' : 'h-11 w-11'
  const iconInner = compact ? 'h-4 w-4' : 'h-6 w-6'
  const imgSize = compact ? 'h-6 w-6' : 'h-9 w-9'

  const icon = lastMoveResult === 'correct'
    ? (
      <span className={`inline-flex ${iconSize} items-center justify-center rounded-full border border-emerald-600/35 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/35 dark:bg-emerald-400/15 dark:text-emerald-300`}>
        <Check className={iconInner} strokeWidth={2.75} />
      </span>
    )
    : lastMoveResult === 'wrong'
      ? (
        <span className={`inline-flex ${iconSize} items-center justify-center rounded-full border border-red-600/35 bg-red-500/15 text-red-700 dark:border-red-400/35 dark:bg-red-400/15 dark:text-red-300`}>
          <X className={iconInner} strokeWidth={2.75} />
        </span>
      )
      : (
        <span className={`inline-flex ${iconSize} items-center justify-center rounded-full bg-white`}>
          <img
            src={kingPieceUrl}
            alt={`${turnLabel} king`}
            className={`${imgSize} object-contain`}
            draggable={false}
          />
        </span>
      )

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
        {icon}
        <span className="text-sm font-medium leading-tight">{title}</span>
      </div>
    )
  }

  return (
    <div className="min-h-24 rounded-md border border-border px-3 py-3 text-foreground">
      <div className="flex min-h-16 items-center gap-3">
        {icon}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-base font-semibold leading-tight">{title}</span>
          <span className="text-xs text-muted-foreground leading-tight">{help}</span>
        </div>
      </div>
    </div>
  )
}
