import * as React from 'react'
import { Badge } from '../../components/ui/badge'
import { cn } from '../../lib/utils'
import type { PuzzleLabel } from '../../lib/api'
import type { DisplayMove, PlySelection, PuzzleMetaPgnDisplay } from './boardOverview.pgn'

function MoveToken({
  move,
  line,
  index,
  selectedPly,
  onPlyClick,
}: {
  move: DisplayMove
  line: 'main' | 'variation'
  index: number
  selectedPly: PlySelection | null | undefined
  onPlyClick: ((ply: PlySelection) => void) | undefined
}): React.ReactElement {
  const isSelected =
    selectedPly !== null &&
    selectedPly !== undefined &&
    selectedPly.line === line &&
    selectedPly.index === index

  const isWrong = move.moveStatus === 'wrong'
  const san = (
    <span className="font-chess">
      {move.san}{isWrong && <span className="text-red-600 dark:text-red-400">??</span>}
    </span>
  )

  if (!onPlyClick) {
    return (
      <span className={cn(isSelected && 'rounded bg-foreground px-0.5 text-background')}>
        {san}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onPlyClick({ line, index })}
      className={cn(
        'inline rounded px-0.5',
        isSelected ? 'bg-foreground text-background' : 'cursor-pointer hover:bg-muted',
      )}
    >
      {san}
    </button>
  )
}

function MoveSequence({
  moves,
  line,
  selectedPly,
  onPlyClick,
}: {
  moves: DisplayMove[]
  line: 'main' | 'variation'
  selectedPly: PlySelection | null | undefined
  onPlyClick: ((ply: PlySelection) => void) | undefined
}): React.ReactElement {
  const items: React.ReactNode[] = []
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i]
    const showNumber = move.isWhite || i === 0
    if (showNumber) {
      items.push(
        <span key={`n${i}`} className="text-muted-foreground/60 tabular-nums">
          {move.moveNumber}{move.isWhite ? '.' : '...'}
        </span>,
        '',
      )
    }
    items.push(
      <MoveToken key={`m${i}`} move={move} line={line} index={i} selectedPly={selectedPly} onPlyClick={onPlyClick} />,
    )
    if (i < moves.length - 1) items.push(' ')
  }
  return <span>{items}</span>
}

type PuzzleMetaCardProps = {
  puzzleId: string
  rating: number
  themes: PuzzleLabel[]
  pgnDisplay: PuzzleMetaPgnDisplay | null
  focusMode?: boolean
  selectedPly?: PlySelection | null
  onPlyClick?: (ply: PlySelection) => void
}

export function PuzzleMetaCard({
  puzzleId,
  rating,
  themes,
  pgnDisplay,
  focusMode = false,
  selectedPly,
  onPlyClick,
}: PuzzleMetaCardProps): React.ReactElement {
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
          {!focusMode && (
            <span className="tabular-nums text-sm">
              <span className="text-xs text-muted-foreground">Rating </span>
              {rating}
            </span>
          )}
        </div>
        {!focusMode && themes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {themes.map((t) => (
              <Badge key={t.name} variant="outline" className="text-xs font-normal">
                {t.displayName}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {pgnDisplay !== null && pgnDisplay.mainline.length > 0 && (
        <div className={cn('text-sm leading-relaxed', 'border-t border-border pt-2')}>
          <MoveSequence moves={pgnDisplay.mainline} line="main" selectedPly={selectedPly} onPlyClick={onPlyClick} />
          {pgnDisplay.variation !== null && (
            <span className="text-xs">(<MoveSequence moves={pgnDisplay.variation} line="variation" selectedPly={selectedPly} onPlyClick={onPlyClick} />)</span>
          )}
        </div>
      )}
    </div>
  )
}
