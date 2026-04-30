import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import type { SessionAttemptHistoryItem } from '../context/solveSession'

const FAILED_PULSE_WINDOW_MS = 1800

const BASE_STATUS_CLASS: Record<SessionAttemptHistoryItem['status'], string> = {
  ongoing: 'bg-sky-500',
  solved: 'bg-green-500',
  failed: 'bg-red-500',
}

const STATUS_LABEL: Record<SessionAttemptHistoryItem['status'], string> = {
  ongoing: 'Ongoing',
  solved: 'Solved',
  failed: 'Failed',
}

type SessionAttemptStripProps = {
  items: SessionAttemptHistoryItem[]
  runId: string
  activeAttemptId?: number | null
  interactive?: boolean
  maxVisible?: number
}

export function SessionAttemptStrip({ items, runId, activeAttemptId, interactive = true, maxVisible = 20 }: SessionAttemptStripProps): React.ReactElement | null {
  const visibleItems = React.useMemo(() => items.slice(-maxVisible), [items, maxVisible])
  const [now, setNow] = React.useState<number>(() => Date.now())

  React.useEffect(() => {
    const pendingFailedItems = visibleItems.filter(
      (item) => item.status === 'failed' && item.finishedAt !== undefined && now < item.finishedAt + FAILED_PULSE_WINDOW_MS,
    )

    if (pendingFailedItems.length === 0) return

    const nextDeadline = Math.min(...pendingFailedItems.map((item) => (item.finishedAt ?? now) + FAILED_PULSE_WINDOW_MS))
    const delayMs = Math.max(0, nextDeadline - now)

    const timeoutId = window.setTimeout(() => {
      setNow(Date.now())
    }, delayMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [visibleItems, now])

  if (visibleItems.length === 0) {
    return null
  }

  return (
    <div className="mt-3 h-6 w-full">
      <div className="flex h-6 items-center gap-1 overflow-hidden pl-0.5">
        {visibleItems.map((item) => {
          const statusLabel = STATUS_LABEL[item.status]
          const tooltip = `Attempt for puzzle ${item.puzzlePosition}: ${statusLabel}`
          const isFreshFailed =
            item.status === 'failed' &&
            item.finishedAt !== undefined &&
            now < item.finishedAt + FAILED_PULSE_WINDOW_MS

          const isOngoing = item.status === 'ongoing'
          const dotColorClass = isOngoing
            ? 'bg-sky-400'
            : isFreshFailed
              ? 'bg-red-400'
              : BASE_STATUS_CLASS[item.status]
          const isPulsing = isOngoing || isFreshFailed
          const isActive = item.attemptId === activeAttemptId
          const isClickable = interactive && !isActive && !isOngoing

          const wrapperClassName = [
            'group flex h-4 w-4 items-center justify-center rounded-full transition',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground',
            isActive
              ? 'ring-1 ring-foreground/50 cursor-default'
              : isClickable
                ? 'data-[state=closed]:ring-0 data-[state=delayed-open]:ring-1 data-[state=delayed-open]:ring-foreground hover:ring-1 hover:ring-foreground'
                : 'cursor-default pointer-events-none',
          ].join(' ')

          const dot = (
            <span
              className={`rounded-full transition-all duration-150 ${isActive ? 'h-1.5 w-1.5' : `h-2.5 w-2.5 ${isClickable ? 'group-hover:h-1.5 group-hover:w-1.5' : ''}`} ${dotColorClass}`}
              style={isPulsing ? { animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite' } : undefined}
            />
          )

          const trigger = isClickable ? (
            <Link
              to="/app/runs/$runId/puzzles/$runPuzzleId/overview"
              params={{ runId, runPuzzleId: String(item.runPuzzleId) }}
              search={{ attempt: item.attemptId }}
              aria-label={tooltip}
              className={wrapperClassName}
            >
              {dot}
            </Link>
          ) : (
            <span role="img" aria-label={tooltip} className={wrapperClassName}>
              {dot}
            </span>
          )

          return (
            <Tooltip key={item.attemptId} delayDuration={70} disableHoverableContent={true}>
              <TooltipTrigger asChild>
                {trigger}
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}