import * as React from 'react'
import { useState, useMemo } from 'react'
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
import { ArrowUp, ArrowDown, ArrowUpDown, Search } from 'lucide-react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './ui/table'

export type FilterableColumn = {
  id: string
  label: string
  options: { label: string; value: string }[]
}

type DataTableProps<T> = {
  columns: ColumnDef<T>[]
  data: T[]
  globalFilterPlaceholder?: string
  filterableColumns?: FilterableColumn[]
  pageSize?: number
  initialSorting?: SortingState
  onRowClick?: (row: T) => void
  getRowClassName?: (row: T) => string
  emptyMessage?: string
}

export function DataTable<T>({
  columns,
  data,
  globalFilterPlaceholder = 'Search…',
  filterableColumns = [],
  pageSize = 10,
  initialSorting = [],
  onRowClick,
  getRowClassName,
  emptyMessage = 'No results.',
}: DataTableProps<T>): React.ReactElement {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const filterValues = useMemo<Record<string, string>>(() => {
    const result: Record<string, string> = {}
    for (const f of columnFilters) {
      if (typeof f.value === 'string') result[f.id] = f.value
    }
    return result
  }, [columnFilters])

  const setColumnFilter = (id: string, value: string): void => {
    setColumnFilters((prev) => {
      const without = prev.filter((f) => f.id !== id)
      if (value === '') return without
      return [...without, { id, value }]
    })
  }

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
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize },
      sorting: initialSorting,
    },
  })

  const { pageIndex } = table.getState().pagination
  const totalFiltered = table.getFilteredRowModel().rows.length
  const pageRows = table.getRowModel().rows
  const start = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1
  const end = Math.min(pageIndex * pageSize + pageRows.length, totalFiltered)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
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
        {filterableColumns.map((fc) => (
          <select
            key={fc.id}
            value={filterValues[fc.id] ?? ''}
            onChange={(e) => {
              setColumnFilter(fc.id, e.target.value)
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring sm:w-40"
          >
            <option value="">All {fc.label}</option>
            {fc.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-max">
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort()
                  const sorted = h.column.getIsSorted()
                  return (
                    <TableHead key={h.id} className="whitespace-nowrap">
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
            {pageRows.length === 0 ? (
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
                    <TableCell key={cell.id} className="whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {totalFiltered === 0
            ? 'No results'
            : `Showing ${start}–${end} of ${totalFiltered}`}
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
            {pageIndex + 1} / {table.getPageCount() || 1}
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
