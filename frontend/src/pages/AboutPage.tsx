import * as React from 'react'
import { BookOpen, ExternalLink } from 'lucide-react'

const BOOK_URL = 'https://www.amazon.se/-/en/Axel-Smith/dp/1784830542'
const AXEL_SMITH_URL = 'https://en.wikipedia.org/wiki/Axel_Smith_(chess_player)'
const HANS_TIKKANEN_URL = 'https://sv.wikipedia.org/wiki/Hans_Tikkanen'
const WOODPECKER_VIDEO_URL = 'https://www.youtube.com/embed/O1keZYdPgD0'

type Founder = {
  name: string
  url: string
  peakElo: number
  peakEloDate: string
  bio: string
}

const FOUNDERS: Founder[] = [
  {
    name: 'Axel Smith',
    url: AXEL_SMITH_URL,
    peakElo: 2516,
    peakEloDate: 'August 2016',
    bio: 'Won the Nordic Championship 2013. Secured his GM title in Kecskemét, December 2015. Competitive marathon runner — 2:28:47 at the Berlin Marathon 2021.',
  },
  {
    name: 'Hans Tikkanen',
    url: HANS_TIKKANEN_URL,
    peakElo: 2596,
    peakEloDate: 'July 2011',
    bio: 'Five-time Swedish Champion (2011, 2012, 2013, 2017, 2018). Received the GM title in 2010. Won the Swedish Grand Prix 2015/16.',
  },
]

export function AboutPage(): React.ReactElement {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-8 sm:px-6">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">The Woodpecker Method</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A training system developed by Hans Tikkanen and described by Axel Smith in their 2018 book.
          The idea is straightforward: solve a fixed set of tactical puzzles, then solve the same set again, faster each time.
          Repeated exposure to the same positions is meant to internalise patterns and sharpen tactical vision,
          particularly under time pressure.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">How it works</h2>
        <ol className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
          <li className="flex gap-2">
            <span className="font-medium text-foreground">1.</span>
            Choose a set of tactical puzzles suited to your level.
          </li>
          <li className="flex gap-2">
            <span className="font-medium text-foreground">2.</span>
            Build a schedule of progressively shorter time windows, one per cycle.
          </li>
          <li className="flex gap-2">
            <span className="font-medium text-foreground">3.</span>
            Solve the entire set within the allotted window.
          </li>
          <li className="flex gap-2">
            <span className="font-medium text-foreground">4.</span>
            Repeat the same set in the next, shorter window.
          </li>
        </ol>
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
        <h2 className="text-base font-semibold">Watch the method explained</h2>
        <div className="aspect-video w-full overflow-hidden rounded-md border border-border bg-muted">
          <iframe
            src={WOODPECKER_VIDEO_URL}
            loading="lazy"
            title="The Woodpecker Method explained"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>

      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">The pioneers</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          {FOUNDERS.map((founder) => (
            <a
              key={founder.name}
              href={founder.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 flex-col gap-2 rounded-md border border-border p-4 transition-colors hover:bg-accent"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    <span className="mr-1.5 text-sm font-medium" style={{ color: 'hsl(37, 74%, 43%)' }}>GM</span>
                    {founder.name}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Peak ELO {founder.peakElo} ({founder.peakEloDate})
                  </span>
                </div>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </div>
              <span className="text-xs leading-relaxed text-muted-foreground">{founder.bio}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
