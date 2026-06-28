import * as React from 'react'
import { useState, useEffect, useRef } from 'react'
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
import { useTableUrlSync } from '../hooks/useTableUrlSync'

type ColMeta = { className?: string }

export type FilterableColumn = {
  id: string
  label: string
  options: { label: string; value: string; icon?: React.ReactNode }[]
}

export type SyncedFilter = {
  key: string
  value: string[]
  onChange: (values: string[]) => void
}

export type ServerPagination = {
  totalRows: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
}

function parseSortParam(sortParam: string | undefined): SortingState {
  if (!sortParam) return []
  const colonIdx = sortParam.lastIndexOf(':')
  if (colonIdx <= 0) return []
  const col = sortParam.slice(0, colonIdx)
  const dir = sortParam.slice(colonIdx + 1)
  if (!col || (dir !== 'asc' && dir !== 'desc')) return []
  return [{ id: col, desc: dir === 'desc' }]
}

function encodeSortParam(sorting: SortingState): string | null {
  if (!sorting[0]) return null
  return `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}`
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
  tableId?: string | false
  syncedFilters?: SyncedFilter[]
  footerRow?: React.ReactNode
  onFooterRowClick?: () => void
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
  tableId,
  syncedFilters,
  footerRow,
  onFooterRowClick,
}: DataTableProps<T>): React.ReactElement {
  const { getParam, getMultiParam, setParams } = useTableUrlSync(tableId)

  const [sorting, setSorting] = useState<SortingState>(() => {
    const fromUrl = parseSortParam(getParam('sort'))
    return fromUrl.length > 0 ? fromUrl : initialSorting
  })

  const [globalFilter, setGlobalFilter] = useState<string>(() => getParam('q') ?? '')

  const [filterSelections, setFilterSelections] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {}
    filterableColumns.forEach((fc) => {
      const vals = getMultiParam(fc.id)
      if (vals.length > 0) init[fc.id] = vals
    })
    return init
  })

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    const init: ColumnFiltersState = []
    filterableColumns.forEach((fc) => {
      const vals = getMultiParam(fc.id)
      if (vals.length > 0) init.push({ id: fc.id, value: vals })
    })
    return init
  })

  const [urlPageIndex] = useState(() => {
    const p = getParam('page')
    if (!p) return 0
    const n = parseInt(p, 10)
    return Number.isInteger(n) && n >= 1 ? n - 1 : 0
  })

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
      setParams({ sort: encodeSortParam(next), page: null })
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
      pagination: { pageIndex: serverPagination ? 0 : urlPageIndex, pageSize },
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
    setParams({ [id]: values.length > 0 ? values : null, page: null })
  }

  // Serialize synced filter values into a stable string so the effect below can use it as a
  // dependency. We intentionally avoid depending on the syncedFilters array reference (which is
  // a new object every render) and instead trigger only when the actual values change.
  const syncedFilterValues = syncedFilters?.map((f) => f.value.join(',')).join('|') ?? ''
  const syncedFiltersInitializedRef = useRef(false)
  useEffect(() => {
    if (!syncedFilters?.length) return
    const updates: Record<string, string | string[] | null> = {}
    // syncedFilters is captured via closure — always reflects the current render's values
    // because this effect only runs when syncedFilterValues (the serialised snapshot) changes.
    syncedFilters.forEach((f) => {
      updates[f.key] = f.value.length > 0 ? f.value : null
    })
    if (syncedFiltersInitializedRef.current) {
      updates.page = null
    }
    syncedFiltersInitializedRef.current = true
    setParams(updates)
  // syncedFilters is intentionally omitted — see comment above
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncedFilterValues])

  const hasActiveFilters =
    filtersActive ||
    globalFilter !== '' ||
    columnFilters.length > 0 ||
    Object.values(filterSelections).some((v) => v.length > 0) ||
    (syncedFilters?.some((f) => f.value.length > 0) ?? false)

  const clearFilters = (): void => {
    setGlobalFilter('')
    setColumnFilters([])
    setFilterSelections({})
    setSorting(initialSorting)
    filterableColumns.forEach((fc) => onFilterChange?.(fc.id, []))
    syncedFilters?.forEach((f) => f.onChange([]))
    table.setPageIndex(0)

    const toClear: Record<string, null> = { q: null, sort: null, page: null }
    filterableColumns.forEach((fc) => { toClear[fc.id] = null })
    syncedFilters?.forEach((f) => { toClear[f.key] = null })
    setParams(toClear)  // Clear URL first so onClearFilters can write back defaults

    onClearFilters?.()
  }

  const { pageIndex } = table.getState().pagination
  const totalFiltered = table.getFilteredRowModel().rows.length
  const pageRows = table.getRowModel().rows
  const start = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1
  const end = Math.min(pageIndex * pageSize + pageRows.length, totalFiltered)

  return (
    <div className="flex flex-col gap-3">
      {(!hideSearch || filtersSlot || filterableColumns.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {!hideSearch && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={globalFilterPlaceholder}
                value={globalFilter}
                onChange={(e) => {
                  const val = e.target.value
                  setGlobalFilter(val)
                  table.setPageIndex(0)
                  setParams({ q: val || null, page: null })
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
        </div>
      )}

      <div className="relative overflow-x-auto rounded-md border">
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
            {loading && pageRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-10 text-center">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!loading && pageRows.length === 0 && !footerRow && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((row) => (
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
            ))}
            {footerRow && (
              <TableRow
                className={onFooterRowClick ? 'cursor-pointer' : 'hover:bg-transparent'}
                onClick={onFooterRowClick}
                role={onFooterRowClick ? 'button' : undefined}
                tabIndex={onFooterRowClick ? 0 : undefined}
                onKeyDown={onFooterRowClick ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFooterRowClick() }
                } : undefined}
              >
                <TableCell colSpan={columns.length} className="py-2">
                  {footerRow}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {loading && pageRows.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md backdrop-blur-[2px] bg-background/40">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
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
              onClick={() => {
                serverPagination.onPageChange(serverPagination.page - 1)
              }}
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
              onClick={() => {
                serverPagination.onPageChange(serverPagination.page + 1)
              }}
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
              onClick={() => {
                table.previousPage()
                setParams({ page: pageIndex <= 1 ? null : String(pageIndex) })
              }}
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
              onClick={() => {
                table.nextPage()
                setParams({ page: String(pageIndex + 2) })
              }}
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
