import * as React from 'react'
import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { ArrowUp, ArrowDown, ArrowUpDown, Search, Loader2, ChevronLeft, ChevronRight, Undo2 } from 'lucide-react'
import { Input } from './ui/input'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './ui/table'
import { MultiSelectFilter } from './ui/multi-select-filter'
import { cn } from '../lib/utils'

type ColMeta = { className?: string }

export type FilterableColumn = {
  id: string
  label: string
  options: { label: string; value: string; icon?: React.ReactNode }[]
}

export type ServerPagination = {
  totalRows: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
}

type DataTableProps<T> = {
  columns: ColumnDef<T>[]
  data: T[]
  globalFilterPlaceholder?: string
  filterableColumns?: FilterableColumn[]
  filtersSlot?: React.ReactNode
  hideSearch?: boolean
  pageSize?: number
  initialSorting?: SortingState
  onRowClick?: (row: T) => void
  getRowClassName?: (row: T) => string
  emptyMessage?: React.ReactNode
  loading?: boolean
  serverPagination?: ServerPagination
  onFilterChange?: (id: string, values: string[]) => void
  filtersActive?: boolean
  onClearFilters?: () => void
}

export function DataTable<T>({
  columns,
  data,
  globalFilterPlaceholder = 'Search…',
  filterableColumns = [],
  filtersSlot,
  hideSearch = false,
  pageSize = 10,
  initialSorting = [],
  onRowClick,
  getRowClassName,
  emptyMessage = <span className="text-muted-foreground">No results.</span>,
  loading = false,
  serverPagination,
  onFilterChange,
  filtersActive = false,
  onClearFilters,
}: DataTableProps<T>): React.ReactElement {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [filterSelections, setFilterSelections] = useState<Record<string, string[]>>({})

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      setSorting(next)
      table.setPageIndex(0)
    },
    onGlobalFilterChange: (value: string) => {
      setGlobalFilter(value)
      table.setPageIndex(0)
    },
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater
      setColumnFilters(next)
      table.setPageIndex(0)
    },
    globalFilterFn: 'includesString',
    manualPagination: !!serverPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize },
      sorting: initialSorting,
    },
  })

  const handleFilterableColumnChange = (id: string, values: string[]): void => {
    setFilterSelections((prev) => ({ ...prev, [id]: values }))
    onFilterChange?.(id, values)
    if (!onFilterChange) {
      setColumnFilters((prev) => {
        const without = prev.filter((f) => f.id !== id)
        if (values.length === 0) return without
        return [...without, { id, value: values }]
      })
      table.setPageIndex(0)
    }
  }

  const hasActiveFilters =
    filtersActive ||
    globalFilter !== '' ||
    columnFilters.length > 0 ||
    Object.values(filterSelections).some((v) => v.length > 0)

  const clearFilters = (): void => {
    setGlobalFilter('')
    setColumnFilters([])
    setFilterSelections({})
    filterableColumns.forEach((fc) => onFilterChange?.(fc.id, []))
    onClearFilters?.()
    table.setPageIndex(0)
  }

  const { pageIndex } = table.getState().pagination
  const totalFiltered = table.getFilteredRowModel().rows.length
  const pageRows = table.getRowModel().rows
  const start = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1
  const end = Math.min(pageIndex * pageSize + pageRows.length, totalFiltered)

  return (
    <div className="flex flex-col gap-3">
      {(!hideSearch || filtersSlot || filterableColumns.length > 0 || loading) && (
        <div className="flex flex-wrap items-center gap-2">
          {!hideSearch && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={globalFilterPlaceholder}
                value={globalFilter}
                onChange={(e) => {
                  setGlobalFilter(e.target.value)
                  table.setPageIndex(0)
                }}
                className="h-8 pl-7 text-sm sm:w-56"
              />
            </div>
          )}
          {filtersSlot}
          {filterableColumns.map((fc) => (
            <MultiSelectFilter
              key={fc.id}
              label={fc.label}
              options={fc.options}
              selected={filterSelections[fc.id] ?? []}
              onChange={(values) => handleFilterableColumnChange(fc.id, values)}
            />
          ))}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Undo2 className="h-3 w-3" />
              Clear filters
            </button>
          )}
          {loading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-max">
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort()
                  const sorted = h.column.getIsSorted()
                  return (
                    <TableHead key={h.id} className={cn('whitespace-nowrap', (h.column.columnDef.meta as ColMeta | undefined)?.className)}>
                      {h.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && !loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow
                  key={row.id}
                  className={[
                    onRowClick ? 'cursor-pointer' : '',
                    getRowClassName ? getRowClassName(row.original) : '',
                  ].filter(Boolean).join(' ') || undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cn('whitespace-nowrap', (cell.column.columnDef.meta as ColMeta | undefined)?.className)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {serverPagination ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {serverPagination.totalRows === 0
              ? 'No results'
              : `Showing ${(serverPagination.page - 1) * serverPagination.pageSize + 1}–${Math.min(serverPagination.page * serverPagination.pageSize, serverPagination.totalRows)} of ${serverPagination.totalRows}`}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => serverPagination.onPageChange(serverPagination.page - 1)}
              disabled={serverPagination.page <= 1 || loading}
              className="flex items-center gap-0.5 transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-3 w-3" />
              Prev
            </button>
            <span className="tabular-nums">
              {serverPagination.page} / {Math.max(1, Math.ceil(serverPagination.totalRows / serverPagination.pageSize))}
            </span>
            <button
              type="button"
              onClick={() => serverPagination.onPageChange(serverPagination.page + 1)}
              disabled={serverPagination.page * serverPagination.pageSize >= serverPagination.totalRows || loading}
              className="flex items-center gap-0.5 transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {totalFiltered === 0
              ? 'No results'
              : `Showing ${start}–${end} of ${totalFiltered}`}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="flex items-center gap-0.5 transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-3 w-3" />
              Prev
            </button>
            <span className="tabular-nums">
              {pageIndex + 1} / {table.getPageCount() || 1}
            </span>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="flex items-center gap-0.5 transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
