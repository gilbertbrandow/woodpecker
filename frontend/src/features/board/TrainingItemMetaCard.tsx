import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { DecoySourceMetadata, LichessTacticSourceMetadata, ScrapedPositionalSourceMetadata, SourceMetadata } from '../../lib/api'
import type { PlySelection } from './boardPage.helpers'
import { TrainingItemTypeBadge } from '../../components/TrainingItemTypeBadge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'

type DisplayMoveMin = {
  san: string
  uci?: string
  moveNumber: number
  isWhite: boolean
  moveStatus: 'correct' | 'wrong' | 'opponent' | null
}

type TrainingItemMetaPgnDisplayMin = {
  mainline: DisplayMoveMin[]
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
  line: 'main' | 'subvariation'
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
  line: 'main' | 'subvariation'
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
    <div className="flex items-center gap-2 border-t border-border px-3 py-1.5 leading-[1.75em]">
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

  if (selected === null || selected === undefined) {
    return mainLen > 0 ? { line: 'main', index: 0 } : null
  }

  if (selected.line === 'subvariation') {
    const sv = pgnDisplay.subvariations?.[selected.subIndex]
    if (!sv) return null
    const next = selected.index + 1
    return next < sv.length ? { line: 'subvariation', subIndex: selected.subIndex, index: next } : null
  }

  const next = selected.index + 1
  return next < mainLen ? { line: 'main', index: next } : null
}

function computePrevPly(
  selected: PlySelection | null | undefined,
): PlySelection | null {
  if (selected === null || selected === undefined) return null

  if (selected.line === 'subvariation') {
    return selected.index > 0 ? { line: 'subvariation', subIndex: selected.subIndex, index: selected.index - 1 } : null
  }

  return selected.index > 0 ? { line: 'main', index: selected.index - 1 } : null
}

type OpeningInfo = { eco: string; displayName: string }

