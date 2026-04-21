import * as React from 'react'
import { Check, X } from 'lucide-react'
import type { MoveFeedbackResult, Orientation } from './boardPage.helpers'

type MoveStatusCardProps = {
  lastMoveResult: MoveFeedbackResult | null
  turnToMove: Orientation
  kingPieceUrl: string
}

export function MoveStatusCard({ lastMoveResult, turnToMove, kingPieceUrl }: MoveStatusCardProps): React.ReactElement {
  const turnLabel = turnToMove === 'white' ? 'White' : 'Black'

  const title = lastMoveResult === 'correct'
    ? 'Correct, continue'
    : lastMoveResult === 'wrong'
      ? 'Wrong, try again'
      : `${turnLabel} to move`

  const help = lastMoveResult === 'correct'
    ? 'Great move. Stay sharp for the next position.'
    : lastMoveResult === 'wrong'
      ? 'Try another idea from this position.'
      : `Find the best move for ${turnToMove}.`

  const icon = lastMoveResult === 'correct'
    ? (
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-600/35 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/35 dark:bg-emerald-400/15 dark:text-emerald-300">
        <Check className="h-6 w-6" strokeWidth={2.75} />
      </span>
    )
    : lastMoveResult === 'wrong'
      ? (
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-600/35 bg-red-500/15 text-red-700 dark:border-red-400/35 dark:bg-red-400/15 dark:text-red-300">
          <X className="h-6 w-6" strokeWidth={2.75} />
        </span>
      )
      : (
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white">
          <img
            src={kingPieceUrl}
            alt={`${turnLabel} king`}
            className="h-9 w-9 object-contain"
            draggable={false}
          />
        </span>
      )

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
