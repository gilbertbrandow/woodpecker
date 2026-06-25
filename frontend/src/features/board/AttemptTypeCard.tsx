import * as React from 'react'
import { CircleOff, Lightbulb } from 'lucide-react'

type AttemptTypeCardProps = {
  isPractice: boolean
  currentTryNumber: number
  maxTriesPerPuzzle: number
  compact?: boolean
}

export function AttemptTypeCard({ isPractice, currentTryNumber, maxTriesPerPuzzle, compact = false }: AttemptTypeCardProps): React.ReactElement {
  if (isPractice) {
    return (
      <div className={`rounded-lg border border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-600/30 ${compact ? 'px-3 py-2' : 'p-4'}`}>
        <div className="flex items-center gap-2">
          <CircleOff className={`shrink-0 ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
          <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'}`}>Practice attempt</span>
        </div>
        <p className={`opacity-75 ${compact ? 'mt-1 text-[10px]' : 'mt-1.5 text-xs'}`}>This attempt won't count towards your score.</p>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border border-border bg-transparent text-foreground ${compact ? 'px-3 py-2' : 'p-4'}`}>
      <div className="flex items-center gap-2">
        <Lightbulb className={`shrink-0 ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
        <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'}`}>Scored attempt</span>
      </div>
      <p className={`opacity-75 ${compact ? 'mt-1 text-[10px]' : 'mt-1.5 text-xs'}`}>
        {maxTriesPerPuzzle > 1
          ? `Attempt ${currentTryNumber} of ${maxTriesPerPuzzle}`
          : 'This attempt will count towards your score.'}
      </p>
    </div>
  )
}
