import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { useAuth } from '../context/auth'
import { TrainingItemTypeBadge } from '../components/TrainingItemTypeBadge'
import { ConceptIcon } from '../components/ConceptIcon'

export function SourcesListPage(): React.ReactElement | null {
  const { user } = useAuth()

  if (!user) return null

  return (
    <PageWrapper className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 text-base font-semibold"><ConceptIcon concept="Source" />Sources</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold">Lichess Tactics</h2>
            <TrainingItemTypeBadge source="LICHESS_TACTIC" />
          </div>

          <p className="text-sm text-muted-foreground">
            Tactical puzzles imported from the Lichess puzzle database, one of the largest collections
            of chess puzzles in the world. Browse stats, rating distributions, themes, and example tactics.
          </p>

          <div className="mt-auto">
            <Link
              to="/app/sources/lichess-tactics"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              More information
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold">Scraped Positional</h2>
            <TrainingItemTypeBadge source="SCRAPED_POSITIONAL" />
          </div>

          <p className="text-sm text-muted-foreground">
            Positional puzzles mined from Lichess games and reviewed by titled players. Each puzzle
            has a single best answer. Ranked by four difficulty tiers from 1200 to 2000+ ELO.
          </p>

          <div className="mt-auto">
            <Link
              to="/app/sources/scraped-positional-puzzles"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              More information
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold">Decoys</h2>
            <TrainingItemTypeBadge source="DECOY" />
          </div>

          <p className="text-sm text-muted-foreground">
            Positions from master games where the engine confirms at least three moves are within
            50 centipawns of the best evaluation. Included in subsets to train resisting the urge
            to force something when no tactic exists.
          </p>

          <div className="mt-auto">
            <Link
              to="/app/sources/decoys"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              More information
            </Link>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
