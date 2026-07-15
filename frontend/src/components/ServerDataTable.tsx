import * as React from 'react'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { type ColumnDef, type SortingState } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { DataTable } from './DataTable'
import { FilterChipBar } from './FilterChipBar'
import { Input } from './ui/input'
import { useTableUrlSync } from '../hooks/useTableUrlSync'
import { useDebounce } from '../hooks/useDebounce'
import { getHandler } from './filters'
import type { FilterValues } from './filters'

// ---------------------------------------------------------------------------
// Public types — defined in ./filters, re-exported here for backward compat
// ---------------------------------------------------------------------------
export type {
  FilterSpec,
  SearchFilterSpec,
  MultiFilterSpec,
  CustomFilterSpec,
  EntityFilterSpec,
  EntityVal,
  DateFilterSpec,
  RangeFilterSpec,
  DateVal,
  RangeVal,
  MultiVal,
  FilterValues,
  FilterHandler,
} from './filters'

// Re-export for consumers that import filter types from this module
import type { FilterSpec, CustomFilterSpec, EntityFilterSpec, EntityVal } from './filters'

export type FetchParams = {
  // Every filter's current value as string[]. Search filters produce a single-element array.
  filters: Record<string, string[]>
  page: number
  pageSize: number
  // Reserved for future server-side sorting support — always undefined for now.
  sort?: { key: string; dir: 'asc' | 'desc' }
}

