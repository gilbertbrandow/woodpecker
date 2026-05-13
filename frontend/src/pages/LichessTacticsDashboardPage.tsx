import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../context/auth'

export function LichessTacticsDashboardPage(): React.ReactElement | null {
  const { user } = useAuth()

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

      <h1 className="text-base font-semibold">Lichess Tactics</h1>

      <p className="text-sm text-muted-foreground">Loading dashboard…</p>
    </div>
  )
}
