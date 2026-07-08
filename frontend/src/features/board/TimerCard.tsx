import * as React from 'react'
import { ClockArrowUp, ClockArrowDown } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'

type TimerCardProps = {
  timerText: string
  elapsedTenths: number
  targetMinSolveTenths: number | null
  targetMaxSolveTenths: number | null
  muted?: boolean
  rightSlot?: React.ReactNode
}

export function TimerCard({ timerText, elapsedTenths, targetMinSolveTenths, targetMaxSolveTenths, muted = false, rightSlot }: TimerCardProps): React.ReactElement {
  const hasMax = targetMaxSolveTenths !== null && targetMaxSolveTenths > 0
  const isHashy = targetMinSolveTenths !== null && targetMinSolveTenths > 0 && elapsedTenths < targetMinSolveTenths
  const isExpired = hasMax && elapsedTenths >= targetMaxSolveTenths

  return (
    <div className="rounded-md px-3 py-3">
      <div className="flex items-center gap-2">
        <span className={`tabular-nums text-3xl font-semibold leading-none ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>
          {timerText}
        </span>
        {isHashy && (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-default items-center gap-1 rounded-full border border-stone-400/30 bg-stone-500/10 px-2 py-0.5 text-xs font-medium text-stone-600 dark:text-stone-400">
                <ClockArrowUp className="h-3 w-3" />
                Hasty
              </span>
            </TooltipTrigger>
            <TooltipContent>Solving faster than minimum target time</TooltipContent>
          </Tooltip>
        )}
        {isExpired && (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-default items-center gap-1 rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                <ClockArrowDown className="h-3 w-3" />
                Too slow
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