export type ServerDataTableProps<T> = {
  // Optional namespace that prefixes all URL params, e.g. "run" → ?run_userId=…
  // Use when multiple ServerDataTables appear on the same page.
  tableId?: string
  // Pre-seed custom filter values when no URL param is present for that key.
  // Useful for "default filter" scenarios (e.g. current user pre-selected).
  // Only applied at mount; ignored if the URL already carries a value for the key.
  initialCustomValues?: Record<string, unknown[]>
  // Pre-populate the table with data on mount, skipping the initial fetch entirely.
  // The first fetch only runs when filters or page change after mount.
  initialData?: { items: T[]; total: number }
  // When this value changes the fetch effect re-runs, even if filter/page params haven't
  // changed. Use when a prop that drives fetchData (e.g. scheduleId) can change without
  // the component unmounting — changing instanceKey causes an immediate re-fetch with the
  // current fetchData closure.
  instanceKey?: string | number
  columns: ColumnDef<T>[]
  // Declared filter slots, rendered left-to-right in the filter bar.
  filters?: FilterSpec[]
  pageSize?: number
  // Called whenever filter state is settled (after hydration on mount, on every change).
  // Receive fetchData via ref internally — identity changes don't trigger re-fetches.
  fetchData: (params: FetchParams) => Promise<{ items: T[]; total: number }>
  // Side-effect hook for callers that need the result set (e.g. updating a count badge).
  onDataChange?: (items: T[], total: number) => void
  // Increment to imperatively trigger a re-fetch (e.g. after a delete).
  refreshKey?: number | string
  onRowClick?: (row: T) => void
  getRowClassName?: (row: T) => string
  emptyMessage?: React.ReactNode
  initialSorting: SortingState
  compact?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ServerDataTable<T>({
  tableId,
  columns,
  filters: filtersProp,
  pageSize: pageSizeProp = 20,
  fetchData,
  onDataChange,
  refreshKey,
  instanceKey,
  onRowClick,
  getRowClassName,
  emptyMessage,
  initialSorting,
  initialCustomValues,
  initialData,
  compact,
}: ServerDataTableProps<T>): React.ReactElement {
  const { getParam, getMultiParam, setParams } = useTableUrlSync(tableId)

  // Specs are captured once at mount. Callers must pass a stable array (defined outside render
  // or wrapped in useMemo). Mutating specs after mount is not supported.
  const specsRef = useRef(filtersProp ?? [])
  const specs = specsRef.current
  const specMapRef = useRef(
    Object.fromEntries(
      specs
        .filter((s): s is CustomFilterSpec<unknown> | EntityFilterSpec<unknown> => s.type === 'custom' || s.type === 'entity')
        .map((s) => [s.key, s]),
    ),
  )

  // fetchData and onDataChange are always-current refs — their identity never enters any
  // effect dependency array, so changing closures won't trigger spurious re-fetches.
  const fetchDataRef = useRef(fetchData)
  fetchDataRef.current = fetchData
  const onDataChangeRef = useRef(onDataChange)
  onDataChangeRef.current = onDataChange

  // ---------------------------------------------------------------------------
  // Synchronous URL → state initialisation (runs once during first render)
  // ---------------------------------------------------------------------------
  type InitData = {
    filterValues: FilterValues
    customUnresolved: Record<string, string[]>
    initialPage: number
    initialPageSize: number
  }

  const initRef = useRef<InitData | null>(null)
  if (!initRef.current) {
    const filterValues: FilterValues = {}
    const customUnresolved: Record<string, string[]> = {}

    for (const spec of specs) {
      const handler = getHandler(spec)
      if (spec.type === 'search') {
        const raw = getParam(spec.key)
        filterValues[spec.key] = raw ? handler.fromUrl([raw], spec) : handler.defaultValue(spec)
      } else if (spec.type === 'entity') {
        const s = spec as EntityFilterSpec<unknown>
        const tokens = getMultiParam(spec.key)
        const op = tokens[0] === 'is' || tokens[0] === 'is_not' ? (tokens[0] as 'is' | 'is_not') : 'is'
        const ids = op === tokens[0] ? tokens.slice(1) : tokens
        if (ids.length === 0 && initialCustomValues?.[spec.key]?.length) {
          filterValues[spec.key] = { op: 'is', items: initialCustomValues[spec.key] } satisfies EntityVal
          customUnresolved[spec.key] = []
        } else {
          const instant: unknown[] = []
          const unresolved: string[] = []
          for (const id of ids) {
            const item = s.resolveInstant?.(id) ?? null
            if (item !== null) instant.push(item)
            else unresolved.push(id)
          }
          filterValues[spec.key] = { op, items: instant } satisfies EntityVal
          customUnresolved[spec.key] = unresolved
        }
      } else if (spec.type === 'custom') {
        const s = spec as CustomFilterSpec<unknown>
        const ids = getMultiParam(spec.key)
        if (ids.length === 0 && initialCustomValues?.[spec.key]?.length) {
          filterValues[spec.key] = initialCustomValues[spec.key]
          customUnresolved[spec.key] = []
        } else {
          const instant: unknown[] = []
          const unresolved: string[] = []
          for (const id of ids) {
            const item = s.resolveInstant?.(id) ?? null
            if (item !== null) instant.push(item)
            else unresolved.push(id)
          }
          filterValues[spec.key] = instant
          customUnresolved[spec.key] = unresolved
        }
      } else {
        const tokens = getMultiParam(spec.key)
        const val = tokens.length > 0 ? handler.fromUrl(tokens, spec) : null
        filterValues[spec.key] = val ?? handler.defaultValue(spec)
      }
    }

    const pageStr = getParam('page')
    const pageSizeStr = getParam('pageSize')
    initRef.current = {
      filterValues,
      customUnresolved,
      initialPage: pageStr ? Math.max(1, parseInt(pageStr, 10)) : 1,
      initialPageSize: pageSizeStr ? Math.max(1, parseInt(pageSizeStr, 10)) : pageSizeProp,
    }
  }

  // ---------------------------------------------------------------------------
  // Filter state — single dict for all filter types
  // ---------------------------------------------------------------------------
  const [filterValues, setFilterValues] = useState<FilterValues>(initRef.current.filterValues)
  const [isHydrating, setIsHydrating] = useState(() =>
    Object.values(initRef.current!.customUnresolved).some((ids) => ids.length > 0),
  )
  const [page, setPage] = useState(initRef.current.initialPage)
  const [pageSize, setPageSize] = useState(initRef.current.initialPageSize)
  const [data, setData] = useState<T[]>(() => initialData?.items ?? [])
  const [total, setTotal] = useState(() => initialData?.total ?? 0)
  const [loading, setLoading] = useState(() => !initialData)

  // ---------------------------------------------------------------------------
  // Async hydration for custom filters whose URL IDs weren't in memory
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const { customUnresolved } = initRef.current!
    const pending = Object.entries(customUnresolved).filter(([, ids]) => ids.length > 0)
    if (pending.length === 0) return

    let cancelled = false
    Promise.all(
      pending.map(([key, ids]) =>
        (specMapRef.current[key]?.resolveIds?.(ids) ?? Promise.resolve([])).then(
          (items) => [key, items] as const,
        ),
      ),
    )
      .then((results) => {
        if (cancelled) return
        setFilterValues((prev) => {
          const next = { ...prev }
          for (const [key, items] of results) {
            if (specMapRef.current[key]?.type === 'entity') {
              const cur = prev[key] as EntityVal | undefined
              next[key] = { op: cur?.op ?? 'is', items: [...(cur?.items ?? []), ...items] } satisfies EntityVal
            } else {
              next[key] = [...((prev[key] as unknown[]) ?? []), ...items]
            }
          }
          return next
        })
      })
      .catch(() => {})
      .finally(() => setIsHydrating(false))

    return () => { cancelled = true }
  }, []) // mount-only — initRef captures everything needed at construction time

  // ---------------------------------------------------------------------------
  // Stable serialisations used as effect dependencies
  // ---------------------------------------------------------------------------
  const searchSerialized = useMemo(
    () =>
      specs
        .filter((s) => s.type === 'search')
        .map((s) => `${s.key}=${(filterValues[s.key] as string) ?? ''}`)
        .sort()
        .join('&'),
    [filterValues], // specs is stable
  )
  // Debounce search: URL and fetch are both delayed while the user is typing.
  const debouncedSearchSerialized = useDebounce(searchSerialized, 300)

  const nonSearchSerialized = useMemo(
    () =>
      specs
        .filter((s) => s.type !== 'search')
        .map((s) => {
          const handler = getHandler(s)
          const val = filterValues[s.key] ?? handler.defaultValue(s)
          return `${s.key}=${handler.toUrl(val, s).join(',')}`
        })
        .sort()
        .join('&'),
    [filterValues], // specs is stable
  )

  // When initialData is provided we skip the first fetch — the data is already loaded.
  const initialFetchParamsRef = useRef<string | null>(
    initialData !== undefined
      ? `${debouncedSearchSerialized}|${nonSearchSerialized}|${page}|${pageSize}|${refreshKey ?? ''}|${instanceKey ?? ''}`
      : null,
  )

  // ---------------------------------------------------------------------------
  // URL sync: write all current filter values + page to URL params.
  // Fires when any serialised snapshot changes (including after search debounce).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const updates: Record<string, string | string[] | null> = {}

    for (const spec of specs) {
      const handler = getHandler(spec)
      const val = filterValues[spec.key] ?? handler.defaultValue(spec)
      const tokens = handler.toUrl(val, spec)
      updates[spec.key] = tokens.length > 0 ? tokens : null
    }
    updates.page = page > 1 ? String(page) : null
    updates.pageSize = pageSize !== pageSizeProp ? String(pageSize) : null

    setParams(updates)
  }, [debouncedSearchSerialized, nonSearchSerialized, page, pageSize]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Fetch: called when settled filter params, page, or refreshKey change.
  // Gated on hydration completing so the first fetch always has the correct values.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isHydrating) return

    if (initialFetchParamsRef.current !== null) {
      const sig = `${debouncedSearchSerialized}|${nonSearchSerialized}|${page}|${pageSize}|${refreshKey ?? ''}|${instanceKey ?? ''}`
      if (sig === initialFetchParamsRef.current) return
      initialFetchParamsRef.current = null
    }

    const filters: Record<string, string[]> = {}
    for (const spec of specs) {
      const handler = getHandler(spec)
      const val = filterValues[spec.key] ?? handler.defaultValue(spec)
      const params = handler.getFetchParams(val, spec)
      if (params.length > 0) filters[spec.key] = params
    }

    let cancelled = false
    setLoading(true)
    fetchDataRef.current({ filters, page, pageSize })
      .then(({ items, total: t }) => {
        if (cancelled) return
        setData(items)
        setTotal(t)
        onDataChangeRef.current?.(items, t)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [isHydrating, debouncedSearchSerialized, nonSearchSerialized, page, pageSize, refreshKey, instanceKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Filter change handlers
  // ---------------------------------------------------------------------------
  const handleFilterChange = useCallback((key: string, value: unknown) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const handleClearFilters = useCallback(() => {
    const cleared: FilterValues = {}
    for (const spec of specsRef.current) {
      cleared[spec.key] = getHandler(spec).defaultValue(spec)
    }
    setFilterValues(cleared)
    setPage(1)
  }, [])

  // ---------------------------------------------------------------------------
  // Active filter check
  // ---------------------------------------------------------------------------
  const hasActiveFilters = useMemo(
    () =>
      specs.some((spec) => {
        const handler = getHandler(spec)
        return !handler.isEmpty(filterValues[spec.key] ?? handler.defaultValue(spec))
      }),
    [filterValues], // specs is stable
  )

  const searchSpecs = specs.filter((s) => s.type === 'search')
  const chipSpecs = specs.filter((s) => s.type !== 'search')

  const searchSlot = searchSpecs.length > 0 ? (
    <>
      {searchSpecs.map((spec) => (
        <div key={spec.key} className="relative shrink-0">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search…"
            value={(filterValues[spec.key] as string) ?? ''}
            onChange={(e) => handleFilterChange(spec.key, e.target.value)}
            className="h-8 pl-7 text-xs focus-visible:ring-offset-0 w-28 sm:w-36"
          />
        </div>
      ))}
    </>
  ) : undefined

  const filtersSlot = chipSpecs.length > 0 ? (
    <FilterChipBar
      specs={chipSpecs}
      values={filterValues}
      onChange={handleFilterChange}
      onClear={handleClearFilters}
      hasActiveFilters={hasActiveFilters}
      compact={compact}
    />
  ) : undefined

  return (
    <DataTable
      tableId={tableId}
      columns={columns}
      data={data}
      loading={loading}
      hideSearch
      searchSlot={searchSlot}
      filtersSlot={filtersSlot}
      serverPagination={{ totalRows: total, page, pageSize, onPageChange: setPage, onPageSizeChange: (s) => { setPageSize(s); setPage(1) } }}
      pageSize={pageSize}
      onRowClick={onRowClick}
      getRowClassName={getRowClassName}
      emptyMessage={emptyMessage}
      initialSorting={initialSorting}
      compact={compact}
    />
  )
}
