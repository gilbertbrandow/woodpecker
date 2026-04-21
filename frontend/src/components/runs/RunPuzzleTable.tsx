import * as React from 'react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type Column,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink, Play, Eye } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/table'
import { type RunPuzzleListItem, type PositionStatus } from '../../lib/api'
import { formatSolveTimeMs } from '../../lib/utils'

const PAGE_SIZE = 25

const POSITION_STATUS_LABELS: Record<PositionStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  will_be_retried: 'Will retry',
  solved: 'Solved',
  solved_with_retries: 'Solved with retries',
  failed: 'Failed',
}

const POSITION_STATUS_CLASS: Record<PositionStatus, string> = {
  not_started: '',
  in_progress: 'border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
  will_be_retried: 'border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
  solved: 'border-green-600/30 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  solved_with_retries: 'border-green-600/30 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  failed: 'border-red-600/30 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400',
}

type ColMeta = { className?: string }

type RunPuzzleTableProps = {
  puzzles: RunPuzzleListItem[]
  runIdStr: string
  isActive: boolean
}

function SortHeader({
  column,
  label,
}: {
  column: Column<RunPuzzleListItem, unknown>
  label: string
}): React.ReactElement {
  const sorted = column.getIsSorted()
  return (
    <button
      type="button"
      className="flex items-center gap-1 hover:text-foreground"
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      {label}
      {sorted === 'asc' ? (
        <ChevronUp className="h-3.5 w-3.5" />
      ) : sorted === 'desc' ? (
        <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </button>
  )
}

type ActionButtonProps = {
  tooltip: string
  onClick?: (e: React.MouseEvent) => void
  disabled?: boolean
  children: React.ReactNode
}

function ActionButton({ tooltip, onClick, disabled = false, children }: ActionButtonProps): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors ${
              disabled
                ? 'cursor-not-allowed opacity-35'
                : 'hover:bg-accent hover:text-foreground'
            }`}
          >
            {children}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function RunPuzzleTable({ puzzles, runIdStr, isActive }: RunPuzzleTableProps): React.ReactElement {
  const navigate = useNavigate()
  const [sorting, setSorting] = useState<SortingState>([])

  const columns: ColumnDef<RunPuzzleListItem>[] = [
    {
      accessorKey: 'position',
      header: '#',
      enableSorting: false,
      meta: { className: 'w-12 text-right' } satisfies ColMeta,
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground">{row.original.position + 1}</span>
      ),
    },
    {
      accessorKey: 'rating',
      header: ({ column }) => <SortHeader column={column} label="Rating" />,
      meta: { className: 'min-w-24' } satisfies ColMeta,
      cell: ({ row }) => <span className="tabular-nums">{row.original.rating}</span>,
    },
    {
      accessorKey: 'positionStatus',
      header: 'Status',
      enableSorting: false,
      meta: { className: 'min-w-32' } satisfies ColMeta,
      cell: ({ row }) => {
        const status = row.original.positionStatus
        return (
          <Badge variant="outline" className={POSITION_STATUS_CLASS[status]}>
            {POSITION_STATUS_LABELS[status]}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'timeMs',
      header: ({ column }) => <SortHeader column={column} label="Time" />,
      meta: { className: 'min-w-28' } satisfies ColMeta,
      sortUndefined: 'last',
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.timeMs !== null ? formatSolveTimeMs(row.original.timeMs) : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'tryCount',
      header: ({ column }) => <SortHeader column={column} label="Tries" />,
      meta: { className: 'min-w-20 text-right' } satisfies ColMeta,
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.tryCount > 0 ? row.original.tryCount : '—'}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      meta: { className: 'sticky right-0 bg-background w-28' } satisfies ColMeta,
      cell: ({ row }) => {
        const item = row.original
        return (
          <div className="flex items-center gap-0.5">
            <ActionButton
              tooltip="Open puzzle on Lichess"
              onClick={(e) => {
                e.stopPropagation()
                window.open(`https://lichess.org/training/${item.puzzleId}`, '_blank', 'noopener,noreferrer')
              }}
            >
              <ExternalLink className="h-4 w-4" />
            </ActionButton>
            <ActionButton
              tooltip={isActive ? 'Solve this puzzle' : 'Run is not active'}
              disabled={!isActive}
              onClick={(e) => {
                e.stopPropagation()
                void navigate({
                  to: '/app/runs/$runId/puzzles/$runPuzzleId',
                  params: { runId: runIdStr, runPuzzleId: String(item.runPuzzleId) },
                })
              }}
            >
              <Play className="h-4 w-4" />
            </ActionButton>
            <ActionButton
              tooltip="See overview"
              onClick={(e) => {
                e.stopPropagation()
                void navigate({
                  to: '/app/runs/$runId/puzzles/$runPuzzleId/overview',
                  params: {
                    runId: runIdStr,
                    runPuzzleId: String(item.runPuzzleId),
                  },
                })
              }}
            >
              <Eye className="h-4 w-4" />
            </ActionButton>
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: puzzles,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize: PAGE_SIZE },
    },
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      setSorting(next)
      table.setPageIndex(0)
    },
  })

  const { pageIndex } = table.getState().pagination
  const total = puzzles.length
  const start = pageIndex * PAGE_SIZE + 1
  const end = Math.min(pageIndex * PAGE_SIZE + table.getRowModel().rows.length, total)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className={(h.column.columnDef.meta as ColMeta | undefined)?.className}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">
                  No puzzles yet.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={(cell.column.columnDef.meta as ColMeta | undefined)?.className}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-start gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          {total === 0 ? 'No puzzles' : `Showing ${start}–${end} of ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            ← Prev
          </Button>
          <span className="tabular-nums">
            Page {pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
  )
}
