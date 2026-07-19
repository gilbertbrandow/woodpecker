import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { cn } from '../../lib/utils'
import type { DecoySourceMetadata, LichessTacticSourceMetadata, ScrapedPositionalSourceMetadata, SourceMetadata } from '../../lib/api'
import type { PlySelection } from './boardPage.helpers'
import { TrainingItemTypeBadge } from '../../components/TrainingItemTypeBadge'

type DisplayMoveMin = {
  san: string
  uci?: string
  moveNumber: number
  isWhite: boolean
  moveStatus: 'correct' | 'wrong' | 'opponent' | null
}

type TrainingItemMetaPgnDisplayMin = {
  mainline: DisplayMoveMin[]
  variation: DisplayMoveMin[] | null
  subvariations: DisplayMoveMin[][] | null
}

function MoveToken({
  move,
  line,
  index,
  subIndex,
  selectedPly,
  onPlyClick,
  numberPrefix,
}: {
  move: DisplayMoveMin
  line: 'main' | 'variation' | 'subvariation'
  index: number
  subIndex?: number
  selectedPly: PlySelection | null | undefined
  onPlyClick: ((ply: PlySelection) => void) | undefined
  numberPrefix?: string
}): React.ReactElement {
  const isSelected = (() => {
    if (!selectedPly) return false
    if (selectedPly.line !== line) return false
    if (selectedPly.index !== index) return false
    if (line === 'subvariation' && selectedPly.line === 'subvariation') {
      return selectedPly.subIndex === subIndex
    }
    return true
  })()

  const isWrong = move.moveStatus === 'wrong'
  const prefix = numberPrefix ? (
    <span className={cn('tabular-nums', !isSelected && 'text-muted-foreground/60')}>{numberPrefix}</span>
  ) : null
  const san = (
    <span className="font-chess">
      {move.san}{isWrong && <span className="text-red-600 dark:text-red-400">??</span>}
    </span>
  )

  const plyTarget: PlySelection = line === 'subvariation'
    ? { line: 'subvariation', subIndex: subIndex ?? 0, index }
    : { line, index }

  if (!onPlyClick) {
    return (
      <span className={cn('px-0.5', isSelected && 'rounded bg-foreground text-background')}>
        {prefix}{san}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onPlyClick(plyTarget)}
      className={cn(
        'inline rounded px-0.5',
        isSelected ? 'bg-foreground text-background' : 'cursor-pointer hover:bg-muted',
      )}
    >
      {prefix}{san}
    </button>
  )
}

function MoveSequence({
  moves,
  line,
  subIndex,
  selectedPly,
  onPlyClick,
  startIndex = 0,
}: {
  moves: DisplayMoveMin[]
  line: 'main' | 'variation' | 'subvariation'
  subIndex?: number
  selectedPly: PlySelection | null | undefined
  onPlyClick: ((ply: PlySelection) => void) | undefined
  startIndex?: number
}): React.ReactElement {
  const items: React.ReactNode[] = []
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i]
    const showNumber = move.isWhite || i === 0
    const numberPrefix = showNumber ? `${move.moveNumber}${move.isWhite ? '.' : '...'} ` : undefined
    items.push(
      <MoveToken key={`m${i}`} move={move} line={line} index={i + startIndex} subIndex={subIndex} selectedPly={selectedPly} onPlyClick={onPlyClick} numberPrefix={numberPrefix} />,
    )
    if (i < moves.length - 1) items.push(' ')
  }
  return <span>{items}</span>
}

function SubvariationsBlock({
  subvariations,
  selectedPly,
  onPlyClick,
}: {
  subvariations: DisplayMoveMin[][]
  selectedPly: PlySelection | null | undefined
  onPlyClick: ((ply: PlySelection) => void) | undefined
}): React.ReactElement | null {
  if (subvariations.length === 0) return null
  return (
    <>
      <span className="text-muted-foreground"> (</span>
      <div className="text-[10px] text-muted-foreground space-y-1 my-1.5">
        {subvariations.map((sv, si) => (
          <div key={si}>
            <MoveSequence moves={sv} line="subvariation" subIndex={si} selectedPly={selectedPly} onPlyClick={onPlyClick} />
          </div>
        ))}
      </div>
      <span className="text-muted-foreground">)</span>
    </>
  )
}

