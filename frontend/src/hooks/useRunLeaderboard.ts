import { useState, useEffect } from 'react'
import { api, type LeaderboardRun } from '../lib/api'

type Opts = {
  scheduleId?: number
  trainingId?: number
  runIndex?: number
  enabled?: boolean
}

export function useRunLeaderboard({ scheduleId, trainingId, runIndex, enabled = true }: Opts): {
  rows: LeaderboardRun[]
  loading: boolean
  error: boolean
} {
  const [rows, setRows] = useState<LeaderboardRun[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!enabled) return
    setLoading(true)
    setError(false)
    api.leaderboard
      .getRuns({ scheduleId, trainingId, runIndex })
      .then(setRows)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [enabled, scheduleId, trainingId, runIndex])

  return { rows, loading, error }
}
