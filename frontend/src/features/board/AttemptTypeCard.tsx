import * as React from 'react'
import { CircleOff } from 'lucide-react'
import type { AttemptSummary } from '../../lib/api'

type AttemptTypeCardProps = {
  currentTryNumber: number
  maxTriesPerPuzzle: number
  tries: AttemptSummary[]
}

export function AttemptTypeCard({ currentTryNumber, maxTriesPerPuzzle, tries }: AttemptTypeCardProps): React.ReactElement {
  const isPractice =
    currentTryNumber > maxTriesPerPuzzle ||
    tries.some((t) => t.status === 'solved' && t.tryNumber < currentTryNumber)

  if (isPractice) {
    return (
      <div className="rounded-lg border p-4 border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-600/30">
        <div className="flex items-center gap-2">
          <CircleOff className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">Practice attempt</span>
        </div>
        <p className="mt-1.5 text-xs opacity-75">This attempt won't count towards your score.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <span className="text-sm font-medium">Scored</span>
      {maxTriesPerPuzzle > 1 && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Attempt {currentTryNumber} of {maxTriesPerPuzzle}
        </p>
      )}
    </div>
  )
}
