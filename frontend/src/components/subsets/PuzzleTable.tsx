import * as React from 'react'
import { useState, useEffect, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type Column,
  type RowSelectionState,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown, Trash2, Loader2, ExternalLink } from 'lucide-react'
import { api, type TrainingItemRow, type SortColumn, type SortOrder } from '../../lib/api'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/tooltip'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Checkbox } from '../ui/checkbox'
import { TrainingItemTypeBadge } from '../TrainingItemTypeBadge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/table'

type ColMeta = { className?: string }

const OPENING_MAX_CHARS = 18

type PuzzleTableProps = {
  subsetId: number
  locked: boolean
  onTotalChange: (n: number) => void
}

function SortHeader({
  column,
  label,
}: {
  column: Column<TrainingItemRow, unknown>
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

function LabelBadges({ items }: { items: { name: string; displayName?: string | null }[] }): React.ReactElement {
  const shown = items.slice(0, 2)
  const extra = items.length - 2
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((t) => (
        <Badge key={t.name} variant="outline" className="text-xs font-normal">
          {t.displayName ?? t.name}
        </Badge>
      ))}
      {extra > 0 && (
        <Badge variant="outline" className="text-xs font-normal">
          +{extra}
        </Badge>
      )}
    </div>
  )
}

function OpeningCell({ row }: { row: TrainingItemRow }): React.ReactElement {
  const opening =
    row.sourceType === 'LICHESS_TACTIC'
      ? (row.openings[1] ?? row.openings[0] ?? null)
      : row.opening

  if (!opening) return <span className="text-muted-foreground">—</span>

  const label =
    opening.displayName.length > OPENING_MAX_CHARS
      ? opening.displayName.slice(0, OPENING_MAX_CHARS - 1) + '…'
      : opening.displayName

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span className="cursor-default text-xs text-muted-foreground">{label}</span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-mono mr-1.5">{opening.eco}</span>{opening.displayName}
      </TooltipContent>
    </Tooltip>
  )
}

