import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { useAuth } from '../context/auth'

export function SourcesListPage(): React.ReactElement | null {
  const { user } = useAuth()

  if (!user) return null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-base font-semibold">Sources</h1>

      <div className="flex flex-col gap-6 rounded-lg border bg-card p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Lichess Tactics</h2>
          <p className="text-xs text-muted-foreground">Tactical puzzles</p>
        </div>

        <div className="flex flex-col gap-3 text-sm text-foreground">
          <p>
            This source contains tactical puzzles imported from the{' '}
            <a
              href="https://database.lichess.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-foreground underline underline-offset-2 hover:no-underline"
            >
              Lichess puzzle database
              <ExternalLink className="h-3 w-3" />
            </a>
            . Each puzzle starts from a position taken from a real Lichess game and has a
            known solution — a sequence of moves that wins material, delivers checkmate, or
            achieves a decisive advantage. We import a curated portion of the full database,
            not every puzzle Lichess has published.
          </p>
          <p>
            Solving a tactic means finding <em>every</em> move in the solution line — each of
            which is an only move, meaning any other response would considerably worsen your
            position. A single wrong move counts as a failure. The one exception is mate in
            one: any move that delivers checkmate wins the puzzle.
          </p>
          <p>
            Generating the puzzle set took over 100 years of cumulative CPU time. Lichess
            analysed 600 million games from their database and re-evaluated promising positions
            with Stockfish NNUE at 40 meganodes to extract and verify solutions. Ratings are
            determined by treating each solve attempt as a Glicko-2 rated game between the
            player and the puzzle, continuously updated as more players attempt it.
          </p>
          <p>
            Lichess and the{' '}
            <a
              href="https://github.com/lichess-org/lila"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-foreground underline underline-offset-2 hover:no-underline"
            >
              lila project
              <ExternalLink className="h-3 w-3" />
            </a>{' '}
            are free, open-source, and funded entirely by donations. The puzzle dataset is
            published under a{' '}
            <a
              href="https://database.lichess.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-foreground underline underline-offset-2 hover:no-underline"
            >
              Creative Commons licence
              <ExternalLink className="h-3 w-3" />
            </a>
            . We are grateful to everyone who contributes to Lichess — the players, the
            developers, and the donors who keep it running.
          </p>
        </div>

        <div>
          <Link
            to="/app/sources/lichess-tactics"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Explore our collection
          </Link>
        </div>
      </div>
    </div>
  )
}
