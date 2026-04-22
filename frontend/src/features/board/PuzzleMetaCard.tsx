import * as React from 'react'
import { Badge } from '../../components/ui/badge'
import type { PuzzleLabel } from '../../lib/api'
import { buildPgnDisplay } from './boardOverview.pgn'
import type { DisplayMove } from './boardOverview.pgn'

function MoveToken({ move }: { move: DisplayMove }): React.ReactElement {
  return <span className="font-chess">{move.san}</span>
}

function MoveSequence({ moves }: { moves: DisplayMove[] }): React.ReactElement {
  const items: React.ReactNode[] = []
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i]
    const showNumber = move.isWhite || i === 0
    if (showNumber) {
      items.push(
        <span key={`n${i}`} className="text-muted-foreground/60 tabular-nums">
          {move.moveNumber}{move.isWhite ? '.' : '...'}
        </span>,
        <span key={`s${i}`}> </span>,
      )
    }
    items.push(<MoveToken key={`m${i}`} move={move} />)
    if (i < moves.length - 1) items.push(<span key={`sep${i}`}> </span>)
  }
  return <span>{items}</span>
}

type PuzzleMetaCardProps = {
  puzzleId: string
  rating: number
  themes: PuzzleLabel[]
  baseFen?: string
  attemptMoves?: string[]
  solutionMoves?: string
  attemptStatus?: 'solved' | 'failed'
}

export function PuzzleMetaCard({
  puzzleId,
  rating,
  themes,
  baseFen,
  attemptMoves,
  solutionMoves,
  attemptStatus,
}: PuzzleMetaCardProps): React.ReactElement {
  const pgnDisplay = React.useMemo(() => {
    if (!baseFen || !solutionMoves || !attemptStatus) return null
    return buildPgnDisplay(baseFen, attemptMoves ?? [], solutionMoves, attemptStatus)
  }, [baseFen, attemptMoves, solutionMoves, attemptStatus])

  const lastPgnDisplayRef = React.useRef(pgnDisplay)
  if (pgnDisplay !== null) lastPgnDisplayRef.current = pgnDisplay
  const displayedPgn = pgnDisplay ?? lastPgnDisplayRef.current

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border px-3 py-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-4">
          <div>
            <span className="text-xs text-muted-foreground">Puzzle </span>
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

      {displayedPgn !== null && displayedPgn.mainline.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-1 border-t border-border pt-2 text-sm leading-relaxed">
          <MoveSequence moves={displayedPgn.mainline} />
          {displayedPgn.variation !== null && (
            <span className="text-muted-foreground">
              {'('}
              <MoveSequence moves={displayedPgn.variation} />
              {')'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
