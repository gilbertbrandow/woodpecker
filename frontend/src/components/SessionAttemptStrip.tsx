import * as React from 'react'
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
  maxVisible?: number
}

export function SessionAttemptStrip({ items, maxVisible = 20 }: SessionAttemptStripProps): React.ReactElement | null {
  const visibleItems = items.slice(-maxVisible)
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
      <div className="flex h-6 items-center gap-1 overflow-hidden">
        {visibleItems.map((item) => {
          const statusLabel = STATUS_LABEL[item.status]
          const tooltip = `Attempt for puzzle ${item.puzzlePosition}: ${statusLabel}`
          const isFreshFailed =
            item.status === 'failed' &&
            item.finishedAt !== undefined &&
            now < item.finishedAt + FAILED_PULSE_WINDOW_MS

          const dotClass = item.status === 'ongoing'
            ? 'bg-sky-400 animate-pulse'
            : isFreshFailed
              ? 'bg-red-400 animate-pulse'
              : BASE_STATUS_CLASS[item.status]

          return (
            <Tooltip key={item.attemptId} delayDuration={70} disableHoverableContent={true}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={tooltip}
                  className="flex h-4 w-4 items-center justify-center rounded-full transition hover:ring-1 hover:ring-border/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border/90 data-[state=closed]:ring-0 data-[state=delayed-open]:ring-1 data-[state=delayed-open]:ring-border/90"
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}