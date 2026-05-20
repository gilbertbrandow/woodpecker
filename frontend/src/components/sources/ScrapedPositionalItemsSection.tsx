import * as React from 'react'
import { useState, useEffect } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  api,
  type ScrapedPositionalPage,
  type ScrapedPositionalDifficultyDetail,
  type ScrapedPositionalThemeDetail,
  type Opening,
} from '../../lib/api'
import { Skeleton } from '../ui/skeleton'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table'
import { FilterSelect } from '../ui/filter-select'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { PositionalDifficultyBadge } from '../PositionalDifficultyBadge'
import { formatNumber } from '../../lib/utils'

const OPENING_MAX_CHARS = 24

function ThemeBadges({
  themes,
}: {
  themes: { name: string; displayName: string }[]
}): React.ReactElement {
  const shown = themes.slice(0, 2)
  const extra = themes.length - 2
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((t) => (
        <Badge key={t.name} variant="outline" className="text-xs font-normal">
          {t.displayName}
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

type Props = {
  difficulties: ScrapedPositionalDifficultyDetail[]
  themes: ScrapedPositionalThemeDetail[]
}

export function ScrapedPositionalItemsSection({ difficulties, themes }: Props): React.ReactElement {
  const [difficultyFilter, setDifficultyFilter] = useState('')
  const [themeFilter, setThemeFilter] = useState('')
  const [selectedOpening, setSelectedOpening] = useState<Opening | null>(null)
  const [openingSearch, setOpeningSearch] = useState('')
  const [openingResults, setOpeningResults] = useState<Opening[]>([])
  const [openingDropdownOpen, setOpeningDropdownOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<ScrapedPositionalPage | null>(null)
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
    api.sources.scrapedPositional
      .items({
        page,
        difficulty: difficultyFilter ? Number(difficultyFilter) : undefined,
        theme: themeFilter || undefined,
        opening: selectedOpening?.name,
      })
      .then(setResult)
      .catch(() => toast.error('Failed to load puzzles', { description: 'Please try again.' }))
      .finally(() => setLoading(false))
  }, [page, difficultyFilter, themeFilter, selectedOpening])

  const hasFilters = difficultyFilter || themeFilter || selectedOpening

  const resetFilters = (): void => {
    setDifficultyFilter('')
    setThemeFilter('')
    setSelectedOpening(null)
    setOpeningSearch('')
    setOpeningResults([])
    setPage(1)
  }

  const handleDifficultyChange = (val: string): void => {
    setDifficultyFilter(val)
    setPage(1)
  }

  const handleThemeChange = (val: string): void => {
    setThemeFilter(val)
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
        <FilterSelect
          value={difficultyFilter}
          onValueChange={handleDifficultyChange}
          placeholder="All difficulties"
          options={difficulties.map((d) => ({
            value: String(d.value),
            label: d.minRating !== null && d.maxRating !== null
              ? `${d.label} · ${d.minRating}–${d.maxRating}`
              : d.label,
          }))}
          className="text-xs"
        />
        <FilterSelect
          value={themeFilter}
          onValueChange={handleThemeChange}
          placeholder="All themes"
          options={themes.map((t) => ({ value: t.name, label: t.displayName }))}
          className="text-xs"
        />
        {selectedOpening ? (
          <div className="flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs">
            <span className="max-w-[160px] truncate">{selectedOpening.displayName ?? selectedOpening.name}</span>
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
                  <TableHead className="w-44">Difficulty</TableHead>
                  <TableHead>Themes</TableHead>
                  <TableHead className="hidden sm:table-cell">Opening</TableHead>
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
                  return (
                  <TableRow key={p.internalId}>
                    <TableCell>
                      <PositionalDifficultyBadge difficulty={p.difficulty} />
                    </TableCell>
                    <TableCell>
                      <ThemeBadges themes={p.themes} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {openingLabel}
                    </TableCell>
                    <TableCell>
                      <a
                        href={p.lichessUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="View position on Lichess"
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
