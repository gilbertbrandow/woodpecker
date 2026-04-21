import * as React from 'react'
import { DeltaBadge } from './DeltaBadge'
import { formatSolveTimeMs } from '../../lib/utils'
import type { StatsResult } from './boardPage.helpers'

type OverviewStatsSectionProps = {
  afterStats: StatsResult
  accuracyDelta: number | null
  timeDelta: number | null
}

export function OverviewStatsSection({ afterStats, accuracyDelta, timeDelta }: OverviewStatsSectionProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Accuracy</span>
        <div className="flex items-baseline gap-2">
          <span className="tabular-nums text-2xl font-semibold">
            {afterStats.accuracy !== null ? `${afterStats.accuracy.toFixed(1)}%` : '—'}
          </span>
          <DeltaBadge delta={accuracyDelta} goodWhenPositive={true} format={(n) => `${n.toFixed(1)}%`} />
        </div>
        {afterStats.resolvedCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {afterStats.solvedCount} of {afterStats.resolvedCount} resolved
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Avg solve time</span>
        <div className="flex items-baseline gap-2">
          <span className="tabular-nums text-2xl font-semibold">
            {afterStats.avgTimeMs !== null ? formatSolveTimeMs(afterStats.avgTimeMs) : '—'}
          </span>
          <DeltaBadge delta={timeDelta} goodWhenPositive={false} format={formatSolveTimeMs} />
        </div>
        {afterStats.timeCount > 0 && (
          <span className="text-xs text-muted-foreground">
            across {afterStats.timeCount} solved puzzle{afterStats.timeCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}
