import * as React from 'react'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { type ColumnDef, type SortingState } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { DataTable } from './DataTable'
import { FilterChipBar } from './FilterChipBar'
import { Input } from './ui/input'
import { useTableUrlSync } from '../hooks/useTableUrlSync'
import { useDebounce } from '../hooks/useDebounce'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SearchFilterSpec = {
  type: 'search'
  key: string
}

export type MultiFilterSpec = {
  type: 'multi'
  key: string
  label: string
  options: { label: string; value: string; icon?: React.ReactNode }[]
  icon?: React.ComponentType<{ className?: string }>
}

// General-purpose filter for entity-hydrated values (UserSelector, ScheduleSelector, …).
// TItem is the display-layer type (e.g. SelectableUser). The URL and fetchData always use
// the string[] produced by serialize().
export type CustomFilterSpec<TItem> = {
  type: 'custom'
  key: string
  // Renders the filter UI. Called with the current hydrated items and an onChange handler.
  render: (value: TItem[], onChange: (items: TItem[]) => void) => React.ReactNode
  // Converts hydrated items → string IDs for the URL and for fetchData params.
  serialize: (items: TItem[]) => string[]
  // Fast synchronous resolution from in-memory data (e.g. current user from auth context,
  // the special token 'me'). Return null to fall through to resolveIds.
  resolveInstant?: (id: string) => TItem | null
  // Async fallback for IDs that couldn't be resolved synchronously (e.g. GET /users/by-ids).
  resolveIds?: (ids: string[]) => Promise<TItem[]>
  // Display name shown in filter chips and the picker (e.g. "Users").
  label?: string
  // Icon shown in the picker list and chip type label.
  icon?: React.ComponentType<{ className?: string }>
  // kept for backward compat – prefer icon
  // Items to pre-populate when the filter is first added from the panel (e.g. current user).
  defaultItems?: TItem[]
  // Renders just the editor content without a trigger button — used inside chip popovers.
  // Falls back to render() if omitted.
  renderContent?: (value: TItem[], onChange: (items: TItem[]) => void) => React.ReactNode
  // Produces a short readable label for the active-filter chip (e.g. "Simon G" or "3 users").
  getChipLabel?: (items: TItem[]) => string
  // Renders rich visual content inside the chip's value button (avatars, badges, etc.).
  // Falls back to the getChipLabel text if omitted.
  renderChipValue?: (items: TItem[]) => React.ReactNode
}

export type FilterSpec = SearchFilterSpec | MultiFilterSpec | CustomFilterSpec<any>

