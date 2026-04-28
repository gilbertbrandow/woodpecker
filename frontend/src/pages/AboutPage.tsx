import * as React from 'react'
import { BookOpen, ExternalLink } from 'lucide-react'

const BOOK_URL = 'https://www.amazon.se/-/en/Axel-Smith/dp/1784830542'
const AXEL_SMITH_URL = 'https://en.wikipedia.org/wiki/Axel_Smith_(chess_player)'
const HANS_TIKKANEN_URL = 'https://sv.wikipedia.org/wiki/Hans_Tikkanen'
const WOODPECKER_VIDEO_URL = 'https://www.youtube.com/embed/placeholder'

export function AboutPage(): React.ReactElement {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-8 sm:px-6">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">The Woodpecker Method</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The Woodpecker Method is a chess training system built around solving a large set of tactical
          puzzles repeatedly in cycles. Each cycle, you solve the full set — but faster than the previous
          one. Over time, pattern recognition becomes deeply internalised and tactical vision improves
          significantly, even under tournament time pressure.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The method was popularised by grandmasters Axel Smith and Hans Tikkanen, who both used it to
          achieve remarkable jumps in their playing strength. Smith wrote about the experience in his book
          and later co-authored a dedicated training manual with Tikkanen.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">How it works</h2>
        <ol className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
          <li className="flex gap-2">
            <span className="font-medium text-foreground">1.</span>
            Select a set of tactical puzzles suited to your level.
          </li>
          <li className="flex gap-2">
            <span className="font-medium text-foreground">2.</span>
            Solve all puzzles in a timed cycle. Mark any you struggle with.
          </li>
          <li className="flex gap-2">
            <span className="font-medium text-foreground">3.</span>
            Repeat the full set, aiming to finish faster than the previous cycle.
          </li>
          <li className="flex gap-2">
            <span className="font-medium text-foreground">4.</span>
            Continue until the patterns feel automatic — not memorised, but seen.
          </li>
        </ol>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">Watch the method explained</h2>
        <div className="aspect-video w-full overflow-hidden rounded-md border border-border bg-muted">
          <iframe
            src={WOODPECKER_VIDEO_URL}
            title="The Woodpecker Method explained"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Video URL is a placeholder — update <code>WOODPECKER_VIDEO_URL</code> in AboutPage.tsx with the real link.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">Get the book</h2>
        <a
          href={BOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-md border border-border p-5 transition-colors hover:bg-accent"
        >
          <BookOpen className="h-8 w-8 shrink-0 text-foreground" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              The Woodpecker Method — Axel Smith &amp; Hans Tikkanen
            </span>
            <span className="text-xs text-muted-foreground">
              Quality Chess, 2018 · Available on Amazon
            </span>
          </div>
          <ExternalLink className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        </a>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">The founders</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <a
            href={AXEL_SMITH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center gap-3 rounded-md border border-border p-4 transition-colors hover:bg-accent"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">Axel Smith</span>
              <span className="text-xs text-muted-foreground">
                Swedish grandmaster. Used the Woodpecker Method to raise his rating over 100 points.
              </span>
            </div>
            <ExternalLink className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
          </a>
          <a
            href={HANS_TIKKANEN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center gap-3 rounded-md border border-border p-4 transition-colors hover:bg-accent"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">Hans Tikkanen</span>
              <span className="text-xs text-muted-foreground">
                Swedish grandmaster. Co-author of the Woodpecker Method book and training system.
              </span>
            </div>
            <ExternalLink className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
          </a>
        </div>
      </section>
    </div>
  )
}
