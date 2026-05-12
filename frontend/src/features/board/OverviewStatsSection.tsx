import * as React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'
import { DeltaBadge } from './DeltaBadge'
import { formatSolveTimeMs } from '../../lib/utils'
import type { RunTrainingItemOverview } from '../../lib/api'

type OverviewStatsSectionProps = {
  runIndex: number
  accuracy: RunTrainingItemOverview['stats']['accuracy']
  averageSolveTime: RunTrainingItemOverview['stats']['averageSolveTime']
}

export function OverviewStatsSection({ runIndex, accuracy, averageSolveTime }: OverviewStatsSectionProps): React.ReactElement {
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
                  {accuracy.valuePct !== null ? `${accuracy.valuePct.toFixed(1)}%` : '—'}
                </span>
                <DeltaBadge delta={accuracy.deltaPct} goodWhenPositive={true} format={(n) => `${n.toFixed(1)}%`} />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {accuracy.resolvedCount > 0
              ? `${accuracy.solvedCount} of ${accuracy.resolvedCount} resolved`
              : null}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex cursor-default flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Average solve time</span>
              <div className="flex items-baseline gap-2">
                <span className="tabular-nums text-2xl font-semibold">
                  {averageSolveTime.valueMs !== null ? formatSolveTimeMs(averageSolveTime.valueMs) : '—'}
                </span>
                <DeltaBadge delta={averageSolveTime.deltaMs} goodWhenPositive={false} format={formatSolveTimeMs} />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {averageSolveTime.timeCount > 0
              ? `across ${averageSolveTime.timeCount} solved puzzle${averageSolveTime.timeCount !== 1 ? 's' : ''}`
              : null}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
