import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { useState, useEffect } from 'react'
import { api, type LeaderboardRun } from '../lib/api'
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable'

export function DashboardPage(): React.ReactElement {
  const [runs, setRuns] = useState<LeaderboardRun[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void api.leaderboard.list().then((data) => {
      setRuns(data)
      setLoading(false)
    })
  }, [])

  return (
    <PageWrapper className="flex flex-col gap-6">
      <h1 className="text-base font-semibold">Leaderboard</h1>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <LeaderboardTable runs={runs} />
      )}
    </PageWrapper>
  )
}
