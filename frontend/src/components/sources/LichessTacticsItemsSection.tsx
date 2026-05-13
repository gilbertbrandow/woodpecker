import * as React from 'react'
import { useState, useEffect, useRef } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { toast } from 'sonner'
import { api, type LichessTacticPage, type Theme, type Opening } from '../../lib/api'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { Skeleton } from '../ui/skeleton'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table'
import { formatNumber } from '../../lib/utils'

const OPENING_MAX_CHARS = 24

function ThemeBadges({
  themes,
}: {
  themes: { name: string; displayName: string | null }[]
}): React.ReactElement {
  const shown = themes.slice(0, 2)
  const extra = themes.length - 2
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((t) => (
        <Badge key={t.name} variant="outline" className="text-xs font-normal">
          {t.displayName ?? t.name}
        </Badge>
      ))}
      {extra > 0 && (
        <Badge variant="outline" className="text-xs font-normal">
          +{extra}
        </Badge>
      )}
    </div>
  )
}

export function LichessTacticsItemsSection(): React.ReactElement {
  const [allThemes, setAllThemes] = useState<Theme[]>([])

  const [ratingMin, setRatingMin] = useState('')
  const [ratingMax, setRatingMax] = useState('')
  const [themeFilter, setThemeFilter] = useState('')
  const [selectedOpenings, setSelectedOpenings] = useState<Opening[]>([])
  const [openingSearch, setOpeningSearch] = useState('')
  const [openingResults, setOpeningResults] = useState<Opening[]>([])
  const [openingDropdownOpen, setOpeningDropdownOpen] = useState(false)

  // Committed rating — updated after debounce so typing doesn't spam requests
  const [committedMin, setCommittedMin] = useState('')
  const [committedMax, setCommittedMax] = useState('')
  const ratingMounted = useRef(false)

  const [page, setPage] = useState(1)
  const [result, setResult] = useState<LichessTacticPage | null>(null)
  const [loading, setLoading] = useState(true)

  // Load theme list once
  useEffect(() => {
    api.themes.list().then(setAllThemes).catch(() => {})
  }, [])

  // Debounce rating inputs; skip the initial mount to avoid double-fetch
  useEffect(() => {
    if (!ratingMounted.current) {
      ratingMounted.current = true
      return
    }
    const t = setTimeout(() => {
      setCommittedMin(ratingMin)
      setCommittedMax(ratingMax)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [ratingMin, ratingMax])

  // Debounce opening search
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

  // Fetch items whenever any committed filter or page changes
  useEffect(() => {
    setLoading(true)
    api.sources.lichessTactics
      .items({
        page,
        ratingMin: committedMin ? Number(committedMin) : undefined,
        ratingMax: committedMax ? Number(committedMax) : undefined,
        theme: themeFilter || undefined,
        openings: selectedOpenings.length > 0 ? selectedOpenings.map((o) => o.name) : undefined,
      })
      .then(setResult)
      .catch(() => toast.error('Failed to load tactics', { description: 'Please try again.' }))
      .finally(() => setLoading(false))
  }, [page, committedMin, committedMax, themeFilter, selectedOpenings])

  const hasFilters = ratingMin || ratingMax || themeFilter || selectedOpenings.length > 0

  const resetFilters = (): void => {
    setRatingMin('')
    setRatingMax('')
    setCommittedMin('')
    setCommittedMax('')
    setThemeFilter('')
    setSelectedOpenings([])
    setOpeningSearch('')
    setOpeningResults([])
    setPage(1)
  }

  const handleThemeChange = (val: string): void => {
    setThemeFilter(val)
    setPage(1)
  }

  const addOpening = (o: Opening): void => {
    if (selectedOpenings.some((s) => s.name === o.name)) return
    setSelectedOpenings((prev) => [...prev, o])
    setOpeningSearch('')
    setOpeningResults([])
    setOpeningDropdownOpen(false)
    setPage(1)
  }

  const removeOpening = (name: string): void => {
    setSelectedOpenings((prev) => prev.filter((o) => o.name !== name))
    setPage(1)
  }

  // Filter out already-selected openings from dropdown results
  const filteredResults = openingResults.filter(
    (o) => !selectedOpenings.some((s) => s.name === o.name),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Example tactics</p>
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

      {/* Filter bar */}
      <div className="flex flex-wrap items-start gap-2">
        {/* Rating range */}
        <div className="flex items-center gap-1">
          <Input
            type="number"
            placeholder="Min rating"
            value={ratingMin}
            onChange={(e) => setRatingMin(e.target.value)}
            className="h-8 w-28 text-xs"
          />
          <Input
            type="number"
            placeholder="Max rating"
            value={ratingMax}
            onChange={(e) => setRatingMax(e.target.value)}
            className="h-8 w-28 text-xs"
          />
        </div>

        {/* Theme select */}
        <select
          value={themeFilter}
          onChange={(e) => handleThemeChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All themes</option>
          {allThemes.map((t) => (
            <option key={t.name} value={t.name}>
              {t.displayName ?? t.name}
            </option>
          ))}
        </select>

        {/* Opening multi-select */}
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedOpenings.map((o) => (
            <div
              key={o.name}
              className="flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs"
            >
              <span className="max-w-[140px] truncate">{o.displayName ?? o.name}</span>
              <button
                type="button"
                onClick={() => removeOpening(o.name)}
                className="ml-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="relative">
            <Input
              type="text"
              placeholder="Add opening…"
              value={openingSearch}
              onChange={(e) => {
                setOpeningSearch(e.target.value)
                setOpeningDropdownOpen(true)
              }}
              onFocus={() => {
                if (filteredResults.length > 0) setOpeningDropdownOpen(true)
              }}
              onBlur={() => setTimeout(() => setOpeningDropdownOpen(false), 150)}
              className="h-8 w-44 text-xs"
            />
            {openingDropdownOpen && filteredResults.length > 0 && (
              <ul className="absolute z-50 mt-1 max-h-52 w-72 overflow-y-auto rounded-md border bg-background shadow-md">
                {filteredResults.map((o) => (
                  <li key={o.name}>
                    <button
                      type="button"
                      onMouseDown={() => addOpening(o)}
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
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : result?.puzzles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tactics match these filters.</p>
      ) : result ? (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Rating</TableHead>
                  <TableHead>Themes</TableHead>
                  <TableHead className="hidden sm:table-cell">Opening</TableHead>
                  <TableHead className="hidden sm:table-cell w-24">Popularity</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.puzzles.map((p) => {
                  const opening = p.openings[0]
                  const openingLabel = opening
                    ? opening.displayName.length > OPENING_MAX_CHARS
                      ? opening.displayName.slice(0, OPENING_MAX_CHARS - 1) + '…'
                      : opening.displayName
                    : '—'
                  return (
                    <TableRow key={p.puzzleId}>
                      <TableCell className="tabular-nums">{p.rating}</TableCell>
                      <TableCell>
                        <ThemeBadges themes={p.themes} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {openingLabel}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell tabular-nums text-xs text-muted-foreground">
                        {p.popularity}
                      </TableCell>
                      <TableCell>
                        <a
                          href={p.gameUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="View game on Lichess"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
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
