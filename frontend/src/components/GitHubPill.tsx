import * as React from 'react'

const GITHUB_URL = 'https://github.com/gilbertbrandow/woodpecker'

export function GitHubPill(): React.ReactElement {
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
    >
      <img src="/github.svg" alt="GitHub" className="h-3 w-3 opacity-60 dark:invert" />
      Open source — view on GitHub
    </a>
  )
}
