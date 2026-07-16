import * as React from "react";
import { useMemo, useState, useEffect } from "react";
import { ExternalLink, Compass, Zap, X } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  api,
  type LichessTactic,
  type Theme,
} from "../../lib/api";
import { ServerDataTable, type FetchParams } from "../ServerDataTable";
import { col, actionCol } from "../DataTable";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import type { RangeFilterSpec, SetFilterSpec } from "../filters/types";
import { DATA_ICONS } from "../../lib/icons";
import { useOpeningFilterSpec } from "../../hooks/useOpeningFilterSpec";

const OPENING_MAX_CHARS = 24;

function ThemeBadges({
  themes,
}: {
  themes: { name: string; displayName: string | null }[];
}): React.ReactElement {
  const shown = themes.slice(0, 2);
  const extra = themes.length - 2;
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
  );
}

// ---------------------------------------------------------------------------
// Theme selector content — multi-select, loads all themes on mount
// ---------------------------------------------------------------------------

function ThemeSelectorContent({
  value,
  onChange,
}: {
  value: Theme[]
  onChange: (items: Theme[]) => void
}): React.ReactElement {
  const [allThemes, setAllThemes] = useState<Theme[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.themes.list().then(setAllThemes).catch(() => {})
  }, [])

  const selectedNames = new Set(value.map((t) => t.name))
  const filtered = search
    ? allThemes.filter((t) =>
        (t.displayName ?? t.name).toLowerCase().includes(search.toLowerCase())
      )
    : allThemes
  const unselected = filtered.filter((t) => !selectedNames.has(t.name))

  const toggle = (theme: Theme): void => {
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
              <span>{t.displayName ?? t.name}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v.name !== t.name))}
                className="ml-1 rounded-full hover:text-foreground"
                aria-label={`Remove ${t.displayName ?? t.name}`}
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
              {t.displayName ?? t.name}
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

const COLUMNS: ColumnDef<LichessTactic>[] = [
  col({
    id: "rating",
    accessorKey: "rating",
    header: "Rating",
    meta: { icon: DATA_ICONS.rating },
    enableSorting: false,
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.rating}</span>
    ),
  }),
  col({
    id: "themes",
    header: "Themes",
    meta: { icon: Zap },
    enableSorting: false,
    cell: ({ row }) => <ThemeBadges themes={row.original.themes} />,
  }),
  col({
    id: "opening",
    header: "Opening",
    meta: { icon: Compass, defaultHidden: true },
    enableSorting: false,
    cell: ({ row }) => {
      const opening = row.original.openings[0]
      if (!opening) return <span className="text-xs text-muted-foreground">—</span>
      const label =
        opening.displayName.length > OPENING_MAX_CHARS
          ? opening.displayName.slice(0, OPENING_MAX_CHARS - 1) + "…"
          : opening.displayName
      return <span className="text-xs text-muted-foreground">{label}</span>
    },
  }),
  col({
    id: "popularity",
    accessorKey: "popularity",
    header: "Popularity",
    meta: { icon: DATA_ICONS.rating, defaultHidden: true },
    enableSorting: false,
    cell: ({ row }) => (
      <span className="tabular-nums text-xs text-muted-foreground">
        {row.original.popularity}
      </span>
    ),
  }),
  actionCol({
    id: "link",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <a
        href={row.original.gameUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground"
        aria-label="View game on Lichess"
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

export function LichessTacticsItemsSection(): React.ReactElement {
  const ratingFilterSpec = useMemo<RangeFilterSpec>(() => ({
    type: 'range',
    key: 'rating',
    label: 'Rating',
    min: 0,
    max: 3000,
    step: 50,
    icon: DATA_ICONS.rating,
  }), [])

  const themeFilterSpec = useMemo<SetFilterSpec<Theme>>(() => ({
    type: 'set',
    key: 'theme',
    label: 'Theme',
    icon: Zap,
    serialize: (items) => items.map((t) => t.name),
    resolveInstant: (name) => ({ name, displayName: null, description: null }),
    render: (value, onChange) => (
      <ThemeSelectorContent value={value} onChange={onChange} />
    ),
    getChipLabel: (items) => {
      if (items.length === 0) return ''
      if (items.length === 1) return items[0].displayName ?? items[0].name
      return `${items.length} themes`
    },
    renderChipValue: (items) => {
      if (items.length === 0) return null
      const label = items.length === 1
        ? (items[0].displayName ?? items[0].name)
        : `${items.length} themes`
      return <span className="font-medium text-foreground">{label}</span>
    },
  }), [])

  const openingFilterSpec = useOpeningFilterSpec('opening')

  const filters = useMemo(
    () => [ratingFilterSpec, themeFilterSpec, openingFilterSpec],
    [ratingFilterSpec, themeFilterSpec, openingFilterSpec],
  )

  const fetchData = React.useCallback(async (params: FetchParams) => {
    const res = await api.sources.lichessTactics.items(params)
    return { items: res.puzzles, total: res.total }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold">Example tactics</p>
      <ServerDataTable
        tableId="lichess-tactics"
        columns={COLUMNS}
        pageSize={PAGE_SIZE}
        filters={filters}
        fetchData={fetchData}
        initialSorting={[]}
        emptyMessage="No tactics match these filters."
      />
    </div>
  )
}
