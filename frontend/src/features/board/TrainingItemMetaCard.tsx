import * as React from 'react'
import { Badge } from '../../components/ui/badge'
import { cn } from '../../lib/utils'
import type { LichessTacticSourceMetadata, SourceMetadata } from '../../lib/api'
import type { PlySelection } from './boardPage.helpers'

type DisplayMoveMin = {
  san: string
  moveNumber: number
  isWhite: boolean
  moveStatus: 'correct' | 'wrong' | 'opponent' | null
}

type TrainingItemMetaPgnDisplayMin = {
  mainline: DisplayMoveMin[]
  variation: DisplayMoveMin[] | null
}

function MoveToken({
  move,
  line,
  index,
  selectedPly,
  onPlyClick,
}: {
  move: DisplayMoveMin
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
  moves: DisplayMoveMin[]
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

function computeNextPly(
  selected: PlySelection | null | undefined,
  pgnDisplay: TrainingItemMetaPgnDisplayMin,
): PlySelection | null {
  const mainLen = pgnDisplay.mainline.length
  const varLen = pgnDisplay.variation?.length ?? 0

  if (selected === null || selected === undefined) {
    return mainLen > 0 ? { line: 'main', index: 0 } : null
  }

  if (selected.line === 'main') {
    const next = selected.index + 1
    return next < mainLen ? { line: 'main', index: next } : null
  }

  const next = selected.index + 1
  return next < varLen ? { line: 'variation', index: next } : null
}

function computePrevPly(
  selected: PlySelection | null | undefined,
): PlySelection | null {
  if (selected === null || selected === undefined) return null

  if (selected.line === 'variation') {
    return selected.index > 0 ? { line: 'variation', index: selected.index - 1 } : null
  }

  return selected.index > 0 ? { line: 'main', index: selected.index - 1 } : null
}

function LichessTacticSection({
  source,
  focusMode,
}: {
  source: LichessTacticSourceMetadata
  focusMode: boolean
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-4">
        <div>
          <span className="text-xs text-muted-foreground">Puzzle </span>
          <a
            href={`https://lichess.org/training/${source.displayId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            #{source.displayId}
          </a>
        </div>
        {!focusMode && (
          <span className="tabular-nums text-sm">
            <span className="text-xs text-muted-foreground">Rating </span>
            {source.rating}
          </span>
        )}
      </div>
      {!focusMode && source.themes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {source.themes.map((t) => (
            <Badge key={t.name} variant="outline" className="text-xs font-normal">
              {t.displayName}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function SourceSection({
  source,
  focusMode,
}: {
  source: SourceMetadata
  focusMode: boolean
}): React.ReactElement | null {
  if (source.sourceType === 'LICHESS_TACTIC') {
    return <LichessTacticSection source={source} focusMode={focusMode} />
  }
  return null
}

type TrainingItemMetaCardProps = {
  source: SourceMetadata
  pgnDisplay: TrainingItemMetaPgnDisplayMin | null
  focusMode?: boolean
  selectedPly?: PlySelection | null
  onPlyClick?: (ply: PlySelection) => void
}

export function TrainingItemMetaCard({
  source,
  pgnDisplay,
  focusMode = false,
  selectedPly,
  onPlyClick,
}: TrainingItemMetaCardProps): React.ReactElement {
  React.useEffect(() => {
    if (!onPlyClick || !pgnDisplay) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      e.preventDefault()
      const next =
        e.key === 'ArrowRight'
          ? computeNextPly(selectedPly, pgnDisplay)
          : computePrevPly(selectedPly)
      if (next !== null) onPlyClick(next)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onPlyClick, selectedPly, pgnDisplay])

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border px-3 py-3">
      <SourceSection source={source} focusMode={focusMode} />
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
