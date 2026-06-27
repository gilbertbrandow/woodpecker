import * as React from 'react'
import { Zap, Compass } from 'lucide-react'

function ScarecrowIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512.002 512.002"
      fill="currentColor"
      className={className}
    >
      <path d="m456.016 212.5h-25.002l13.999-10.496c6.628-4.972 7.972-14.373 3.002-21s-14.373-7.973-21-3.002l-26.006 19.5v-7.5c0-8.284-6.716-15-15-15h-72.454c8.025-11.424 12.756-25.322 12.756-40.312 0-10.365-2.33-20.488-6.634-29.687h1.222c.031 0 .062.004.094.004.04 0 .08-.004.121-.004h24.89c8.284 0 15-6.716 15-15s-6.716-15-15-15h-13.478l-17.032-63.863c-2.071-7.769-9.904-12.524-17.747-10.777l-41.746 9.276-41.746-9.276c-7.849-1.742-15.676 3.01-17.747 10.777l-17.032 63.863h-13.477c-8.284 0-15 6.716-15 15s6.716 15 15 15h26.326c-4.304 9.199-6.634 19.323-6.634 29.687 0 14.99 4.73 28.889 12.756 40.312h-72.454c-8.284 0-15 6.716-15 15v7.5l-26.006-19.5c-6.626-4.971-16.028-3.625-21 3.002-4.97 6.627-3.626 16.028 3.002 21l13.998 10.496h-25.002c-8.284 0-15 6.716-15 15s6.716 15 15 15h25.004l-14.001 10.5c-6.628 4.97-7.972 14.372-3.001 20.999 2.946 3.93 7.451 6.003 12.012 6.003 3.132 0 6.29-.979 8.987-3.002l26.006-19.502v7.502c0 8.284 6.716 15 15 15h38.752l-8.698 108.139c-.335 4.174 1.089 8.298 3.929 11.375s6.836 4.827 11.024 4.827h70.003v77.661h-25.25c-8.284 0-15 6.716-15 15s6.716 15 15 15h80.5c8.284 0 15-6.716 15-15s-6.716-15-15-15h-25.25v-77.661h70.003c.008.001.016.001.02 0 8.285 0 15-6.716 15-15 0-.68-.045-1.35-.133-2.005l-8.634-107.336h38.752c8.284 0 15-6.716 15-15v-7.502l26.005 19.502c2.698 2.025 5.855 3.002 8.987 3.002 4.561 0 9.065-2.073 12.012-6.003 4.971-6.627 3.627-16.029-3.001-20.999l-14.001-10.5h25.004c8.284 0 15-6.716 15-15s-6.715-15-15-15zm-234.228-179.734 30.959 6.88c2.143.477 4.365.477 6.508 0l30.959-6.88 11.265 42.235h-90.955zm-6.098 101.923c0-11.286 4.834-22.083 13.109-29.687h54.402c8.275 7.605 13.109 18.402 13.109 29.687 0 22.229-18.083 40.312-40.31 40.312s-40.31-18.083-40.31-40.312zm155.32 115.311h-40.007c-4.188 0-8.184 1.75-11.023 4.827-2.84 3.077-4.264 7.201-3.929 11.375l8.698 108.139h-137.496l8.698-108.139c.335-4.174-1.089-8.298-3.929-11.375s-6.836-4.827-11.023-4.827h-40.007v-44.998h100.009v31c0 8.284 6.716 15 15 15s15-6.716 15-15v-31h100.009z" />
    </svg>
  )
}
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
    tooltip: 'There exists between 3-6 valid moves in a quiet position that all give roughly the same evaluation.',
    className: 'border-amber-500/40 bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300',
    icon: <ScarecrowIcon className="h-3 w-3" />,
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
  if (!config) return null
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
