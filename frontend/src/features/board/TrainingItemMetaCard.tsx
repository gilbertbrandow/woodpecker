import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { cn } from '../../lib/utils'
import type { LichessTacticSourceMetadata, ScrapedPositionalSourceMetadata, SourceMetadata } from '../../lib/api'
import type { PlySelection } from './boardPage.helpers'
import { TrainingItemTypeBadge } from '../../components/TrainingItemTypeBadge'

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
  trainingItemId,
  focusMode,
}: {
  source: LichessTacticSourceMetadata
  trainingItemId: number | undefined
  focusMode: boolean
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div>
          <span className="text-xs text-muted-foreground">Puzzle </span>
          <span className="text-sm font-mono">#{trainingItemId ?? source.displayId}</span>
        </div>
        {!focusMode && <TrainingItemTypeBadge source="LICHESS_TACTIC" />}
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

function ScrapedPositionalSection({
  source,
  trainingItemId,
  focusMode,
}: {
  source: ScrapedPositionalSourceMetadata
  trainingItemId: number | undefined
  focusMode: boolean
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div>
          <span className="text-xs text-muted-foreground">Puzzle </span>
          <span className="text-sm font-mono">#{trainingItemId ?? source.internalId}</span>
        </div>
        {!focusMode && <TrainingItemTypeBadge source="SCRAPED_POSITIONAL" />}
        {!focusMode && (
          <span className="tabular-nums text-sm">
            <span className="text-xs text-muted-foreground">Rating </span>
            {source.difficulty.minRating != null && source.difficulty.maxRating != null
              ? `${source.difficulty.minRating}–${source.difficulty.maxRating}`
              : source.difficulty.label}
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
  trainingItemId,
  focusMode,
}: {
  source: SourceMetadata
  trainingItemId: number | undefined
  focusMode: boolean
}): React.ReactElement | null {
  if (source.sourceType === 'LICHESS_TACTIC') {
    return <LichessTacticSection source={source} trainingItemId={trainingItemId} focusMode={focusMode} />
  }
  if (source.sourceType === 'SCRAPED_POSITIONAL') {
    return <ScrapedPositionalSection source={source} trainingItemId={trainingItemId} focusMode={focusMode} />
  }
  return null
}

type TrainingItemMetaCardProps = {
  source: SourceMetadata
  pgnDisplay: TrainingItemMetaPgnDisplayMin | null
  trainingItemId?: number
  focusMode?: boolean
  selectedPly?: PlySelection | null
  onPlyClick?: (ply: PlySelection) => void
}

type PuzzleSummary = {
  puzzleId: string | number
  ratingDisplay: string | number
  sourceType: 'LICHESS_TACTIC' | 'SCRAPED_POSITIONAL' | null
}

function resolvePuzzleSummary(source: SourceMetadata, trainingItemId: number | undefined): PuzzleSummary {
  if (source.sourceType === 'LICHESS_TACTIC') {
    return {
      puzzleId: trainingItemId ?? source.displayId,
      ratingDisplay: source.rating,
      sourceType: 'LICHESS_TACTIC',
    }
  }
  if (source.sourceType === 'SCRAPED_POSITIONAL') {
    const { minRating, maxRating, label } = source.difficulty
    return {
      puzzleId: trainingItemId ?? source.internalId,
      ratingDisplay: minRating != null && maxRating != null ? `${minRating}–${maxRating}` : label,
      sourceType: 'SCRAPED_POSITIONAL',
    }
  }
  return { puzzleId: '', ratingDisplay: '', sourceType: null }
}

type MobileOverviewMetaBarProps = {
  source: SourceMetadata
  pgnDisplay: TrainingItemMetaPgnDisplayMin | null
  trainingItemId?: number
  selectedPly?: PlySelection | null
  onPlyClick?: (ply: PlySelection) => void
}

export function MobileOverviewMetaBar({
  source,
  pgnDisplay,
  trainingItemId,
  selectedPly,
  onPlyClick,
}: MobileOverviewMetaBarProps): React.ReactElement {
  const [isOpen, setIsOpen] = React.useState(false)

  const opening = source.sourceType !== 'DECOY' ? source.opening : null
  const themes: Array<{ name: string; displayName: string | null }> =
    source.sourceType !== 'DECOY' ? source.themes : []
  const hasDetails =
    opening !== null || themes.length > 0 || (pgnDisplay !== null && pgnDisplay.mainline.length > 0)

  const { puzzleId, ratingDisplay, sourceType } = resolvePuzzleSummary(source, trainingItemId)

  return (
    <div className={cn('relative border border-border bg-background', isOpen ? 'rounded-t-md' : 'rounded-md')}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        disabled={!hasDetails}
        className="flex w-full items-center justify-between gap-2 px-3 py-3.5"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-mono text-sm">#{puzzleId}</span>
          {sourceType !== null && <TrainingItemTypeBadge source={sourceType} />}
          <span className="shrink-0 text-sm tabular-nums">
            <span className="text-xs text-muted-foreground">Rating: </span>
            {ratingDisplay}
          </span>
        </div>
        {hasDetails && (
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')}
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-[-1px] right-[-1px] z-50 flex flex-col gap-3 rounded-b-md border border-t-0 border-border bg-background px-3 pb-3 pt-3 shadow-md">
          {opening !== null && (
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="shrink-0 font-mono text-xs font-semibold">{opening.eco}</span>
              <span className="truncate text-xs text-muted-foreground">{opening.displayName}</span>
            </div>
          )}
          {themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {themes.map((t) => (
                <Badge key={t.name} variant="outline" className="text-xs font-normal">
                  {t.displayName ?? t.name}
                </Badge>
              ))}
            </div>
          )}
          {pgnDisplay !== null && pgnDisplay.mainline.length > 0 && (
            <div className="border-t border-border pt-2 text-sm leading-relaxed">
              <MoveSequence moves={pgnDisplay.mainline} line="main" selectedPly={selectedPly} onPlyClick={onPlyClick} />
              {pgnDisplay.variation !== null && (
                <span className="text-xs">
                  (<MoveSequence moves={pgnDisplay.variation} line="variation" selectedPly={selectedPly} onPlyClick={onPlyClick} />)
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function TrainingItemMetaCard({
  source,
  pgnDisplay,
  trainingItemId,
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

  const opening =
    source.sourceType !== 'DECOY' ? source.opening : null

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border px-3 py-3">
      <SourceSection source={source} trainingItemId={trainingItemId} focusMode={focusMode} />
      {opening !== null && (
        <div className="flex items-center gap-1.5 border-t border-border pt-3 pb-1 overflow-hidden">
          <span className="font-mono text-xs font-semibold shrink-0">{opening.eco}</span>
          <span className="text-xs text-muted-foreground truncate">{opening.displayName}</span>
        </div>
      )}
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
