import * as React from 'react'
import { Clock } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'
import { formatTargetSolveTime } from './boardPage.helpers'

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
  const shouldShowBar = hasTarget && !isExpired
  const rawLeftPct = hasTarget ? ((targetSolveTenths - elapsedTenths) / targetSolveTenths) * 100 : 0
  const leftPct = Math.max(0, Math.min(100, rawLeftPct))
  const targetText = hasTarget ? formatTargetSolveTime(targetSolveTenths) : ''
  const progressHue = leftPct >= 60
    ? 60 + ((leftPct - 60) / 40) * 60
    : leftPct >= 20
      ? ((leftPct - 20) / 40) * 60
      : 0
  const progressColor = `hsl(${progressHue} 55% 48%)`

  return (
    <div className={`rounded-md px-3 py-3 ${hasTarget ? 'min-h-24' : ''}`}>
      <div className={`flex flex-col items-start justify-center ${hasTarget ? 'min-h-16' : ''}`}>
        <div className="inline-flex flex-col items-start">
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
          {hasTarget && (
            <div className="mt-3 h-1.5 w-full max-w-full">
              {shouldShowBar && (
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <div className="w-full cursor-default">
                      <div className="h-1.5 bg-foreground/15">
                        <div
                          className="ml-auto h-full transition-[width,background-color] duration-100 ease-linear"
                          style={{ width: `${leftPct}%`, backgroundColor: progressColor }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {`Target solve time: ${targetText}. This bar shows how much of that time is remaining.`}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