function TacticMeta({
  focusMode,
  runPosition,
  badge,
  ratingLabel,
  opening,
  themes,
  trainingItemId,
}: {
  focusMode: boolean
  runPosition: number | undefined
  badge: 'LICHESS_TACTIC' | 'SCRAPED_POSITIONAL'
  ratingLabel: React.ReactNode
  opening: OpeningInfo | null
  themes: Array<{ name: string; displayName: string | null; description?: string | null }>
  trainingItemId?: number
}): React.ReactElement {
  if (focusMode) {
    return (
      <span className="font-mono text-sm">
        <span className="text-xs text-muted-foreground">Puzzle </span>
        #{runPosition !== undefined ? runPosition + 1 : '—'}
      </span>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0 font-mono text-sm">#{trainingItemId ?? '—'}</span>
        <TrainingItemTypeBadge source={badge} />
        <span className="tabular-nums text-sm">
          <span className="text-xs text-muted-foreground">Rating </span>
          {ratingLabel}
        </span>
      </div>
      {themes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {themes.map((t) => {
            const label = t.displayName ?? t.name
            if (!t.description) {
              return (
                <span key={t.name} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {label}
                </span>
              )
            }
            return (
              <Tooltip key={t.name} delayDuration={200}>
                <TooltipTrigger asChild>
                  <span className="cursor-default rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors">
                    {label}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px] text-center text-xs">
                  {t.description}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      )}
      {opening !== null && (
        <div className="flex items-center gap-1.5 overflow-hidden mt-1">
          <span className="shrink-0 font-mono text-xs font-semibold">{opening.eco}</span>
          <span className="truncate text-xs text-muted-foreground">{opening.displayName}</span>
        </div>
      )}
    </div>
  )
}

function LichessTacticSection({
  source,
  focusMode,
  runPosition,
  opening,
  trainingItemId,
}: {
  source: LichessTacticSourceMetadata
  focusMode: boolean
  runPosition: number | undefined
  opening: OpeningInfo | null
  trainingItemId?: number
}): React.ReactElement {
  return (
    <TacticMeta
      focusMode={focusMode}
      runPosition={runPosition}
      badge="LICHESS_TACTIC"
      ratingLabel={source.rating}
      opening={opening}
      themes={source.themes}
      trainingItemId={trainingItemId}
    />
  )
}

function ScrapedPositionalSection({
  source,
  focusMode,
  runPosition,
  opening,
  trainingItemId,
}: {
  source: ScrapedPositionalSourceMetadata
  focusMode: boolean
  runPosition: number | undefined
  opening: OpeningInfo | null
  trainingItemId?: number
}): React.ReactElement {
  const ratingLabel =
    source.difficulty.minRating != null && source.difficulty.maxRating != null
      ? `${source.difficulty.minRating}–${source.difficulty.maxRating}`
      : source.difficulty.label
  return (
    <TacticMeta
      focusMode={focusMode}
      runPosition={runPosition}
      badge="SCRAPED_POSITIONAL"
      ratingLabel={ratingLabel}
      opening={opening}
      themes={source.themes}
      trainingItemId={trainingItemId}
    />
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
      {(g.date !== null || g.event !== null) && (
        <div className="flex items-center gap-2 overflow-hidden">
          {g.date !== null && (
            <>
              <span className="shrink-0 text-xs text-muted-foreground">Date</span>
              <span className="shrink-0 font-mono text-xs">{g.date}</span>
            </>
          )}
          {g.event !== null && (
            <>
              <span className="shrink-0 text-xs text-muted-foreground">Event</span>
              <span className="truncate text-xs">{g.event}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

type RowEntry = { move: DisplayMoveMin; idx: number }
type MoveRow = { moveNumber: number; white: RowEntry | null; black: RowEntry | null }
type SvEntry = { moves: DisplayMoveMin[]; si: number }

export type PgnLayout = {
  rows: MoveRow[]
  svAfterWhite: Map<number, SvEntry[]>
  svAfterBlack: Map<number, SvEntry[]>
}

// Pure transform from a PGN display to the layout structure used by PgnColumnView.
// Extracted for independent testability; the component just maps this to JSX.
//
// Subvariations are split into two maps by where they branch:
// - svAfterWhite: variation branches at the White cell (mid-row). Requires the
//   "..." placeholder + continuation layout to match standard PGN convention.
// - svAfterBlack: variation branches at the Black cell (end-of-row).
//
// When the player is White (opponent moves Black first), wrong moves are White
// moves. Without this split a variation would appear to be an alternative to
// Black's response rather than to White's correct move.
export function computePgnLayout(pgnDisplay: TrainingItemMetaPgnDisplayMin): PgnLayout {
  const rows: MoveRow[] = []
  let current: MoveRow | null = null
  for (let i = 0; i < pgnDisplay.mainline.length; i++) {
    const move = pgnDisplay.mainline[i]
    if (move.isWhite) {
      current = { moveNumber: move.moveNumber, white: { move, idx: i }, black: null }
      rows.push(current)
    } else if (current && current.moveNumber === move.moveNumber) {
      current.black = { move, idx: i }
    } else {
      current = { moveNumber: move.moveNumber, white: null, black: { move, idx: i } }
      rows.push(current)
    }
  }

  const afterWhite = new Map<number, SvEntry[]>()
  const afterBlack = new Map<number, SvEntry[]>()
  if (pgnDisplay.subvariations && pgnDisplay.mainline.length > 1) {
    for (let si = 0; si < pgnDisplay.subvariations.length; si++) {
      const sv = pgnDisplay.subvariations[si]
      const firstMove = sv?.[0]
      if (!firstMove) continue
      const branchIdx = pgnDisplay.mainline.findIndex(
        m => m.moveNumber === firstMove.moveNumber && m.isWhite === firstMove.isWhite,
      )
      const targetIdx = branchIdx > 0 ? branchIdx : 1
      let rowIdx = rows.length - 1
      for (let r = 0; r < rows.length; r++) {
        if (rows[r].white?.idx === targetIdx || rows[r].black?.idx === targetIdx) {
          rowIdx = r
          break
        }
      }
      const isAtWhiteCell = rows[rowIdx].white?.idx === targetIdx
      const map = isAtWhiteCell ? afterWhite : afterBlack
      const existing = map.get(rowIdx) ?? []
      existing.push({ moves: sv, si })
      map.set(rowIdx, existing)
    }
  }

  return { rows, svAfterWhite: afterWhite, svAfterBlack: afterBlack }
}

function ColumnMoveCell({
  entry,
  selectedPly,
  onPlyClick,
  rightBorder = true,
  bottomBorder = true,
  showPlaceholder = false,
}: {
  entry: RowEntry | null
  selectedPly: PlySelection | null | undefined
  onPlyClick: ((ply: PlySelection) => void) | undefined
  rightBorder?: boolean
  bottomBorder?: boolean
  showPlaceholder?: boolean
}): React.ReactElement {
  const isSelected = !!entry && selectedPly?.line === 'main' && selectedPly.index === entry.idx

  const content = entry ? (
    <>
      <span className="font-chess">{entry.move.san}</span>
      {entry.move.moveStatus === 'wrong' && (
        <span className="text-red-600 dark:text-red-400">??</span>
      )}
    </>
  ) : showPlaceholder ? (
    <span className="block text-center">...</span>
  ) : null

  const cls = cn(
    'flex-[0_0_43.5%] border-border px-2 py-0.5 text-sm leading-[1.75em]',
    bottomBorder && 'border-b',
    rightBorder && 'border-r',
    entry && !isSelected && onPlyClick ? 'cursor-pointer hover:bg-muted' : '',
    isSelected ? 'font-bold bg-foreground/10' : '',
  )

  if (!entry || !onPlyClick) {
    return <div className={cls}>{content}</div>
  }

  return (
    <button
      type="button"
      onClick={() => onPlyClick({ line: 'main', index: entry.idx })}
      className={cls}
    >
      {content}
    </button>
  )
}

function VariationLines({
  svEntries,
  selectedPly,
  onPlyClick,
  isLast = false,
}: {
  svEntries: Array<{ moves: DisplayMoveMin[]; si: number }>
  selectedPly: PlySelection | null | undefined
  onPlyClick: ((ply: PlySelection) => void) | undefined
  isLast?: boolean
}): React.ReactElement | null {
  if (svEntries.length === 0) return null

  const multi = svEntries.length > 1

  return (
    <div className={cn('flex-[0_0_100%] bg-muted/30 pl-2 text-xs', isLast && 'border-t border-border', !isLast && 'border-b border-border')}>
      <div className={cn('py-2 pr-2', multi ? 'pl-[18px]' : 'pl-2')}>
        {svEntries.map(({ moves, si }, i) => (
          <div key={si} className={cn('relative', i > 0 && 'mt-2')}>
            {multi && (
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute left-[-16px] w-[8px] border-l-2 border-border',
                  i === 0 ? '-top-2' : 'top-0',
                  i === svEntries.length - 1
                    ? 'h-[0.85em]'
                    : i === 0
                      ? 'h-[calc(100%+1rem)]'
                      : 'h-[calc(100%+0.5rem)]',
                )}
              >
                <span className={cn(
                  'absolute left-0 block h-0 w-[8px] -translate-y-0.5 border-t-2 border-border',
                  i === 0 ? 'top-[calc(0.85em+0.5rem)]' : 'top-[0.85em]',
                )} />
              </span>
            )}
            <MoveSequence
              moves={moves}
              line="subvariation"
              subIndex={si}
              selectedPly={selectedPly}
              onPlyClick={onPlyClick}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function PgnColumnView({
  pgnDisplay,
  selectedPly,
  onPlyClick,
}: {
  pgnDisplay: TrainingItemMetaPgnDisplayMin
  selectedPly: PlySelection | null | undefined
  onPlyClick: ((ply: PlySelection) => void) | undefined
}): React.ReactElement {
  const { rows, svAfterWhite, svAfterBlack } = React.useMemo(
    () => computePgnLayout(pgnDisplay),
    [pgnDisplay],
  )

  const numCellCls = 'flex-[0_0_13%] flex select-none items-center justify-center border-r border-border bg-muted py-0.5 text-[11px] leading-[1.75em] text-muted-foreground/60'

  return (
    <div className="flex flex-wrap leading-normal">
      {rows.map((row, r) => {
        const isLast = r === rows.length - 1
        const svEntriesAfterBlack = svAfterBlack.get(r)
        const svEntriesAfterWhite = svAfterWhite.get(r)

        if (svEntriesAfterWhite) {
          // Variation branches right after White's move. Show White cell, then a
          // "..." Black placeholder, then the variation block. If the mainline has
          // a Black response at this row, continue with it after the variation
          // (blank number + "..." White placeholder + Black cell), matching the
          // standard "2. Nc3 (...) 2... c5" PGN layout.
          const hasBlackContinuation = row.black !== null
          // Avoid double-border: when the variation is the very last element, let
          // it own the top border (isLast=true on VariationLines) and skip border-b
          // on the cells above it.
          const preCellsBorderB = hasBlackContinuation || !isLast
          return (
            <React.Fragment key={row.moveNumber}>
              <div className={cn(numCellCls, preCellsBorderB && 'border-b')}>{row.moveNumber}</div>
              <ColumnMoveCell entry={row.white} selectedPly={selectedPly} onPlyClick={onPlyClick} bottomBorder={preCellsBorderB} showPlaceholder={row.white === null} />
              <ColumnMoveCell entry={null} selectedPly={selectedPly} onPlyClick={onPlyClick} rightBorder={false} bottomBorder={preCellsBorderB} showPlaceholder />
              <VariationLines svEntries={svEntriesAfterWhite} selectedPly={selectedPly} onPlyClick={onPlyClick} isLast={!hasBlackContinuation && isLast} />
              {hasBlackContinuation && (
                <>
                  <div className={cn(numCellCls, !isLast && 'border-b')} />
                  <ColumnMoveCell entry={null} selectedPly={selectedPly} onPlyClick={onPlyClick} bottomBorder={!isLast} showPlaceholder />
                  <ColumnMoveCell entry={row.black} selectedPly={selectedPly} onPlyClick={onPlyClick} rightBorder={false} bottomBorder={!isLast} />
                  {svEntriesAfterBlack && (
                    <VariationLines svEntries={svEntriesAfterBlack} selectedPly={selectedPly} onPlyClick={onPlyClick} isLast={isLast} />
                  )}
                </>
              )}
            </React.Fragment>
          )
        }

        return (
          <React.Fragment key={row.moveNumber}>
            <div className={cn(numCellCls, !isLast && 'border-b')}>{row.moveNumber}</div>
            <ColumnMoveCell entry={row.white} selectedPly={selectedPly} onPlyClick={onPlyClick} bottomBorder={!isLast} showPlaceholder={row.white === null} />
            <ColumnMoveCell entry={row.black} selectedPly={selectedPly} onPlyClick={onPlyClick} rightBorder={false} bottomBorder={!isLast} />
            {svEntriesAfterBlack && (
              <VariationLines svEntries={svEntriesAfterBlack} selectedPly={selectedPly} onPlyClick={onPlyClick} isLast={isLast} />
            )}
          </React.Fragment>
        )
      })}
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
  return <PgnColumnView pgnDisplay={pgnDisplay} selectedPly={selectedPly} onPlyClick={onPlyClick} />
}

function DecoySection({
  source,
  focusMode,
  runPosition,
  opening,
  trainingItemId,
}: {
  source: DecoySourceMetadata
  focusMode: boolean
  runPosition: number | undefined
  opening: OpeningInfo | null
  trainingItemId?: number
}): React.ReactElement {
  if (focusMode) {
    return (
      <span className="font-mono text-sm">
        <span className="text-xs text-muted-foreground">Puzzle </span>
        #{runPosition !== undefined ? runPosition + 1 : '—'}
      </span>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="shrink-0 font-mono text-sm">#{trainingItemId ?? '—'}</span>
        <TrainingItemTypeBadge source="DECOY" />
      </div>
      {source.game !== null && <DecoyGameInfo g={source.game} />}
      {opening !== null && (
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="shrink-0 font-mono text-xs font-semibold">{opening.eco}</span>
          <span className="truncate text-xs text-muted-foreground">{opening.displayName}</span>
        </div>
      )}
    </div>
  )
}

function SourceSection({
  source,
  focusMode,
  runPosition,
  opening,
  trainingItemId,
}: {
  source: SourceMetadata
  focusMode: boolean
  runPosition: number | undefined
  opening: OpeningInfo | null
  trainingItemId?: number
}): React.ReactElement | null {
  if (source.sourceType === 'LICHESS_TACTIC') {
    return <LichessTacticSection source={source} focusMode={focusMode} runPosition={runPosition} opening={opening} trainingItemId={trainingItemId} />
  }
  if (source.sourceType === 'SCRAPED_POSITIONAL') {
    return <ScrapedPositionalSection source={source} focusMode={focusMode} runPosition={runPosition} opening={opening} trainingItemId={trainingItemId} />
  }
  if (source.sourceType === 'DECOY') {
    return <DecoySection source={source} focusMode={focusMode} runPosition={runPosition} opening={opening} trainingItemId={trainingItemId} />
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
  const themes: Array<{ name: string; displayName: string | null; description?: string | null }> =
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
          {source.sourceType !== 'DECOY' && (
            <span className="shrink-0 text-sm tabular-nums">
              <span className="text-xs text-muted-foreground">Rating: </span>
              {ratingDisplay}
            </span>
          )}
        </div>
        {hasDetails && (
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')}
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-[-1px] right-[-1px] z-50 flex flex-col gap-3 rounded-b-md border border-t-0 border-border bg-background px-3 pt-3 shadow-md">
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
            <div className="flex flex-wrap gap-1">
              {themes.map((t) => {
                const label = t.displayName ?? t.name
                if (!('description' in t) || !t.description) {
                  return (
                    <span key={t.name} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {label}
                    </span>
                  )
                }
                return (
                  <Tooltip key={t.name} delayDuration={200}>
                    <TooltipTrigger asChild>
                      <span className="cursor-default rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors">
                        {label}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px] text-center text-xs">
                      {t.description}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          )}
          {pgnDisplay !== null && pgnDisplay.mainline.length > 0 && (
            <div className="-mx-3 border-t border-border">
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

  return (
    <div className={cn(
      'flex flex-col gap-3 overflow-hidden rounded-md border border-border px-3 pt-3',
      pgnDisplay !== null && pgnDisplay.mainline.length > 0 ? 'pb-0' : 'pb-3',
    )}>
      <SourceSection source={source} focusMode={focusMode} runPosition={runPosition} opening={source.opening} trainingItemId={trainingItemId} />
      {pgnDisplay !== null && pgnDisplay.mainline.length > 0 && (
        <div className="-mx-3 border-t border-border">
          <PgnDisplayBlock pgnDisplay={pgnDisplay} selectedPly={selectedPly} onPlyClick={onPlyClick} />
          {!focusMode && source.sourceType === 'DECOY' && (
            <DecoyEvalSection source={source} selectedPly={selectedPly} pgnDisplay={pgnDisplay} />
          )}
        </div>
      )}
    </div>
  )
}
