import { useState, useEffect } from 'react'
import { api, type WeeklyLeaderboardRow } from '../lib/api'

type Opts = {
  scheduleId?: number
  enabled?: boolean
}

export function useWeeklyLeaderboard({ scheduleId, enabled = true }: Opts): {
  rows: WeeklyLeaderboardRow[]
  loading: boolean
  error: boolean
} {
  const [rows, setRows] = useState<WeeklyLeaderboardRow[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!enabled) return
    setLoading(true)
    setError(false)
    api.leaderboard
      .getWeekly(scheduleId)
      .then(setRows)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [enabled, scheduleId])

  return { rows, loading, error }
}
