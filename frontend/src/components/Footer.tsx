import * as React from 'react'
import { Github, BookOpen } from 'lucide-react'

const GITHUB_URL = 'https://github.com/gilbertbrandow/woodpecker'
const BOOK_URL = 'https://www.amazon.se/-/en/Axel-Smith/dp/1784830542'
const AXEL_SMITH_URL = 'https://en.wikipedia.org/wiki/Axel_Smith_(chess_player)'
const HANS_TIKKANEN_URL = 'https://sv.wikipedia.org/wiki/Hans_Tikkanen'

export function Footer(): React.ReactElement {
  return (
    <footer className="border-t border-border">
      <div className="flex items-center justify-between px-4 py-4 text-xs text-muted-foreground sm:px-6">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          <Github className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">GitHub</span>
        </a>
        <span className="hidden sm:inline">
          Method by{' '}
          <a
            href={AXEL_SMITH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Axel Smith
          </a>
          {' & '}
          <a
            href={HANS_TIKKANEN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Hans Tikkanen
          </a>
        </span>
        <a
          href={BOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          <span className="sm:hidden">Get the book</span>
          <BookOpen className="h-3.5 w-3.5" />
        </a>
      </div>
    </footer>
  )
}
