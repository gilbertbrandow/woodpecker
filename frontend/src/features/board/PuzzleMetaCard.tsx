import * as React from 'react'
import { Badge } from '../../components/ui/badge'
import type { PuzzleLabel } from '../../lib/api'

type PuzzleMetaCardProps = {
  puzzleId: string
  rating: number
  themes: PuzzleLabel[]
}

export function PuzzleMetaCard({ puzzleId, rating, themes }: PuzzleMetaCardProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 flex-col gap-1">
          <div className="text-muted-foreground">
            <span className="text-xs">Puzzle </span>
            <a
              href={`https://lichess.org/training/${puzzleId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              #{puzzleId}
            </a>
          </div>
          <span className="tabular-nums text-sm">
            <span className="text-xs text-muted-foreground">Rating </span>
            {rating}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          {themes.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {themes.map((t) => (
                <Badge key={t.name} variant="outline" className="text-xs font-normal">
                  {t.displayName}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
