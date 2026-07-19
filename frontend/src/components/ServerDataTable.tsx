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
import { getStored, setStored } from '../lib/storage'

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
  // Pass false to disable URL sync entirely (wizard/picker tables).
  tableId?: string | false
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
  // localStorage key under which active filter state is persisted across remounts and
  // page reloads. URL params take priority over stored values; stored values take priority
  // over initialCustomValues. Written as {} when all filters are cleared (so an explicit
  // empty state is distinguishable from "never set" on the next mount).
  persistFilters?: string
  columns: ColumnDef<T>[]
  // Declared filter slots, rendered left-to-right in the filter bar.
  filters?: FilterSpec[]
  pageSize: number
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
  footerRow?: React.ReactNode
  onFooterRowClick?: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ServerDataTable<T>({
  tableId,
  columns,
  filters: filtersProp,
  pageSize: pageSizeProp,
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
  footerRow,
  onFooterRowClick,
  persistFilters,
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
    // Raw stored tokens for entity/custom keys that have unresolved IDs. Used as fetch-param
    // fallback during hydration so the initial fetch can run in parallel with ID resolution.
    pendingFetchParams: Record<string, string[]>
    initialPage: number
    initialPageSize: number
  }

  const initRef = useRef<InitData | null>(null)
  if (!initRef.current) {
    const filterValues: FilterValues = {}
    const customUnresolved: Record<string, string[]> = {}
    const pendingFetchParams: Record<string, string[]> = {}

    // URL params take priority; stored values fill in what the URL doesn't carry.
    const persistedFilters = persistFilters
      ? getStored<Record<string, string[]>>(persistFilters)
      : null
    const getTokens = (key: string): string[] => {
      const urlTokens = getMultiParam(key)
      if (urlTokens.length > 0) return urlTokens
      return persistedFilters?.[key] ?? []
    }

    for (const spec of specs) {
      const handler = getHandler(spec)
      if (spec.type === 'search') {
        const raw = getParam(spec.key) ?? persistedFilters?.[spec.key]?.[0]
        filterValues[spec.key] = raw ? handler.fromUrl([raw], spec) : handler.defaultValue(spec)
      } else if (spec.type === 'entity') {
        const s = spec as EntityFilterSpec<unknown>
        const tokens = getTokens(spec.key)
        const op = tokens[0] === 'is' || tokens[0] === 'is_not' ? (tokens[0] as 'is' | 'is_not') : 'is'
        const ids = op === tokens[0] ? tokens.slice(1) : tokens
        // Only fall back to initialCustomValues when there is no persisted state at all.
        // An empty persistedFilters ({}) means the user explicitly cleared all filters.
        if (ids.length === 0 && initialCustomValues?.[spec.key]?.length && persistedFilters === null) {
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
          filterValues[spec.key] = { op, items: instant, pendingCount: unresolved.length || undefined } satisfies EntityVal
          customUnresolved[spec.key] = unresolved
          // Store raw tokens so the fetch can proceed in parallel with ID resolution.
          if (unresolved.length > 0) pendingFetchParams[spec.key] = tokens
        }
      } else if (spec.type === 'custom') {
        const s = spec as CustomFilterSpec<unknown>
        const ids = getTokens(spec.key)
        if (ids.length === 0 && initialCustomValues?.[spec.key]?.length && persistedFilters === null) {
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
          if (unresolved.length > 0) pendingFetchParams[spec.key] = ids
        }
      } else {
        const tokens = getTokens(spec.key)
        const val = tokens.length > 0 ? handler.fromUrl(tokens, spec) : null
        filterValues[spec.key] = val ?? handler.defaultValue(spec)
      }
    }

    const pageStr = getParam('page')
    const pageSizeStr = getParam('pageSize')
    initRef.current = {
      filterValues,
      customUnresolved,
      pendingFetchParams,
      initialPage: pageStr ? Math.max(1, parseInt(pageStr, 10)) : 1,
      initialPageSize: pageSizeStr ? Math.max(1, parseInt(pageSizeStr, 10)) : pageSizeProp,
    }
  }

  // ---------------------------------------------------------------------------
  // Filter state — single dict for all filter types
  // ---------------------------------------------------------------------------
  const [filterValues, setFilterValues] = useState<FilterValues>(initRef.current.filterValues)
  // Raw stored tokens for entity/custom keys still being hydrated. Cleared when hydration
  // completes. Used as fallback in fetch params and serialization so the initial fetch can
  // run immediately without waiting for display-name resolution.
  const pendingFetchParamsRef = useRef(initRef.current.pendingFetchParams)
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
      .finally(() => { pendingFetchParamsRef.current = {} })

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
          const tokens = handler.toUrl(val, s)
          // Prefer pending tokens over partially-resolved tokens so the serialized value is
          // stable across hydration: raw stored IDs and resolved-item IDs serialize identically,
          // and this avoids a double-fetch when some IDs resolve instantly and others don't.
          const effectiveTokens = pendingFetchParamsRef.current[s.key] ?? tokens
          return `${s.key}=${effectiveTokens.join(',')}`
        })
        .sort()
        .join('&'),
    [filterValues], // specs and pendingFetchParamsRef are stable refs
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
    const stored: Record<string, string[]> = {}

    for (const spec of specs) {
      const handler = getHandler(spec)
      const val = filterValues[spec.key] ?? handler.defaultValue(spec)
      const tokens = handler.toUrl(val, spec)
      // Prefer pending tokens: ensures URL and storage are correct during hydration even
      // when only some IDs resolved instantly (pending always has the full original set).
      const effectiveTokens = pendingFetchParamsRef.current[spec.key] ?? tokens
      updates[spec.key] = effectiveTokens.length > 0 ? effectiveTokens : null
      if (effectiveTokens.length > 0) stored[spec.key] = effectiveTokens
    }
    updates.page = page > 1 ? String(page) : null
    updates.pageSize = pageSize !== pageSizeProp ? String(pageSize) : null

    setParams(updates)

    // Always write to storage (even when empty) so an explicit "clear all filters" is
    // persisted as {} and distinguishable from "never set" (null) on the next mount.
    if (persistFilters) {
      setStored(persistFilters, stored)
    }
  }, [debouncedSearchSerialized, nonSearchSerialized, page, pageSize]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Fetch: called when settled filter params, page, or refreshKey change.
  // Runs immediately on mount — pending fetch params supply correct IDs for any keys
  // still being hydrated, so hydration and fetch happen in parallel.
  // ---------------------------------------------------------------------------
  useEffect(() => {
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
      // Prefer pending raw tokens: ensures the backend always receives the full original ID
      // set during hydration, even when some IDs resolved instantly (giving non-empty params).
      const effectiveParams = pendingFetchParamsRef.current[spec.key] ?? params
      if (effectiveParams.length > 0) filters[spec.key] = effectiveParams
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
  }, [debouncedSearchSerialized, nonSearchSerialized, page, pageSize, refreshKey, instanceKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Filter change handlers
  // ---------------------------------------------------------------------------
  const handleFilterChange = useCallback((key: string, value: unknown) => {
    // Clear pending for this key so the user's new selection isn't overridden by stale
    // hydration tokens if hydration hasn't completed yet.
    delete pendingFetchParamsRef.current[key]
    setFilterValues((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const handleClearFilters = useCallback(() => {
    pendingFetchParamsRef.current = {}
    setFilterValues((prev) => {
      const next = { ...prev }
      for (const spec of specsRef.current) {
        if (spec.type !== 'search') next[spec.key] = getHandler(spec).defaultValue(spec)
      }
      return next
    })
    setPage(1)
  }, [])

  const searchSpecs = specs.filter((s) => s.type === 'search')
  const chipSpecs = specs.filter((s) => s.type !== 'search')

  const hasActiveFilters = useMemo(
    () =>
      chipSpecs.some((spec) => {
        const handler = getHandler(spec)
        // Also check pending params: an entity being hydrated has items:[] (isEmpty → true)
        // but is still an active filter and should show the clear-all button.
        return (
          !handler.isEmpty(filterValues[spec.key] ?? handler.defaultValue(spec)) ||
          (pendingFetchParamsRef.current[spec.key]?.length ?? 0) > 0
        )
      }),
    [filterValues], // specs, chipSpecs, and pendingFetchParamsRef are stable refs
  )

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
      footerRow={footerRow}
      onFooterRowClick={onFooterRowClick}
    />
  )
}
