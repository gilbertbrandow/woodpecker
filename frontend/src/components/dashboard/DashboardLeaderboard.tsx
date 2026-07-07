import * as React from 'react'
import { useAuth } from '../../context/auth'
import { useRunLeaderboard } from '../../hooks/useRunLeaderboard'
import { RunLeaderboard } from '../leaderboard/RunLeaderboard'

type Props = {
  trainingId: number
  runIndex: number
}

export function DashboardLeaderboard({ trainingId, runIndex }: Props): React.ReactElement {
  const { user } = useAuth()
  const { rows, loading } = useRunLeaderboard({ trainingId, runIndex })

  return (
    <RunLeaderboard
      rows={rows}
      runIndex={runIndex}
      compact
      loading={loading}
      currentUserId={user?.id}
    />
  )
}
