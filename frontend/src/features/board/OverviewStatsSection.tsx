import * as React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'
import { DeltaBadge } from './DeltaBadge'
import { formatSolveTimeMs } from '../../lib/utils'
import type { StatsResult } from './boardPage.helpers'

type OverviewStatsSectionProps = {
  afterStats: StatsResult
  accuracyDelta: number | null
  timeDelta: number | null
  runIndex: number
}

export function OverviewStatsSection({ afterStats, accuracyDelta, timeDelta, runIndex }: OverviewStatsSectionProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <span>Run {runIndex + 1} stats</span>
      <div className="flex gap-6">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex cursor-default flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Average accuracy</span>
              <div className="flex items-baseline gap-2">
                <span className="tabular-nums text-2xl font-semibold">
                  {afterStats.accuracy !== null ? `${afterStats.accuracy.toFixed(1)}%` : '—'}
                </span>
                <DeltaBadge delta={accuracyDelta} goodWhenPositive={true} format={(n) => `${n.toFixed(1)}%`} />
              </div>
            </div>
          </TooltipTrigger>
          {afterStats.resolvedCount > 0 && (
            <TooltipContent>
              {afterStats.solvedCount} of {afterStats.resolvedCount} resolved
            </TooltipContent>
          )}
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex cursor-default flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Average solve time</span>
              <div className="flex items-baseline gap-2">
                <span className="tabular-nums text-2xl font-semibold">
                  {afterStats.avgTimeMs !== null ? formatSolveTimeMs(afterStats.avgTimeMs) : '—'}
                </span>
                <DeltaBadge delta={timeDelta} goodWhenPositive={false} format={formatSolveTimeMs} />
              </div>
            </div>
          </TooltipTrigger>
          {afterStats.timeCount > 0 && (
            <TooltipContent>
              across {afterStats.timeCount} solved puzzle{afterStats.timeCount !== 1 ? 's' : ''}
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </div>
  )
}
