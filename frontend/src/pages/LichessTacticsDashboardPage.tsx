import * as React from 'react'
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/auth'
import { api, type LichessTacticsStats, type LichessTacticsRatingDistribution, type LichessTacticsTopThemes } from '../lib/api'
import { LichessTacticsDashboard } from '../components/sources/LichessTacticsDashboard'
import { LichessTacticsItemsSection } from '../components/sources/LichessTacticsItemsSection'

export function LichessTacticsDashboardPage(): React.ReactElement | null {
  const { user } = useAuth()
  const [stats, setStats] = useState<LichessTacticsStats | null>(null)
  const [distribution, setDistribution] = useState<LichessTacticsRatingDistribution | null>(null)
  const [topThemes, setTopThemes] = useState<LichessTacticsTopThemes | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      api.sources.lichessTactics.stats(),
      api.sources.lichessTactics.ratingDistribution(),
      api.sources.lichessTactics.topThemes(),
    ])
      .then(([s, d, t]) => {
        setStats(s)
        setDistribution(d)
        setTopThemes(t)
      })
      .catch(() => toast.error('Failed to load dashboard', { description: 'Could not fetch Lichess Tactics data.' }))
      .finally(() => setLoading(false))
  }, [user])

  if (!user) return null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/app/sources" className="hover:text-foreground">
          Sources
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">Lichess Tactics</span>
      </nav>

      <h1 className="text-base font-semibold">Collection insights</h1>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : stats && distribution && topThemes ? (
        <>
          <LichessTacticsDashboard stats={stats} distribution={distribution} topThemes={topThemes} />
          <LichessTacticsItemsSection />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No data available.</p>
      )}
    </div>
  )
}
