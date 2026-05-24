import * as React from 'react'
import { Check, CheckCheck, Lock, Layers, Clock, XCircle, CheckCircle2, PauseCircle, Timer, PencilLine } from 'lucide-react'
import { cn } from '../lib/utils'

type SubsetStatus = 'draft' | 'filled' | 'locked'
type TrainingStatus = 'draft' | 'in_progress' | 'on_break' | 'break_elapsed' | 'completed' | 'aborted'
type PositionStatus = 'not_started' | 'in_progress' | 'solved' | 'solved_with_retries' | 'failed'

export type StatusValue = SubsetStatus | TrainingStatus | PositionStatus

type StatusConfig = {
  label: string
  className: string
  icon: React.ReactElement | null
}

const STATUS_CONFIG: Record<StatusValue, StatusConfig> = {
  draft: {
    label: 'Draft',
    className: 'border text-foreground bg-transparent',
    icon: <PencilLine className="h-3 w-3" />,
  },
  not_started: {
    label: 'Not started',
    className: 'border text-foreground bg-transparent',
    icon: <Timer className="h-3 w-3" />,
  },
  filled: {
    label: 'Filled',
    className:
      'border-blue-600/30 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    icon: <Layers className="h-3 w-3" />,
  },
  in_progress: {
    label: 'In progress',
    className:
      'border-blue-600/30 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    icon: <Clock className="h-3 w-3" />,
  },
  locked: {
    label: 'Locked',
    className:
      'border-violet-600/30 bg-violet-50 text-violet-800 dark:bg-violet-900/20 dark:text-violet-400',
    icon: <Lock className="h-3 w-3" />,
  },
  completed: {
    label: 'Completed',
    className:
      'border-green-600/30 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  solved: {
    label: 'Solved',
    className:
      'border-green-600/30 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    icon: <Check className="h-3 w-3" />,
  },
  solved_with_retries: {
    label: 'Solved (retries)',
    className:
      'border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
    icon: <CheckCheck className="h-3 w-3" />,
  },
  failed: {
    label: 'Failed',
    className:
      'border-red-600/30 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    icon: <XCircle className="h-3 w-3" />,
  },
  aborted: {
    label: 'Aborted',
    className:
      'border-red-600/30 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    icon: <XCircle className="h-3 w-3" />,
  },
  on_break: {
    label: 'On break',
    className:
      'border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
    icon: <PauseCircle className="h-3 w-3" />,
  },
  break_elapsed: {
    label: 'Break elapsed',
    className:
      'border-orange-600/30 bg-orange-50 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    icon: <Clock className="h-3 w-3" />,
  },
}

type StatusBadgeProps = {
  status: StatusValue
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps): React.ReactElement {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        config.className,
        className,
      )}
    >
      {config.icon}
      {config.label}
    </span>
  )
}
