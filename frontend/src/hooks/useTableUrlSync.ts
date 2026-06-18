import { useCallback } from 'react'

export type TableUrlSync = {
  getParam: (key: string) => string | undefined
  getMultiParam: (key: string) => string[]
  setParams: (updates: Record<string, string | string[] | null>) => void
}

// tableId behaviour:
//   undefined  → no prefix; use on single-table pages (flat params: ?q=foo&page=2)
//   "run"      → prefixed;  use on multi-table pages (?run_q=foo&run_page=2)
//   false      → disabled;  use for wizard/picker DataTables that should not sync to URL
export function useTableUrlSync(tableId: string | false | undefined): TableUrlSync {
  const disabled = tableId === false
  const prefix = typeof tableId === 'string' ? `${tableId}_` : ''

  const getParam = useCallback(
    (key: string): string | undefined => {
      if (disabled) return undefined
      return new URLSearchParams(window.location.search).get(`${prefix}${key}`) ?? undefined
    },
    [disabled, prefix],
  )

  const getMultiParam = useCallback(
    (key: string): string[] => {
      if (disabled) return []
      const v = new URLSearchParams(window.location.search).get(`${prefix}${key}`)
      if (!v) return []
      return v.split(',').filter(Boolean)
    },
    [disabled, prefix],
  )

  const setParams = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      if (disabled) return
      const current = new URLSearchParams(window.location.search)
      for (const [key, value] of Object.entries(updates)) {
        const fullKey = `${prefix}${key}`
        if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
          current.delete(fullKey)
        } else if (Array.isArray(value)) {
          current.set(fullKey, value.join(','))
        } else {
          current.set(fullKey, value)
        }
      }
      const search = current.toString().replace(/%2C/gi, ',')
      const newHref = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
      // Direct replaceState — synchronous URL update that doesn't go through TanStack
      // Router's navigation pipeline, which avoids corrupting router state.
      window.history.replaceState(window.history.state, '', newHref)
    },
    [disabled, prefix],
  )

  return { getParam, getMultiParam, setParams }
}
