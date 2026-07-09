import * as React from 'react'
import { useAuth } from '../../context/auth'
import { useRunLeaderboard } from '../../hooks/useRunLeaderboard'
import { RunLeaderboard } from '../leaderboard/RunLeaderboard'
import { type LeaderboardRun } from '../../lib/api'

type Props = {
  trainingId: number
  runIndex: number
  initialRows?: LeaderboardRun[]
}

export function DashboardLeaderboard({ trainingId, runIndex, initialRows }: Props): React.ReactElement {
  const { user } = useAuth()
  const { rows, loading } = useRunLeaderboard({ trainingId, runIndex, enabled: initialRows === undefined })

  return (
    <RunLeaderboard
      rows={initialRows ?? rows}
      runIndex={runIndex}
      compact
      loading={initialRows === undefined && loading}
      currentUserId={user?.id}
    />
  )
}
