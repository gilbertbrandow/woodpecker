import * as React from 'react'
import { Clock } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'

type TimerCardProps = {
  timerText: string
  elapsedTenths: number
  targetSolveTenths: number | null
  muted?: boolean
  rightSlot?: React.ReactNode
}

export function TimerCard({ timerText, elapsedTenths, targetSolveTenths, muted = false, rightSlot }: TimerCardProps): React.ReactElement {
  const hasTarget = targetSolveTenths !== null && targetSolveTenths > 0
  const isExpired = hasTarget && elapsedTenths >= targetSolveTenths

  return (
    <div className="rounded-md px-3 py-3">
      <div className="flex items-center gap-2">
        <span className={`tabular-nums text-3xl font-semibold leading-none ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>
          {timerText}
        </span>
        {isExpired && (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-default items-center gap-1 rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                <Clock className="h-3 w-3" />
                Time
              </span>
            </TooltipTrigger>
            <TooltipContent>Target time missed</TooltipContent>
          </Tooltip>
        )}
        {rightSlot}
      </div>
    </div>
  )
}
