import * as React from 'react'
import { useMemo, useState, useEffect } from 'react'
import { Compass, ExternalLink, Gauge, X, Zap } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import {
  api,
  type ScrapedPositionalPuzzle,
  type ScrapedPositionalDifficultyDetail,
  type ScrapedPositionalThemeDetail,
} from '../../lib/api'
import { ServerDataTable, type FetchParams } from '../ServerDataTable'
import { col, actionCol } from '../DataTable'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import type { MultiFilterSpec, SetFilterSpec } from '../filters/types'
import { useOpeningFilterSpec } from '../../hooks/useOpeningFilterSpec'
import { PositionalDifficultyBadge } from '../PositionalDifficultyBadge'

const OPENING_MAX_CHARS = 24

const DIFFICULTY_DOT_COLOR: Record<number, string> = {
  1: 'bg-emerald-500',
  2: 'bg-amber-500',
  3: 'bg-orange-500',
  4: 'bg-red-500',
}

function DifficultyDot({ value }: { value: number }): React.ReactElement {
  const color = DIFFICULTY_DOT_COLOR[value] ?? 'bg-muted-foreground'
  return <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${color}`} />
}

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

// ---------------------------------------------------------------------------
// Theme selector content — multi-select, loads themes from source run metadata
// ---------------------------------------------------------------------------

function ThemeSelectorContent({
  value,
  onChange,
}: {
  value: ScrapedPositionalThemeDetail[]
  onChange: (items: ScrapedPositionalThemeDetail[]) => void
}): React.ReactElement {
  const [allThemes, setAllThemes] = useState<ScrapedPositionalThemeDetail[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.sources.scrapedPositional.sourceRunMetadata()
      .then((res) => {
        if (res.metadata) setAllThemes(res.metadata.themes)
      })
      .catch(() => {})
  }, [])

  const selectedNames = new Set(value.map((t) => t.name))
  const filtered = search
    ? allThemes.filter((t) =>
        t.displayName.toLowerCase().includes(search.toLowerCase())
      )
    : allThemes
  const unselected = filtered.filter((t) => !selectedNames.has(t.name))

  const toggle = (theme: ScrapedPositionalThemeDetail): void => {
    if (selectedNames.has(theme.name)) {
      onChange(value.filter((t) => t.name !== theme.name))
    } else {
      onChange([...value, theme])
    }
  }

  return (
    <div className="w-64 p-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b pb-2 mb-1">
          {value.map((t) => (
            <span
              key={t.name}
              className="flex items-center overflow-hidden rounded-full bg-muted pl-2 pr-1 text-xs"
            >
              <span>{t.displayName}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v.name !== t.name))}
                className="ml-1 rounded-full hover:text-foreground"
                aria-label={`Remove ${t.displayName}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        type="text"
        placeholder="Search themes…"
        value={search}
        autoFocus
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-xs mb-1"
      />
      <ul className="max-h-48 overflow-y-auto">
        {unselected.map((t) => (
          <li key={t.name}>
            <button
              type="button"
              onClick={() => toggle(t)}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent rounded"
            >
              {t.displayName}
            </button>
          </li>
        ))}
        {unselected.length === 0 && (
          <li className="px-2 py-1.5 text-xs text-muted-foreground">No themes found.</li>
        )}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const COLUMNS: ColumnDef<ScrapedPositionalPuzzle>[] = [
  col({
    id: 'difficulty',
    header: 'Difficulty',
    meta: { icon: Gauge },
    enableSorting: false,
    cell: ({ row }) => <PositionalDifficultyBadge difficulty={row.original.difficulty} />,
  }),
  col({
    id: 'themes',
    header: 'Themes',
    meta: { icon: Zap },
    enableSorting: false,
    cell: ({ row }) => <ThemeBadges themes={row.original.themes} />,
  }),
  col({
    id: 'opening',
    header: 'Opening',
    meta: { icon: Compass },
    enableSorting: false,
    cell: ({ row }) => {
      const opening = row.original.opening
      if (!opening) return <span className="text-xs text-muted-foreground">—</span>
      const openingLabel =
        opening.displayName.length > OPENING_MAX_CHARS
          ? opening.displayName.slice(0, OPENING_MAX_CHARS - 1) + '…'
          : opening.displayName
      return <span className="text-xs text-muted-foreground">{openingLabel}</span>
    },
  }),
  actionCol({
    id: 'link',
    header: '',
    enableSorting: false,
    cell: ({ row }) => (
      <a
        href={row.original.lichessUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground"
        aria-label="View position on Lichess"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    ),
  }),
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20

type Props = {
  difficulties: ScrapedPositionalDifficultyDetail[]
  /** @deprecated themes are now loaded internally — this prop is ignored */
  themes?: ScrapedPositionalThemeDetail[]
}

export function ScrapedPositionalItemsSection({ difficulties }: Props): React.ReactElement {
  const difficultyFilterSpec = useMemo<MultiFilterSpec>(() => ({
    type: 'multi',
    key: 'difficulty',
    label: 'Difficulty',
    icon: Gauge,
    options: difficulties.map((d) => ({
      value: String(d.value),
      label:
        d.minRating !== null && d.maxRating !== null
          ? `${d.label} · ${d.minRating}–${d.maxRating}`
          : d.label,
      icon: <DifficultyDot value={d.value} />,
    })),
  }), [difficulties])

  const themeFilterSpec = useMemo<SetFilterSpec<ScrapedPositionalThemeDetail>>(() => ({
    type: 'set',
    key: 'theme',
    label: 'Theme',
    icon: Zap,
    serialize: (items) => items.map((t) => t.name),
    resolveInstant: (name) => ({ name, displayName: name, description: '', count: 0 }),
    render: (value, onChange) => (
      <ThemeSelectorContent value={value} onChange={onChange} />
    ),
    getChipLabel: (items) => {
      if (items.length === 0) return ''
      if (items.length === 1) return items[0].displayName
      return `${items.length} themes`
    },
    renderChipValue: (items) => {
      if (items.length === 0) return null
      const label =
        items.length === 1 ? items[0].displayName : `${items.length} themes`
      return <span className="font-medium text-foreground">{label}</span>
    },
  }), [])

  const openingFilterSpec = useOpeningFilterSpec('opening')

  const filters = useMemo(
    () => [difficultyFilterSpec, themeFilterSpec, openingFilterSpec],
    [difficultyFilterSpec, themeFilterSpec, openingFilterSpec],
  )

  const fetchData = React.useCallback(async (params: FetchParams) => {
    return api.sources.scrapedPositional.items(params)
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold">Example puzzles</p>
      <ServerDataTable
        tableId="scraped-positional"
        columns={COLUMNS}
        pageSize={PAGE_SIZE}
        filters={filters}
        fetchData={fetchData}
        initialSorting={[]}
        emptyMessage="No puzzles match these filters."
      />
    </div>
  )
}
