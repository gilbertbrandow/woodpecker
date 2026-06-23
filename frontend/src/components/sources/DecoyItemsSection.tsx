import * as React from 'react'
import { useState, useEffect } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { api, type DecoyPage, type Opening } from '../../lib/api'
import { Skeleton } from '../ui/skeleton'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { formatNumber } from '../../lib/utils'

const OPENING_MAX_CHARS = 24

function CpBadge({ cp }: { cp: number }): React.ReactElement {
  return (
    <Badge variant="outline" className="text-xs font-mono font-normal">
      {cp > 0 ? '+' : ''}{cp}
    </Badge>
  )
}

export function DecoyItemsSection(): React.ReactElement {
  const [selectedOpening, setSelectedOpening] = useState<Opening | null>(null)
  const [openingSearch, setOpeningSearch] = useState('')
  const [openingResults, setOpeningResults] = useState<Opening[]>([])
  const [openingDropdownOpen, setOpeningDropdownOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<DecoyPage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (openingSearch.length < 2) {
      setOpeningResults([])
      return
    }
    const t = setTimeout(() => {
      api.openings.search(openingSearch).then(setOpeningResults).catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [openingSearch])

  useEffect(() => {
    setLoading(true)
    api.sources.decoys
      .items({ page, opening: selectedOpening?.name })
      .then(setResult)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, selectedOpening])

  const hasFilters = !!selectedOpening

  const resetFilters = (): void => {
    setSelectedOpening(null)
    setOpeningSearch('')
    setOpeningResults([])
    setPage(1)
  }

  const selectOpening = (o: Opening): void => {
    setSelectedOpening(o)
    setOpeningSearch('')
    setOpeningResults([])
    setOpeningDropdownOpen(false)
    setPage(1)
  }

  const clearOpening = (): void => {
    setSelectedOpening(null)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Example puzzles</p>
        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Reset filters
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {selectedOpening ? (
          <div className="flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs">
            <span className="max-w-[160px] truncate">
              {selectedOpening.displayName ?? selectedOpening.name}
            </span>
            <button
              type="button"
              onClick={clearOpening}
              className="ml-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Input
              type="text"
              placeholder="Filter by opening…"
              value={openingSearch}
              onChange={(e) => {
                setOpeningSearch(e.target.value)
                setOpeningDropdownOpen(true)
              }}
              onFocus={() => { if (openingResults.length > 0) setOpeningDropdownOpen(true) }}
              onBlur={() => setTimeout(() => setOpeningDropdownOpen(false), 150)}
              className="h-8 w-44 text-xs"
            />
            {openingDropdownOpen && openingResults.length > 0 && (
              <ul className="absolute z-50 mt-1 max-h-52 w-72 overflow-y-auto rounded-md border bg-background shadow-md">
                {openingResults.map((o) => (
                  <li key={o.name}>
                    <button
                      type="button"
                      onMouseDown={() => selectOpening(o)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent"
                    >
                      {o.eco && (
                        <span className="shrink-0 font-mono text-muted-foreground">{o.eco}</span>
                      )}
                      <span className="text-foreground">{o.displayName ?? o.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : result?.puzzles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No puzzles match these filters.</p>
      ) : result ? (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Best CP</TableHead>
                  <TableHead className="hidden sm:table-cell">Opening</TableHead>
                  <TableHead className="hidden md:table-cell">Game</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.puzzles.map((p) => {
                  const openingLabel = p.opening
                    ? p.opening.displayName.length > OPENING_MAX_CHARS
                      ? p.opening.displayName.slice(0, OPENING_MAX_CHARS - 1) + '…'
                      : p.opening.displayName
                    : '—'
                  const gameLabel = p.game
                    ? `${p.game.white} vs ${p.game.black}`
                    : '—'
                  const gameShort =
                    gameLabel.length > 28 ? gameLabel.slice(0, 27) + '…' : gameLabel
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <CpBadge cp={p.bestCp} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {openingLabel}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {gameShort}
                      </TableCell>
                      <TableCell>
                        {p.analysisUrl && (
                          <a
                            href={p.analysisUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="View position on Lichess"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {result.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded px-2 py-1 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                {formatNumber((page - 1) * result.pageSize + 1)}–
                {formatNumber(Math.min(page * result.pageSize, result.total))} of{' '}
                {formatNumber(result.total)}
              </span>
              <button
                type="button"
                disabled={page >= result.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded px-2 py-1 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
