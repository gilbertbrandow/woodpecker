import * as React from 'react'
import { Zap, Compass, Fish } from 'lucide-react'
import { cn } from '../lib/utils'
import { type TrainingItemSource } from '../lib/api'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'

export type TrainingItemType = 'tactic' | 'positional' | 'decoy'

const SOURCE_TO_TYPE: Record<TrainingItemSource, TrainingItemType> = {
  LICHESS_TACTIC: 'tactic',
  SCRAPED_POSITIONAL: 'positional',
  DECOY: 'decoy',
}

type BadgeConfig = {
  label: string
  tooltip: string
  className: string
  icon: React.ReactElement
}

const BADGE_CONFIG: Record<TrainingItemType, BadgeConfig> = {
  tactic: {
    label: 'Tactical',
    tooltip: 'There exists a short sequence of forcing moves that achieves an immediate advantage.',
    className: 'border-cyan-500/40 bg-cyan-100 text-cyan-900 dark:bg-cyan-900/30 dark:text-cyan-300',
    icon: <Zap className="h-3 w-3" />,
  },
  positional: {
    label: 'Positional',
    tooltip: 'There exists a clear best move, but for strategic rather than tactical reasons.',
    className: 'border-indigo-500/40 bg-indigo-100 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-300',
    icon: <Compass className="h-3 w-3" />,
  },
  decoy: {
    label: 'Decoy',
    tooltip: 'A quiet position with no decisive move, included to train resisting the urge to force something when nothing is there.',
    className: 'border-sky-600/30 bg-sky-50 text-sky-800 dark:bg-sky-900/20 dark:text-sky-400',
    icon: <Fish className="h-3 w-3" />,
  },
}

type TrainingItemTypeBadgeProps = {
  source?: TrainingItemSource
  itemType?: TrainingItemType
  className?: string
}

export function TrainingItemTypeBadge({ source, itemType, className }: TrainingItemTypeBadgeProps): React.ReactElement | null {
  const resolvedType = itemType ?? (source !== undefined ? SOURCE_TO_TYPE[source] : undefined)
  if (!resolvedType) return null

  const config = BADGE_CONFIG[resolvedType]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap cursor-default',
            config.className,
            className,
          )}
        >
          {config.icon}
          {config.label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-56">{config.tooltip}</TooltipContent>
    </Tooltip>
  )
}
