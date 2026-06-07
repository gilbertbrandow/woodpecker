import * as React from 'react'
import { useState, useEffect } from 'react'
import { api, type LeaderboardRun } from '../../lib/api'
import { useAuth } from '../../context/auth'
import { RunLeaderboard } from '../leaderboard/RunLeaderboard'

type Props = {
  trainingId: number
  runIndex: number
}

export function DashboardLeaderboard({ trainingId, runIndex }: Props): React.ReactElement {
  const { user } = useAuth()
  const [rows, setRows] = useState<LeaderboardRun[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.leaderboard
      .getRunLeaderboard(trainingId, runIndex)
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [trainingId, runIndex])

  return (
    <RunLeaderboard
      rows={rows}
      runIndex={runIndex}
      compact
      loading={loading}
      currentUserDisplayName={user?.displayName}
    />
  )
}
