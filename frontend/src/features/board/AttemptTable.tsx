import * as React from 'react'
import { CircleOff } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'
import { formatSolveTimeMs } from '../../lib/utils'
import type { AttemptSummary } from '../../lib/api'

const PAGE_SIZE = 3

type AttemptTableProps = {
  tries: AttemptSummary[]
  maxTriesPerPuzzle: number
  selectedAttemptId: number | null
  onSelect: (id: number) => void
}

export function AttemptTable({
  tries,
  maxTriesPerPuzzle,
  selectedAttemptId,
  onSelect,
}: AttemptTableProps): React.ReactElement {
  const [page, setPage] = React.useState(0)

  const sorted = [...tries]
    .filter((a) => a.status !== 'in_progress')
    .sort((a, b) => b.tryNumber - a.tryNumber)

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const visible = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  React.useEffect(() => {
    setPage(0)
  }, [tries])

  if (sorted.length === 0) {
    return <p className="text-xs text-muted-foreground">No attempts recorded.</p>
  }

  return (
    <div className="flex flex-col gap-0.5">
      {visible.map((attempt) => {
        const counts = attempt.tryNumber <= maxTriesPerPuzzle
        const isSelected = attempt.id === selectedAttemptId
        const label = attempt.tryNumber <= maxTriesPerPuzzle
          ? `Try ${attempt.tryNumber}`
          : 'Practice'

        return (
          <div
            key={attempt.id}
            role="button"
            tabIndex={0}
            className={`flex h-10 cursor-pointer items-center gap-2 rounded-sm border px-2 transition-colors hover:bg-muted/50 ${isSelected ? 'border-foreground/40 bg-muted/50' : 'border-transparent'}`}
            onClick={() => onSelect(attempt.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(attempt.id) }}
          >
            <span className={`w-14 shrink-0 text-xs ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {!counts && (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-default items-center text-muted-foreground/50">
                    <CircleOff className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>This attempt does not affect your score.</TooltipContent>
              </Tooltip>
            )}
            <span className={`ml-auto tabular-nums text-xs ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
              {attempt.timeSpentMs !== null ? formatSolveTimeMs(attempt.timeSpentMs) : '—'}
            </span>
          </div>
        )
      })}
      {totalPages > 1 && (
        <div className="mt-1 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            ← Older
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Newer →
          </Button>
        </div>
      )}
    </div>
  )
}
