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
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span>Puzzle: </span>
          <a
            href={`https://lichess.org/training/${puzzleId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            #{puzzleId}
          </a>
        </div>
        <span className="tabular-nums text-xs"> <span className="text-muted-foreground">Rating: </span> {rating}</span>
      </div>
      {themes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {themes.map((t) => (
            <Badge key={t.name} variant="outline" className="text-xs font-normal">
              {t.displayName}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
