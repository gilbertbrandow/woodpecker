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
        <a
          href={`https://lichess.org/training/${puzzleId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-sm text-foreground hover:underline"
        >
          {puzzleId}
        </a>
        <span className="tabular-nums text-xs text-muted-foreground">{rating}</span>
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
