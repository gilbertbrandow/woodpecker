import * as React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'
import { DeltaBadge } from './DeltaBadge'
import { formatSolveTimeMs } from '../../lib/utils'
import type { RunTrainingItemOverview } from '../../lib/api'

type OverviewStatsSectionProps = {
  accuracy: RunTrainingItemOverview['stats']['accuracy']
  averageSolveTime: RunTrainingItemOverview['stats']['averageSolveTime']
}

export function OverviewStatsSection({ accuracy, averageSolveTime }: OverviewStatsSectionProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <span>Averages</span>
      <div className="flex flex-row justify-between">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex cursor-default flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Accuracy (%)</span>
              <div className="flex items-baseline gap-2">
                <span className="tabular-nums text-2xl font-semibold">
                  {accuracy.valuePct !== null ? `${accuracy.valuePct.toFixed(2)}` : '—'}
                </span>
                <DeltaBadge delta={accuracy.deltaPct} goodWhenPositive={true} format={(n) => `${n.toFixed(2)}`} />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {accuracy.resolvedCount > 0
              ? `${accuracy.solvedCount} of ${accuracy.resolvedCount} resolved`
              : null}
          </TooltipContent>
        </Tooltip>
        <div className="flex cursor-default flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Solve time (mm:ss)</span>
          <div className="flex items-baseline gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="tabular-nums text-2xl font-semibold">
                  {averageSolveTime.valueMs !== null ? formatSolveTimeMs(averageSolveTime.valueMs) : '—'}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {averageSolveTime.timeCount > 0
                  ? `across ${averageSolveTime.timeCount} solved puzzle${averageSolveTime.timeCount !== 1 ? 's' : ''}`
                  : null}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <DeltaBadge delta={averageSolveTime.deltaMs} goodWhenPositive={false} format={formatSolveTimeMs} />
                </span>
              </TooltipTrigger>
              <TooltipContent>Solve time compared to your average for this run</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}
