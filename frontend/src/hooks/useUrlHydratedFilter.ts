import { useState, useEffect, useRef } from 'react'
import type { SyncedFilter } from '../components/DataTable'
import { useTableUrlSync } from './useTableUrlSync'

export type UseUrlHydratedFilterOptions<T> = {
  urlKey: string
  tableId: string | false | undefined
  fetchByIds: (ids: string[]) => Promise<T[]>
  getIdFromItem: (item: T) => string
  // Resolve an item from memory without a fetch — called for each URL ID at mount.
  // Return null to fall back to fetchByIds for that ID.
  resolveInstant?: (id: string) => T | null
}

export type UseUrlHydratedFilterResult<T> = {
  value: T[]
  setValue: React.Dispatch<React.SetStateAction<T[]>>
  // True while the initial fetch is in flight. Gate your data-fetch useEffect on !isHydrating
  // to avoid a first render with incorrect (empty) filter state.
  isHydrating: boolean
  // True if the URL contained IDs on mount. Use this to decide whether to apply component-level
  // defaults (e.g. "default to current user when URL has no userId").
  hadInitialIds: boolean
  syncedFilter: SyncedFilter
}

export function useUrlHydratedFilter<T>({
  urlKey,
  tableId,
  fetchByIds,
  getIdFromItem,
  resolveInstant,
}: UseUrlHydratedFilterOptions<T>): UseUrlHydratedFilterResult<T> {
  const { getMultiParam } = useTableUrlSync(tableId)

  // Computed once at mount. Using a ref (not useMemo) so the computation is available
  // synchronously inside useState initialisers without React complaining about ordering.
  const initRef = useRef<{ ids: string[]; unresolved: string[]; instant: T[] } | null>(null)
  if (!initRef.current) {
    const ids = getMultiParam(urlKey)
    const instant: T[] = []
    const unresolved: string[] = []
    for (const id of ids) {
      const item = resolveInstant?.(id) ?? null
      if (item !== null) instant.push(item)
      else unresolved.push(id)
    }
    initRef.current = { ids, unresolved, instant }
  }

  const [value, setValue] = useState<T[]>(initRef.current.instant)
  const [isHydrating, setIsHydrating] = useState(initRef.current.unresolved.length > 0)

  useEffect(() => {
    const { unresolved } = initRef.current!
    if (unresolved.length === 0) return
    fetchByIds(unresolved)
      .then((fetched) => setValue((prev) => [...prev, ...fetched]))
      .catch(() => {})
      .finally(() => setIsHydrating(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Intentionally mount-only: initRef captures everything needed at construction time

  const syncedFilter: SyncedFilter = {
    key: urlKey,
    value: value.map(getIdFromItem),
    onChange: (ids) => { if (ids.length === 0) setValue([]) },
  }

  return {
    value,
    setValue,
    isHydrating,
    hadInitialIds: initRef.current.ids.length > 0,
    syncedFilter,
  }
}