export function PuzzleTable({ subsetId, locked, onTotalChange }: PuzzleTableProps): React.ReactElement {
  const [puzzles, setPuzzles] = useState<TrainingItemRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [pageIndex, setPageIndex] = useState(0)
  const [sorting, setSorting] = useState<SortingState>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [discarding, setDiscarding] = useState<number | null>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [discardingSelected, setDiscardingSelected] = useState(false)

  const toSortParams = (s: SortingState): { sort?: SortColumn; order?: SortOrder } => {
    const first = s[0]
    if (!first) return {}
    const colMap: Partial<Record<string, SortColumn>> = {
      nbPlays: 'nb_plays',
      ratingOrDifficulty: 'rating',
    }
    const col = colMap[first.id] ?? (first.id as SortColumn)
    return { sort: col, order: first.desc ? 'desc' : 'asc' }
  }

  const fetchPage = useCallback(
    async (pi: number, s: SortingState, quiet = false): Promise<void> => {
      if (quiet) {
        setFetching(true)
      } else {
        setInitialLoading(true)
      }
      try {
        const { sort, order } = toSortParams(s)
        const result = await api.subsets.getTrainingItems(subsetId, pi + 1, sort, order)
        setPuzzles(result.puzzles)
        setTotalPages(result.totalPages)
        setTotal(result.total)
        onTotalChange(result.total)
      } catch {
      } finally {
        setInitialLoading(false)
        setFetching(false)
      }
    },
    [subsetId, onTotalChange],
  )

  useEffect(() => {
    void fetchPage(pageIndex, sorting, puzzles.length > 0)
  }, [fetchPage, pageIndex, sorting])

  const handleDiscard = async (trainingItemId: number): Promise<void> => {
    setDiscarding(trainingItemId)
    try {
      await api.subsets.discardTrainingItem(subsetId, trainingItemId)
      const isLastOnPage = puzzles.length === 1
      const newPageIndex = isLastOnPage && pageIndex > 0 ? pageIndex - 1 : pageIndex
      setRowSelection({})
      if (newPageIndex !== pageIndex) {
        setPageIndex(newPageIndex)
      } else {
        await fetchPage(pageIndex, sorting, true)
      }
    } catch {
    } finally {
      setDiscarding(null)
    }
  }

  const handleDiscardSelected = async (): Promise<void> => {
    const ids = Object.keys(rowSelection).filter((id) => rowSelection[id])
    if (ids.length === 0) return
    setDiscardingSelected(true)
    try {
      await Promise.all(ids.map((id) => api.subsets.discardTrainingItem(subsetId, Number(id))))
      setRowSelection({})
      const remaining = puzzles.length - ids.length
      const newPageIndex = remaining === 0 && pageIndex > 0 ? pageIndex - 1 : pageIndex
      if (newPageIndex !== pageIndex) {
        setPageIndex(newPageIndex)
      } else {
        await fetchPage(pageIndex, sorting, true)
      }
    } catch {
    } finally {
      setDiscardingSelected(false)
    }
  }

  const selectColumn: ColumnDef<TrainingItemRow> = {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
  }

  const actionColumn: ColumnDef<TrainingItemRow> = {
    id: 'action',
    header: '',
    enableSorting: false,
    meta: { className: 'sticky right-0 bg-background' } satisfies ColMeta,
    cell: ({ row }) => (
      <button
        type="button"
        onClick={() => void handleDiscard(row.original.trainingItemId)}
        disabled={discarding !== null || discardingSelected}
        className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
        aria-label="Remove puzzle"
      >
        {discarding === row.original.trainingItemId ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>
    ),
  }

  const columns: ColumnDef<TrainingItemRow>[] = [
    ...(!locked ? [selectColumn] : []),
    {
      id: 'sourceType',
      header: 'Type',
      enableSorting: false,
      cell: ({ row }) => <TrainingItemTypeBadge source={row.original.sourceType} />,
    },
    {
      id: 'ratingOrDifficulty',
      header: ({ column }) => <SortHeader column={column} label="Rating / Level" />,
      meta: { className: 'min-w-32' } satisfies ColMeta,
      cell: ({ row }) =>
        row.original.sourceType === 'LICHESS_TACTIC' ? (
          <span className="tabular-nums">{row.original.rating}</span>
        ) : row.original.sourceType === 'DECOY' ? (
          <span className="text-muted-foreground">—</span>
        ) : row.original.difficultyMinRating != null && row.original.difficultyMaxRating != null ? (
          <span className="tabular-nums">{row.original.difficultyMinRating}–{row.original.difficultyMaxRating}</span>
        ) : (
          <span className="text-sm">{row.original.difficultyLabel}</span>
        ),
    },
    {
      id: 'themes',
      header: 'Themes',
      enableSorting: false,
      meta: { className: 'min-w-52' } satisfies ColMeta,
      cell: ({ row }) => row.original.sourceType !== 'DECOY'
        ? <LabelBadges items={row.original.themes} />
        : null,
    },
    {
      id: 'opening',
      header: 'Opening',
      enableSorting: false,
      meta: { className: 'min-w-44' } satisfies ColMeta,
      cell: ({ row }) => <OpeningCell row={row.original} />,
    },
    {
      id: 'link',
      header: '',
      enableSorting: false,
      meta: { className: locked ? 'sticky right-0 bg-background' : 'sticky right-14 bg-background' } satisfies ColMeta,
      cell: ({ row }) => {
        const url = row.original.sourceType === 'LICHESS_TACTIC'
          ? row.original.gameUrl
          : row.original.sourceType === 'SCRAPED_POSITIONAL'
          ? row.original.lichessUrl
          : row.original.analysisUrl
        if (!url) return null
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Open on Lichess"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )
      },
    },
    ...(!locked ? [actionColumn] : []),
  ]

  const table = useReactTable({
    data: puzzles,
    columns,
    manualSorting: true,
    manualPagination: true,
    pageCount: totalPages,
    enableRowSelection: !locked,
    getRowId: (row) => String(row.trainingItemId),
    state: {
      sorting,
      pagination: { pageIndex, pageSize: 25 },
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      setSorting(next)
      setPageIndex(0)
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater({ pageIndex, pageSize: 25 }) : updater
      setPageIndex(next.pageIndex)
    },
    getCoreRowModel: getCoreRowModel(),
  })

  const selectedCount = table.getFilteredSelectedRowModel().rows.length
  const start = pageIndex * 25 + 1
  const end = Math.min(pageIndex * 25 + puzzles.length, total)

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex flex-col gap-4">
      {!locked && selectedCount > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleDiscardSelected()}
            disabled={discardingSelected || discarding !== null}
          >
            {discardingSelected ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Removing…</>
            ) : (
              <><Trash2 className="mr-1.5 h-3.5 w-3.5" />Remove selected</>
            )}
          </Button>
        </div>
      )}

      <div className={`overflow-x-auto rounded-md border transition-opacity duration-150 ${fetching ? 'opacity-50' : ''}`}>
        <Table className="min-w-max">
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className={`whitespace-nowrap ${(h.column.columnDef.meta as ColMeta | undefined)?.className ?? ''}`}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {initialLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">
                  No puzzles yet.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={`whitespace-nowrap ${(cell.column.columnDef.meta as ColMeta | undefined)?.className ?? ''}`}>
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
            disabled={!table.getCanPreviousPage() || initialLoading || fetching}
          >
            ← Prev
          </Button>
          <span className="tabular-nums">
            Page {pageIndex + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage() || initialLoading || fetching}
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
    </TooltipProvider>
  )
}
