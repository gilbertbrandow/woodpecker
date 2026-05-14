import * as React from 'react'
import { ExternalLink } from 'lucide-react'

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

function ExternalA({ href, children }: { href: string; children: React.ReactNode }): React.ReactElement {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 text-foreground underline underline-offset-2 hover:no-underline"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  )
}

export function LichessTacticsAbout(): React.ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <Section title="About this source">
        <p>
          This source contains tactical puzzles imported from the{' '}
          <ExternalA href="https://database.lichess.org/">Lichess puzzle database</ExternalA>.
          Each puzzle starts from a position taken from a real Lichess game and has a known solution —
          a sequence of moves that wins material, delivers checkmate, or achieves a decisive advantage.
          We import a curated portion of the full database, not every puzzle Lichess has published.
        </p>
      </Section>

      <Section title="What counts as correct">
        <p>
          Solving a tactic means finding <em>every</em> move in the solution line — each of which is
          an only move, meaning any other response would considerably worsen your position. A single
          wrong move counts as a failure. The one exception is mate in one: any move that delivers
          checkmate wins the puzzle.
        </p>
      </Section>

      <Section title="Where the data comes from">
        <p>
          Lichess analysed 600 million games from their database and re-evaluated promising positions
          with Stockfish NNUE at 40 meganodes to extract and verify puzzle solutions. Generating
          the full puzzle set took over 100 years of cumulative CPU time.
        </p>
      </Section>

      <Section title="How tactics are rated">
        <p>
          Each puzzle has a Glicko-2 rating that is continuously updated as players attempt it.
          Every solve attempt is treated as a rated game between the player and the puzzle, so
          ratings reflect the real-world difficulty of each position across many attempts.
        </p>
      </Section>

      <Section title="Credit and licence">
        <p>
          <ExternalA href="https://lichess.org/">Lichess</ExternalA> and the{' '}
          <ExternalA href="https://github.com/lichess-org/lila">lila project</ExternalA> are free,
          open-source, and funded entirely by donations. The puzzle dataset is published under a{' '}
          <ExternalA href="https://database.lichess.org/">Creative Commons licence</ExternalA>.
        </p>
      </Section>
    </div>
  )
}
