import * as React from 'react'
import { Badge } from '../../components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'
import { formatTargetSolveTime } from './boardPage.helpers'

type TimerCardProps = {
  timerText: string
  elapsedTenths: number
  targetSolveTenths: number | null
  muted?: boolean
}

export function TimerCard({ timerText, elapsedTenths, targetSolveTenths, muted = false }: TimerCardProps): React.ReactElement {
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
    <div className="min-h-24 rounded-md px-3 py-3">
      <div className="flex min-h-16 flex-col items-start justify-center">
        <div className="inline-flex flex-col items-start">
          <div className="flex items-center gap-2">
            <span className={`tabular-nums text-3xl font-semibold leading-none ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>
              {timerText}
            </span>
            {isExpired && (
              <Badge variant="secondary" className="h-6 rounded-sm px-2 text-[11px] font-medium">
                Target time missed
              </Badge>
            )}
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
