import { useState, useEffect } from 'react'
import { api, type WeeklyLeaderboardRow } from '../lib/api'

type Opts = {
  scheduleIds?: number[]
  enabled?: boolean
}

export function useWeeklyLeaderboard({ scheduleIds, enabled = true }: Opts): {
  rows: WeeklyLeaderboardRow[]
  loading: boolean
  error: boolean
} {
  const [rows, setRows] = useState<WeeklyLeaderboardRow[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(false)

  const scheduleIdsKey = scheduleIds?.join(',') ?? ''

  useEffect(() => {
    if (!enabled) return
    setLoading(true)
    setError(false)
    api.leaderboard
      .getWeekly(scheduleIds?.length ? scheduleIds : undefined)
      .then(setRows)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, scheduleIdsKey])

  return { rows, loading, error }
}
