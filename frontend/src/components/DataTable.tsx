import * as React from 'react'
import { useState, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { ArrowUp, ArrowDown, ArrowUpDown, Search, Loader2, ChevronLeft, ChevronRight, Columns3, RotateCcw } from 'lucide-react'
import { Input } from './ui/input'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { cn } from '../lib/utils'
import { useTableUrlSync } from '../hooks/useTableUrlSync'

type ColMeta = {
  className?: string
  rankDesc?: boolean
  icon?: React.ComponentType<{ className?: string }>
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export type ServerPagination = {
  totalRows: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
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
  filtersSlot?: React.ReactNode
  searchSlot?: React.ReactNode
  compact?: boolean
  hideSearch?: boolean
  pageSize?: number
  initialSorting?: SortingState
  onRowClick?: (row: T) => void
  getRowClassName?: (row: T) => string
  emptyMessage?: React.ReactNode
  loading?: boolean
  serverPagination?: ServerPagination
  tableId?: string | false
  footerRow?: React.ReactNode
  onFooterRowClick?: () => void
}

export function DataTable<T>({
  columns,
  data,
  globalFilterPlaceholder = 'Search…',
  filtersSlot,
  searchSlot,
  compact = false,
  hideSearch = false,
  pageSize = 10,
  initialSorting = [],
  onRowClick,
  getRowClassName,
  emptyMessage = <span className="text-muted-foreground">No results.</span>,
  loading = false,
  serverPagination,
  tableId,
  footerRow,
  onFooterRowClick,
}: DataTableProps<T>): React.ReactElement {
  const { getParam, getMultiParam, setParams } = useTableUrlSync(tableId)
  const theadRef = React.useRef<HTMLTableSectionElement>(null)

  const [sorting, setSorting] = useState<SortingState>(() => {
    const fromUrl = parseSortParam(getParam('sort'))
    return fromUrl.length > 0 ? fromUrl : initialSorting
  })

  const [globalFilter, setGlobalFilter] = useState<string>(() => getParam('q') ?? '')

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const hidden = getMultiParam('hidden')
    const init: VisibilityState = {}
    hidden.forEach((id) => { init[id] = false })
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
      columnVisibility,
    },
    onColumnVisibilityChange: setColumnVisibility,
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

  useEffect(() => {
    const hidden = Object.entries(columnVisibility)
      .filter(([, v]) => v === false)
      .map(([id]) => id)
    setParams({ hidden: hidden.length > 0 ? hidden : null })
  }, [columnVisibility]) // eslint-disable-line react-hooks/exhaustive-deps

  const { pageIndex } = table.getState().pagination
  const totalFiltered = table.getFilteredRowModel().rows.length
  const pageRows = table.getRowModel().rows
  const start = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1
  const end = Math.min(pageIndex * pageSize + pageRows.length, totalFiltered)

  return (
    <div className="flex flex-col gap-3">
      {(!hideSearch || searchSlot || filtersSlot) && (
        <div className="flex items-center gap-2">
          {!hideSearch && (
            <div className="relative shrink-0">
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
          {searchSlot}
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
          {filtersSlot}
          {(() => {
            const hideableCols = table.getAllColumns().filter((c) => c.getCanHide())
            if (hideableCols.length === 0) return null
            return (
              <div className="ml-auto flex items-center gap-2">
                {hideableCols.length > 0 && (() => {
                  const hiddenCount = hideableCols.filter((c) => !c.getIsVisible()).length
                  return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'flex h-8 items-center gap-1.5 rounded-md border text-xs transition-colors hover:bg-accent hover:text-foreground',
                          compact ? 'px-2' : 'px-2.5',
                          hiddenCount > 0
                            ? 'border-foreground/25 text-foreground'
                            : 'border-input text-muted-foreground',
                        )}
                      >
                        <Columns3 className="h-3 w-3" />
                        {!compact && 'Columns'}
                        {hiddenCount > 0 && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground tabular-nums">
                            {hiddenCount}
                          </span>
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      {hideableCols.map((col) => {
                        const header = col.columnDef.header
                        const label = typeof header === 'string' && header.trim()
                          ? header
                          : col.id.charAt(0).toUpperCase() + col.id.slice(1)
                        const ColIcon = (col.columnDef.meta as ColMeta | undefined)?.icon
                        return (
                          <DropdownMenuCheckboxItem
                            key={col.id}
                            checked={col.getIsVisible()}
                            onCheckedChange={(val) => col.toggleVisibility(!!val)}
                            onSelect={(e) => e.preventDefault()}
                            className="text-xs"
                          >
                            {ColIcon && <ColIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                            {label}
                          </DropdownMenuCheckboxItem>
                        )
                      })}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => table.resetColumnVisibility()}
                        className="text-xs"
                      >
                        <RotateCcw className="mr-2 h-3 w-3" />
                        Reset
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  )
                })()}
              </div>
            )
          })()}
          </div>
        </div>
      )}

      <div className="relative overflow-x-auto rounded-md border">
        <Table className="min-w-max">
          <TableHeader ref={theadRef}>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort()
                  const sorted = h.column.getIsSorted()
                  const colMeta = h.column.columnDef.meta as ColMeta | undefined
                  const HeaderIcon = colMeta?.icon
                  const renderedHeader = flexRender(h.column.columnDef.header, h.getContext())
                  const headerNode = HeaderIcon ? (
                    <span className="inline-flex items-center gap-1.5">
                      <HeaderIcon className="h-3.5 w-3.5" />
                      {renderedHeader}
                    </span>
                  ) : renderedHeader
                  return (
                    <TableHead key={h.id} className={cn('whitespace-nowrap', colMeta?.className)}>
                      {h.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          {headerNode}
                          {sorted === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        headerNode
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
            {!loading && footerRow && (
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
          <div
            className="absolute inset-x-0 bottom-0 flex items-center justify-center rounded-b-md backdrop-blur-[2px] bg-background/40"
            style={{ top: theadRef.current?.offsetHeight ?? 0 }}
          >
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {serverPagination ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Select
              value={String(serverPagination.pageSize)}
              onValueChange={(v) => serverPagination.onPageSizeChange?.(Number(v))}
            >
              <SelectTrigger className="h-7 w-auto px-2 text-xs [&>span]:overflow-visible">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={String(s)} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>/ Page</span>
          </div>
          <span className="tabular-nums">
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
          <div className="flex items-center gap-1.5">
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(v) => {
                table.setPageSize(Number(v))
                table.setPageIndex(0)
                setParams({ page: null })
              }}
            >
              <SelectTrigger className="h-7 w-auto px-2 text-xs [&>span]:overflow-visible">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={String(s)} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>/ Page</span>
          </div>
          <span className="tabular-nums">
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