function formatEval(pvs: Array<{ cp?: number; mate?: number }>): string {
  const pv = pvs[0]
  if (!pv) return '0.00'
  if (pv.mate !== undefined) return pv.mate > 0 ? `M${pv.mate}` : `-M${Math.abs(pv.mate)}`
  const p = (pv.cp ?? 0) / 100
  return p >= 0 ? `+${p.toFixed(2)}` : p.toFixed(2)
}

function DecoyEvalSection({
  source,
  selectedPly,
  pgnDisplay,
}: {
  source: DecoySourceMetadata
  selectedPly: PlySelection | null | undefined
  pgnDisplay: TrainingItemMetaPgnDisplayMin | null
}): React.ReactElement {
  const { cpByUci, minCp, maxCp } = React.useMemo(() => {
    const map = new Map<string, number>()
    let min = Infinity
    let max = -Infinity
    for (const m of source.acceptedMoves) {
      map.set(m.uci, m.cp)
      if (m.cp < min) min = m.cp
      if (m.cp > max) max = m.cp
    }
    return {
      cpByUci: map,
      minCp: min === Infinity ? null : min,
      maxCp: max === -Infinity ? null : max,
    }
  }, [source.acceptedMoves])

  const resolvedCp = React.useMemo((): number | null => {
    if (!selectedPly || (selectedPly.line === 'main' && selectedPly.index === 0)) {
      // Show the best eval the player can achieve across all accepted moves.
      // All cp values are normalized to white's perspective (positive = white winning).
      // mainline[0] is the opponent's move; if white played it, the player is black.
      const opponentIsWhite = pgnDisplay?.mainline[0]?.isWhite
      if (opponentIsWhite === undefined) return source.bestCp
      return opponentIsWhite ? (minCp ?? source.bestCp) : (maxCp ?? source.bestCp)
    }
    if (selectedPly.line === 'subvariation') {
      const sv = pgnDisplay?.subvariations?.[selectedPly.subIndex]?.[0]
      return sv?.uci != null ? (cpByUci.get(sv.uci) ?? null) : null
    }
    if (selectedPly.line === 'main' && selectedPly.index > 0) {
      const move = pgnDisplay?.mainline[Math.min(selectedPly.index, 1)]
      return move?.uci != null ? (cpByUci.get(move.uci) ?? null) : null
    }
    return source.bestCp
  }, [selectedPly, pgnDisplay, cpByUci, minCp, maxCp, source.bestCp])

  return (
    <div className="flex items-center gap-2 border-t border-border pt-3 pb-1">
      <span className="shrink-0 text-xs text-muted-foreground">Eval</span>
      {resolvedCp != null ? (
        <>
          <span className="font-mono text-xs font-semibold tabular-nums">{formatEval([{ cp: resolvedCp }])}</span>
          <span className="text-xs text-muted-foreground">depth {source.depth}</span>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>
  )
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

  if (selected.line === 'subvariation') {
    const sv = pgnDisplay.subvariations?.[selected.subIndex]
    if (!sv) return null
    const next = selected.index + 1
    return next < sv.length ? { line: 'subvariation', subIndex: selected.subIndex, index: next } : null
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

  if (selected.line === 'subvariation') {
    return selected.index > 0 ? { line: 'subvariation', subIndex: selected.subIndex, index: selected.index - 1 } : null
  }

  if (selected.line === 'variation') {
    return selected.index > 0 ? { line: 'variation', index: selected.index - 1 } : null
  }

  return selected.index > 0 ? { line: 'main', index: selected.index - 1 } : null
}

function LichessTacticSection({
  source,
  trainingItemId,
  focusMode,
  runPosition,
}: {
  source: LichessTacticSourceMetadata
  trainingItemId: number | undefined
  focusMode: boolean
  runPosition: number | undefined
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div>
          <span className="text-xs text-muted-foreground">Puzzle </span>
          <span className="text-sm font-mono">
            #{focusMode && runPosition !== undefined ? runPosition + 1 : (trainingItemId ?? source.displayId)}
          </span>
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
  runPosition,
}: {
  source: ScrapedPositionalSourceMetadata
  trainingItemId: number | undefined
  focusMode: boolean
  runPosition: number | undefined
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div>
          <span className="text-xs text-muted-foreground">Puzzle </span>
          <span className="text-sm font-mono">
            #{focusMode && runPosition !== undefined ? runPosition + 1 : (trainingItemId ?? source.internalId)}
          </span>
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

function PlayerLabel({ name, title, elo }: { name: string; title: string | null; elo: number | null }): React.ReactElement {
  return (
    <span className="flex items-center gap-1 text-xs">
      {title && (
        <span className="font-semibold" style={{ color: 'hsl(37, 74%, 43%)' }}>{title}</span>
      )}
      <span>{name}</span>
      {elo !== null && (
        <span className="tabular-nums text-muted-foreground">({elo})</span>
      )}
    </span>
  )
}

function DecoyGameInfo({ g }: { g: NonNullable<DecoySourceMetadata['game']> }): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="w-9 shrink-0 text-xs text-muted-foreground">White</span>
        <div className="rounded-md bg-muted px-2 py-1">
          <PlayerLabel name={g.white} title={g.whiteTitle} elo={g.whiteElo} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-9 shrink-0 text-xs text-muted-foreground">Black</span>
        <div className="rounded-md bg-muted px-2 py-1">
          <PlayerLabel name={g.black} title={g.blackTitle} elo={g.blackElo} />
        </div>
      </div>
      {g.event !== null && (
        <div className="flex items-center gap-2">
          <span className="w-9 shrink-0 text-xs text-muted-foreground">Event</span>
          <span className="truncate py-1 text-xs">{g.event}</span>
        </div>
      )}
      {g.date !== null && (
        <div className="flex items-center gap-2">
          <span className="w-9 shrink-0 text-xs text-muted-foreground">Date</span>
          <span className="py-1 font-mono text-xs">{g.date}</span>
        </div>
      )}
    </div>
  )
}

function PgnDisplayBlock({
  pgnDisplay,
  selectedPly,
  onPlyClick,
}: {
  pgnDisplay: TrainingItemMetaPgnDisplayMin
  selectedPly: PlySelection | null | undefined
  onPlyClick: ((ply: PlySelection) => void) | undefined
}): React.ReactElement {
  if (pgnDisplay.subvariations !== null) {
    return (
      <>
        <MoveSequence moves={pgnDisplay.mainline.slice(0, 2)} line="main" selectedPly={selectedPly} onPlyClick={onPlyClick} />
        <SubvariationsBlock subvariations={pgnDisplay.subvariations} selectedPly={selectedPly} onPlyClick={onPlyClick} />
        {pgnDisplay.mainline.length > 2 && (
          <>{' '}<MoveSequence moves={pgnDisplay.mainline.slice(2)} line="main" startIndex={2} selectedPly={selectedPly} onPlyClick={onPlyClick} /></>
        )}
      </>
    )
  }
  return (
    <>
      <MoveSequence moves={pgnDisplay.mainline} line="main" selectedPly={selectedPly} onPlyClick={onPlyClick} />
      {pgnDisplay.variation !== null && (
        <span className="text-xs">
          {' '}(<MoveSequence moves={pgnDisplay.variation} line="variation" selectedPly={selectedPly} onPlyClick={onPlyClick} />)
        </span>
      )}
    </>
  )
}

function DecoySection({
  source,
  trainingItemId,
  focusMode,
  runPosition,
}: {
  source: DecoySourceMetadata
  trainingItemId: number | undefined
  focusMode: boolean
  runPosition: number | undefined
}): React.ReactElement {
  const puzzleId = trainingItemId ?? '—'
  const g = source.game
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div>
          <span className="text-xs text-muted-foreground">Puzzle </span>
          <span className="text-sm font-mono">
            #{focusMode && runPosition !== undefined ? runPosition + 1 : puzzleId}
          </span>
        </div>
        {!focusMode && <TrainingItemTypeBadge source="DECOY" />}
      </div>
      {!focusMode && g !== null && <DecoyGameInfo g={g} />}
    </div>
  )
}

function SourceSection({
  source,
  trainingItemId,
  focusMode,
  runPosition,
}: {
  source: SourceMetadata
  trainingItemId: number | undefined
  focusMode: boolean
  runPosition: number | undefined
}): React.ReactElement | null {
  if (source.sourceType === 'LICHESS_TACTIC') {
    return <LichessTacticSection source={source} trainingItemId={trainingItemId} focusMode={focusMode} runPosition={runPosition} />
  }
  if (source.sourceType === 'SCRAPED_POSITIONAL') {
    return <ScrapedPositionalSection source={source} trainingItemId={trainingItemId} focusMode={focusMode} runPosition={runPosition} />
  }
  if (source.sourceType === 'DECOY') {
    return <DecoySection source={source} trainingItemId={trainingItemId} focusMode={focusMode} runPosition={runPosition} />
  }
  return null
}

type TrainingItemMetaCardProps = {
  source: SourceMetadata
  pgnDisplay: TrainingItemMetaPgnDisplayMin | null
  trainingItemId?: number
  runPosition?: number
  focusMode?: boolean
  selectedPly?: PlySelection | null
  onPlyClick?: (ply: PlySelection) => void
}

type PuzzleSummary = {
  puzzleId: string | number
  ratingDisplay: string | number
  sourceType: 'LICHESS_TACTIC' | 'SCRAPED_POSITIONAL' | 'DECOY' | null
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
  if (source.sourceType === 'DECOY') {
    return {
      puzzleId: trainingItemId ?? '—',
      ratingDisplay: source.moveNumber,
      sourceType: 'DECOY',
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

  const opening = source.opening
  const themes: Array<{ name: string; displayName: string | null }> =
    source.sourceType !== 'DECOY' ? source.themes : []
  const decoyGame = source.sourceType === 'DECOY' ? source.game : null
  const hasDetails =
    opening !== null || themes.length > 0 || (pgnDisplay !== null && pgnDisplay.mainline.length > 0) || decoyGame !== null

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
            <span className="text-xs text-muted-foreground">{source.sourceType === 'DECOY' ? 'Move: ' : 'Rating: '}</span>
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
          {decoyGame !== null && (
            <DecoyGameInfo g={decoyGame} />
          )}
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
              <PgnDisplayBlock pgnDisplay={pgnDisplay} selectedPly={selectedPly} onPlyClick={onPlyClick} />
            </div>
          )}
          {source.sourceType === 'DECOY' && (
            <DecoyEvalSection source={source} selectedPly={selectedPly} pgnDisplay={pgnDisplay} />
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
  runPosition,
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

  const opening = source.opening

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border px-3 py-3">
      <SourceSection source={source} trainingItemId={trainingItemId} focusMode={focusMode} runPosition={runPosition} />
      {!focusMode && opening !== null && (
        <div className="flex items-center gap-1.5 border-t border-border pt-3 pb-1 overflow-hidden">
          <span className="font-mono text-xs font-semibold shrink-0">{opening.eco}</span>
          <span className="text-xs text-muted-foreground truncate">{opening.displayName}</span>
        </div>
      )}
      {pgnDisplay !== null && pgnDisplay.mainline.length > 0 && (
        <div className={cn('text-sm leading-relaxed', 'border-t border-border pt-2')}>
          <PgnDisplayBlock pgnDisplay={pgnDisplay} selectedPly={selectedPly} onPlyClick={onPlyClick} />
        </div>
      )}
      {!focusMode && source.sourceType === 'DECOY' && (
        <DecoyEvalSection source={source} selectedPly={selectedPly} pgnDisplay={pgnDisplay} />
      )}
    </div>
  )
}
