import { useState, useEffect, useRef } from 'react'

export function useApiData<T>(fetch: () => Promise<T>): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef(fetch)
  fetchRef.current = fetch

  useEffect(() => {
    let cancelled = false
    fetchRef.current()
      .then((result) => { if (!cancelled) setData(result) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { data, loading }
}
