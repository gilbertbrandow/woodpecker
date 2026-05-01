import * as React from 'react'
import { api } from '../lib/api'
import type { ActiveRun } from '../lib/api'

export function useActiveRun(): { data: ActiveRun | null; loading: boolean } {
  const [data, setData] = React.useState<ActiveRun | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    api.runs
      .getActive()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}
