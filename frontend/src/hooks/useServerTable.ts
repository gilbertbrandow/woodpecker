import { useState } from 'react'

export function useServerTable(): { refreshKey: number; refetch: () => void } {
  const [refreshKey, setRefreshKey] = useState(0)
  return {
    refreshKey,
    refetch: () => setRefreshKey((k) => k + 1),
  }
}
