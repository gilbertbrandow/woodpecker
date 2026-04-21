import * as React from 'react'
import { Badge } from '../../components/ui/badge'
import { ATTEMPT_STATUS_CLASS, ATTEMPT_STATUS_LABEL } from './boardPage.helpers'
import { formatSolveTimeMs } from '../../lib/utils'
import type { RunPuzzleFull } from '../../lib/api'

type OverviewAttemptHistoryProps = {
  freshPuzzle: RunPuzzleFull
}

export function OverviewAttemptHistory({ freshPuzzle }: OverviewAttemptHistoryProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      {freshPuzzle.tries.map((attempt, idx) => (
        <React.Fragment key={attempt.id}>
          {freshPuzzle.maxTriesPerPuzzle > 1 && idx === freshPuzzle.maxTriesPerPuzzle && (
            <div className="my-1 flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">Practice</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-xs text-muted-foreground">Try {attempt.tryNumber}</span>
            <Badge variant="outline" className={`text-xs ${ATTEMPT_STATUS_CLASS[attempt.status] ?? ''}`}>
              {ATTEMPT_STATUS_LABEL[attempt.status] ?? attempt.status}
            </Badge>
            <span className="ml-auto tabular-nums text-xs text-muted-foreground">
              {attempt.timeSpentMs !== null ? formatSolveTimeMs(attempt.timeSpentMs) : '—'}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}
