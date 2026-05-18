import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { useAuth } from '../context/auth'

export function SourcesListPage(): React.ReactElement | null {
  const { user } = useAuth()

  if (!user) return null

  return (
    <PageWrapper className="flex flex-col gap-6">
      <h1 className="text-base font-semibold">Sources</h1>

      <div className="flex flex-col gap-4 rounded-lg border bg-card p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Lichess Tactics</h2>
        </div>

        <p className="text-sm text-muted-foreground">
          Tactical puzzles imported from the Lichess puzzle database, one of the largest collections
          of chess puzzles in the world. Browse stats, rating distributions, themes, and example tactics.
        </p>

        <div>
          <Link
            to="/app/sources/lichess-tactics"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            More information
          </Link>
        </div>
      </div>
    </PageWrapper>
  )
}
