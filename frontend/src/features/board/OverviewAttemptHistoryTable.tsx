import * as React from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Check, X, CircleOff } from 'lucide-react'
import { formatSolveTimeMs } from '../../lib/utils'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/table'
import { Button } from '../../components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'

export type OverviewAttemptHistoryRow = {
  attemptId: number
  runId: number
  runLabel: string
  runOrder: number
  runPuzzleId: number
  tryNumber: number
  countsTowardsTraining: boolean
  result: 'solved' | 'failed'
  timeSpentMs: number | null
}

type SortKey = 'runOrder' | 'tryNumber' | 'timeSpentMs'
type SortDir = 'asc' | 'desc'

type OverviewAttemptHistoryTableProps = {
  rows: OverviewAttemptHistoryRow[]
  selectedAttemptId: number | null
  onSelectAttempt: (attemptId: number) => void
}

function sortRows(
  rows: OverviewAttemptHistoryRow[],
  key: SortKey,
  dir: SortDir,
): OverviewAttemptHistoryRow[] {
  const factor = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    let primary: number
    if (key === 'runOrder') {
      primary = (a.runOrder - b.runOrder) * factor
    } else if (key === 'tryNumber') {
      primary = (a.tryNumber - b.tryNumber) * factor
    } else {
      if (a.timeSpentMs === null && b.timeSpentMs === null) primary = 0
      else if (a.timeSpentMs === null) primary = 1
      else if (b.timeSpentMs === null) primary = -1
      else primary = (a.timeSpentMs - b.timeSpentMs) * factor
    }
    if (primary !== 0) return primary
    if (key !== 'runOrder') {
      const runComp = b.runOrder - a.runOrder
      if (runComp !== 0) return runComp
    }
    return a.tryNumber - b.tryNumber
  })
}

function SortIndicator({
  active,
  dir,
}: {
  active: boolean
  dir: SortDir
}): React.ReactElement {
  if (!active) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />
  return dir === 'asc' ? (
    <ArrowUp className="ml-1 h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 h-3 w-3" />
  )
}

const PAGE_SIZE = 5

export function OverviewAttemptHistoryTable({
  rows,
  selectedAttemptId,
  onSelectAttempt,
}: OverviewAttemptHistoryTableProps): React.ReactElement {
  const [sortKey, setSortKey] = React.useState<SortKey>('runOrder')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')
  const [page, setPage] = React.useState(0)

  const sorted = React.useMemo(
    () => sortRows(rows, sortKey, sortDir),
    [rows, sortKey, sortDir],
  )

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const visible = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleSort(key: SortKey): void {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'runOrder' ? 'desc' : 'asc')
    }
    setPage(0)
  }

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">No attempts recorded.</p>
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-2 py-0">
                <button
                  type="button"
                  className="inline-flex items-center text-xs font-medium text-muted-foreground"
                  onClick={() => handleSort('runOrder')}
                >
                  Run
                  <SortIndicator active={sortKey === 'runOrder'} dir={sortDir} />
                </button>
              </TableHead>
              <TableHead className="px-2 py-0">
                <button
                  type="button"
                  className="inline-flex items-center text-xs font-medium text-muted-foreground"
                  onClick={() => handleSort('tryNumber')}
                >
                  Attempt
                  <SortIndicator active={sortKey === 'tryNumber'} dir={sortDir} />
                </button>
              </TableHead>
              <TableHead className="px-2 py-0 text-xs">Solved</TableHead>
              <TableHead className="px-2 py-0">
                <button
                  type="button"
                  className="inline-flex items-center text-xs font-medium text-muted-foreground"
                  onClick={() => handleSort('timeSpentMs')}
                >
                  Time
                  <SortIndicator active={sortKey === 'timeSpentMs'} dir={sortDir} />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => {
              const isSelected = row.attemptId === selectedAttemptId
              return (
                <TableRow
                  key={row.attemptId}
                  data-state={isSelected ? 'selected' : undefined}
                  className="cursor-pointer"
                  onClick={() => onSelectAttempt(row.attemptId)}
                >
                  <TableCell className="px-2 py-1.5 text-xs tabular-nums">
                    {row.runLabel}
                  </TableCell>
                  <TableCell className="px-2 py-1.5 text-xs text-muted-foreground">
                    {row.countsTowardsTraining ? (
                      `#${row.tryNumber}`
                    ) : (
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                          <span className="inline-flex cursor-default items-center text-muted-foreground/60">
                            <CircleOff className="h-3 w-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>This attempt did not count towards score.</TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell className="px-2 py-1.5">
                    {row.result === 'solved' ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </TableCell>
                  <TableCell className="px-2 py-1.5 text-xs tabular-nums text-muted-foreground">
                    {row.timeSpentMs !== null ? formatSolveTimeMs(row.timeSpentMs) : '—'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  )
}
