import * as React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'
import { formatTimeRemaining } from './boardPage.helpers'
import type { RunPaceResult } from './boardPage.helpers'

type RunPaceCardProps = {
  pace: RunPaceResult
}

const PACE_VALUE_CLASS: Record<RunPaceResult['status'], string> = {
  ahead: 'tabular-nums text-2xl font-semibold',
  on_pace: 'tabular-nums text-2xl font-semibold',
  behind: 'tabular-nums text-2xl font-semibold',
}

function paceValue(pace: RunPaceResult): string {
  if (pace.status === 'on_pace') return 'On pace'
  if (pace.status === 'ahead') return `+${pace.puzzleDelta}`
  return `\u2212${pace.puzzleDelta}`
}

function paceTooltip(pace: RunPaceResult): string {
  const s = pace.puzzleDelta === 1 ? '' : 's'
  if (pace.status === 'on_pace') return 'You are on pace with the schedule'
  if (pace.status === 'ahead') return `You are ${pace.puzzleDelta} puzzle${s} ahead of schedule`
  return `Solve ${pace.puzzleDelta} more puzzle${s} to get back on pace`
}

export function RunPaceCard({ pace }: RunPaceCardProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <span>Pace</span>
      <div className="flex flex-col gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex cursor-default flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Pace</span>
              <div className="flex items-baseline gap-2">
                <span className={PACE_VALUE_CLASS[pace.status]}>
                  {paceValue(pace)}
                </span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">{paceTooltip(pace)}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex cursor-default flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Time remaining</span>
              <div className="flex items-baseline gap-2">
                {pace.timeRemainingHours > 0 ? (
                  <span className="tabular-nums text-2xl font-semibold">
                    {formatTimeRemaining(pace.timeRemainingHours)}
                  </span>
                ) : (
                  <span className="tabular-nums text-2xl font-semibold text-destructive">
                    Overdue
                  </span>
                )}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            {`Deadline: ${new Date(pace.deadlineIso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
