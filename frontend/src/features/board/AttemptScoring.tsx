import * as React from 'react'
import { Badge } from '../../components/ui/badge'
import { positionStatusLabel } from './boardPage.helpers'
import type { PositionStatus } from '../../lib/api'

type AttemptScoringProps = {
  currentTryNumber: number
  maxTriesPerPuzzle: number
  positionStatus: PositionStatus
  attemptActive: boolean
}

export function AttemptScoring({ currentTryNumber, maxTriesPerPuzzle, positionStatus, attemptActive }: AttemptScoringProps): React.ReactElement | null {
  const withinWindow = currentTryNumber <= maxTriesPerPuzzle

  if (!withinWindow) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Practice attempt</span>
        <Badge variant="outline" className="w-fit text-xs">{positionStatusLabel(positionStatus)}</Badge>
        <span className="text-xs text-muted-foreground">Won't affect your score.</span>
      </div>
    )
  }

  if (maxTriesPerPuzzle <= 1) return null

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        Attempt {currentTryNumber} / {maxTriesPerPuzzle}
      </span>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: maxTriesPerPuzzle }).map((_, i) => {
          const n = i + 1
          const isUsed = n < currentTryNumber || (n === currentTryNumber && !attemptActive)
          const isCurrent = n === currentTryNumber && attemptActive
          return (
            <div
              key={i}
              className={`rounded-full ${
                isUsed
                  ? 'h-2 w-2 bg-foreground/35'
                  : isCurrent
                    ? 'h-2.5 w-2.5 bg-foreground'
                    : 'h-2 w-2 bg-foreground/10'
              }`}
            />
          )
        })}
      </div>
    </div>
  )
}
