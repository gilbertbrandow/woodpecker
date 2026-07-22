import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import type { SessionAttemptHistoryItem } from '../context/solveSession'

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

// Each dot slot is w-4 (16px) + gap-1 (4px) = 20px. Inner has px-0.5 (4px total padding).
// containerWidth = 4 + N*16 + (N-1)*4 = 20N → N = containerWidth / 20
// When overflowing the badge occupies one w-4 slot (same 16px), so total stays 20*maxDots.
const DOT_SLOT_PX = 20

type SessionAttemptStripProps = {
  items: SessionAttemptHistoryItem[]
  runId: string
  activeAttemptId?: number | null
  interactive?: boolean
  pulseActive?: boolean
  noMargin?: boolean
}

export function SessionAttemptStrip({ items, runId, activeAttemptId, interactive = true, pulseActive = false, noMargin = false }: SessionAttemptStripProps): React.ReactElement | null {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = React.useState<number | null>(null)

  React.useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    setContainerWidth(el.offsetWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setContainerWidth(el.offsetWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (items.length === 0) {
    return null
  }

  // null = not yet measured (before first paint); show all so useLayoutEffect re-render is correct.
  // 0 = jsdom/test env where offsetWidth is 0; show all to keep tests working.
  const maxDots = containerWidth !== null && containerWidth > 0
    ? Math.max(1, Math.floor(containerWidth / DOT_SLOT_PX))
    : items.length

  // Reserve one dot slot for the badge when overflowing so the badge + remaining dots
  // still sum to exactly maxDots slots and the layout never exceeds containerWidth.
  const overflowing = items.length > maxDots
  const visibleDotCount = overflowing ? maxDots - 1 : maxDots
  const hiddenCount = overflowing ? items.length - visibleDotCount : 0
  const visibleItems = visibleDotCount > 0 ? items.slice(-visibleDotCount) : []

  return (
    <div ref={containerRef} className={`${noMargin ? '' : 'mt-3 '}h-6 w-full overflow-hidden`}>
      <div className="flex h-6 w-max items-center gap-1 px-0.5">
        {hiddenCount > 0 && (
          <Tooltip delayDuration={70} disableHoverableContent={true}>
            <TooltipTrigger asChild>
              <span
                role="img"
                aria-label={`${hiddenCount} earlier attempt${hiddenCount === 1 ? '' : 's'} not shown`}
                className="flex h-4 w-4 shrink-0 cursor-default items-center justify-center overflow-hidden rounded-full bg-muted text-[9px] font-medium leading-none text-muted-foreground"
              >
                {hiddenCount > 99 ? '99+' : `+${hiddenCount}`}
              </span>
            </TooltipTrigger>
            <TooltipContent>{hiddenCount} earlier attempt{hiddenCount === 1 ? '' : 's'} not shown</TooltipContent>
          </Tooltip>
        )}
        {visibleItems.map((item) => {
          const statusLabel = STATUS_LABEL[item.status]
          const tooltip = `Attempt for puzzle ${item.puzzlePosition}: ${statusLabel}`

          const isOngoing = item.status === 'ongoing'
          const isPulsing = pulseActive && isOngoing
          const dotColorClass = isOngoing ? 'bg-sky-400' : BASE_STATUS_CLASS[item.status]
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
              to="/app/runs/$runId/training-items/$runTrainingItemId/overview"
              params={{ runId, runTrainingItemId: String(item.runTrainingItemId) }}
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
