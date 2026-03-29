import * as React from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'

type ProgressBarProps = {
  value: number
  tooltipLabel: string
  className?: string
}

export function ProgressBar({
  value,
  tooltipLabel,
  className = 'w-32',
}: ProgressBarProps): React.ReactElement {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <div
          className={`${className} shrink-0 cursor-default`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-1.5 rounded-full bg-foreground/15">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${clamped}%`, backgroundColor: 'hsl(var(--chart-1))' }}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>{tooltipLabel}</TooltipContent>
    </Tooltip>
  )
}