export type FetchParams = {
  // Every filter's current value as string[]. Search filters produce a single-element array.
  filters: Record<string, string[]>
  page: number
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
  initialSorting?: SortingState
  compact?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ServerDataTable<T>({
  tableId,
  columns,
  filters: filtersProp,
  pageSize = 20,
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
        .filter((s): s is CustomFilterSpec<unknown> => s.type === 'custom')
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
    searchValues: Record<string, string>
    multiValues: Record<string, string[]>
    customInstant: Record<string, unknown[]>   // immediately resolved from memory
    customUnresolved: Record<string, string[]> // need async fetch
    initialPage: number
  }

  const initRef = useRef<InitData | null>(null)
  if (!initRef.current) {
    const searchValues: Record<string, string> = {}
    const multiValues: Record<string, string[]> = {}
    const customInstant: Record<string, unknown[]> = {}
    const customUnresolved: Record<string, string[]> = {}

    for (const spec of specs) {
      if (spec.type === 'search') {
        searchValues[spec.key] = getParam(spec.key) ?? ''
      } else if (spec.type === 'multi') {
        multiValues[spec.key] = getMultiParam(spec.key)
      } else {
        const s = spec as CustomFilterSpec<unknown>
        const ids = getMultiParam(spec.key)
        if (ids.length === 0 && initialCustomValues?.[spec.key]?.length) {
          // No URL param present — use caller-provided initial values directly.
          customInstant[spec.key] = initialCustomValues[spec.key]
          customUnresolved[spec.key] = []
        } else {
          const instant: unknown[] = []
          const unresolved: string[] = []
          for (const id of ids) {
            const item = s.resolveInstant?.(id) ?? null
            if (item !== null) instant.push(item)
            else unresolved.push(id)
          }
          customInstant[spec.key] = instant
          customUnresolved[spec.key] = unresolved
        }
      }
    }

    const pageStr = getParam('page')
    initRef.current = {
      searchValues,
      multiValues,
      customInstant,
      customUnresolved,
      initialPage: pageStr ? Math.max(1, parseInt(pageStr, 10)) : 1,
    }
  }

  // ---------------------------------------------------------------------------
  // Filter state
  // ---------------------------------------------------------------------------
  const [rawSearch, setRawSearch] = useState(initRef.current.searchValues)
  const [multiValues, setMultiValues] = useState(initRef.current.multiValues)
  const [customValues, setCustomValues] = useState(initRef.current.customInstant)
  const [isHydrating, setIsHydrating] = useState(() =>
    Object.values(initRef.current!.customUnresolved).some((ids) => ids.length > 0),
  )
  const [page, setPage] = useState(initRef.current.initialPage)
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
        // Guard: if the user cleared filters while the fetch was in flight, don't inject
        // stale hydrated items back into state.
        if (cancelled) return
        setCustomValues((prev) => {
          const next = { ...prev }
          for (const [key, items] of results) next[key] = [...(prev[key] ?? []), ...items]
          return next
        })
      })
      .catch(() => {})
      .finally(() => setIsHydrating(false))

    return () => { cancelled = true }
  }, []) // mount-only — initRef captures everything needed at construction time

  // ---------------------------------------------------------------------------
  // Stable serialisations used as effect dependencies
  // These only produce a new string when actual values change, not on every render.
  // ---------------------------------------------------------------------------
  const searchSerialized = useMemo(
    () =>
      Object.entries(rawSearch)
        .sort()
        .map(([k, v]) => `${k}=${v}`)
        .join('&'),
    [rawSearch],
  )
  // Debounce search: URL and fetch are both delayed while the user is typing.
  const debouncedSearchSerialized = useDebounce(searchSerialized, 300)

  const multiSerialized = useMemo(
    () =>
      Object.entries(multiValues)
        .sort()
        .map(([k, v]) => `${k}=${v.join(',')}`)
        .join('&'),
    [multiValues],
  )

  const customSerialized = useMemo(
    () =>
      Object.entries(customValues)
        .sort()
        .map(([k, v]) => `${k}=${(specMapRef.current[k]?.serialize(v) ?? []).join(',')}`)
        .join('&'),
    [customValues],
  )

  // When initialData is provided we skip the first fetch — the data is already loaded.
  // Using a params-snapshot instead of a consumed-once flag so React Strict Mode's
  // double-invoke of effects doesn't bypass the skip on the second invocation.
  const initialFetchParamsRef = useRef<string | null>(
    initialData !== undefined
      ? `${debouncedSearchSerialized}|${multiSerialized}|${customSerialized}|${page}|${refreshKey ?? ''}|${instanceKey ?? ''}`
      : null,
  )

  // ---------------------------------------------------------------------------
  // URL sync: write all current filter values + page to URL params.
  // Fires when any serialised snapshot changes (including after search debounce).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const updates: Record<string, string | string[] | null> = {}

    for (const spec of specs) {
      if (spec.type === 'search') {
        updates[spec.key] = rawSearch[spec.key] || null
      } else if (spec.type === 'multi') {
        const vals = multiValues[spec.key] ?? []
        updates[spec.key] = vals.length > 0 ? vals : null
      } else {
        const s = spec as CustomFilterSpec<unknown>
        const ids = s.serialize(customValues[spec.key] ?? [])
        updates[spec.key] = ids.length > 0 ? ids : null
      }
    }
    updates.page = page > 1 ? String(page) : null

    setParams(updates)
  }, [debouncedSearchSerialized, multiSerialized, customSerialized, page]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Fetch: called when settled filter params, page, or refreshKey change.
  // Gated on hydration completing so the first fetch always has the correct values.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isHydrating) return

    // Skip the fetch if params haven't changed from the initial seeded state.
    // Clearing the ref after any change ensures all subsequent fetches run normally.
    if (initialFetchParamsRef.current !== null) {
      const sig = `${debouncedSearchSerialized}|${multiSerialized}|${customSerialized}|${page}|${refreshKey ?? ''}|${instanceKey ?? ''}`
      if (sig === initialFetchParamsRef.current) return
      initialFetchParamsRef.current = null
    }

    const filters: Record<string, string[]> = {}
    for (const spec of specs) {
      if (spec.type === 'search') {
        const v = rawSearch[spec.key]
        if (v) filters[spec.key] = [v]
      } else if (spec.type === 'multi') {
        filters[spec.key] = multiValues[spec.key] ?? []
      } else {
        const s = spec as CustomFilterSpec<unknown>
        filters[spec.key] = s.serialize(customValues[spec.key] ?? [])
      }
    }

    let cancelled = false
    setLoading(true)
    fetchDataRef.current({ filters, page })
      .then(({ items, total: t }) => {
        if (cancelled) return
        setData(items)
        setTotal(t)
        onDataChangeRef.current?.(items, t)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [isHydrating, debouncedSearchSerialized, multiSerialized, customSerialized, page, refreshKey, instanceKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Filter change handlers — stable across renders (empty dep arrays, use specsRef)
  // ---------------------------------------------------------------------------
  const handleSearchChange = useCallback((key: string, value: string) => {
    setRawSearch((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const handleMultiChange = useCallback((key: string, values: string[]) => {
    setMultiValues((prev) => ({ ...prev, [key]: values }))
    setPage(1)
  }, [])

  const handleCustomChange = useCallback((key: string, items: unknown[]) => {
    setCustomValues((prev) => ({ ...prev, [key]: items }))
    setPage(1)
  }, [])

  const handleClearFilters = useCallback(() => {
    setRawSearch({})
    setMultiValues({})
    setCustomValues({})
    setPage(1)
  }, [])

  // ---------------------------------------------------------------------------
  // Active filter check — drives the "Clear filters" button visibility in DataTable
  // ---------------------------------------------------------------------------
  const hasActiveFilters = useMemo(() => {
    for (const spec of specs) {
      if (spec.type === 'search' && rawSearch[spec.key]) return true
      if (spec.type === 'multi' && (multiValues[spec.key] ?? []).length > 0) return true
      if (spec.type === 'custom' && (customValues[spec.key] ?? []).length > 0) return true
    }
    return false
  }, [rawSearch, multiValues, customValues]) // specs is stable

  const searchSpecs = specs.filter((s) => s.type === 'search')
  const chipSpecs = specs.filter((s) => s.type !== 'search')

  const filtersSlot = (
    <>
      {searchSpecs.map((spec) => (
        <div key={spec.key} className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search…"
            value={rawSearch[spec.key] ?? ''}
            onChange={(e) => handleSearchChange(spec.key, e.target.value)}
            className="h-8 pl-7 text-xs focus-visible:ring-offset-0 w-28 sm:w-36"
          />
        </div>
      ))}
      {chipSpecs.length > 0 && (
        <FilterChipBar
          specs={chipSpecs}
          searchValues={rawSearch}
          multiValues={multiValues}
          customValues={customValues}
          onSearchChange={handleSearchChange}
          onMultiChange={handleMultiChange}
          onCustomChange={handleCustomChange}
          onClearAll={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
          compact={compact}
        />
      )}
    </>
  )

  return (
    <DataTable
      tableId={tableId}
      columns={columns}
      data={data}
      loading={loading}
      hideSearch
      filtersSlot={filtersSlot}
      serverPagination={{ totalRows: total, page, pageSize, onPageChange: setPage }}
      pageSize={pageSize}
      onRowClick={onRowClick}
      getRowClassName={getRowClassName}
      emptyMessage={emptyMessage}
      initialSorting={initialSorting}
      compact={compact}
    />
  )
}
