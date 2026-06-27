import * as React from 'react'
import { useState, useEffect } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { api, type DecoyItem, type Opening } from '../../lib/api'
import { DataTable } from '../DataTable'
import { Input } from '../ui/input'

const OPENING_MAX_CHARS = 26

function PlayerCell({ name, title, elo }: { name: string; title: string | null; elo: number | null }): React.ReactElement {
  return (
    <span className="text-xs">
      {title && <span className="mr-1 font-semibold text-muted-foreground">{title}</span>}
      {name}
      {elo !== null && <span className="ml-1 tabular-nums text-muted-foreground">({elo})</span>}
    </span>
  )
}

const COLUMNS: ColumnDef<DecoyItem>[] = [
  {
    id: 'position',
    header: 'Position',
    cell: ({ row }) => {
      const { moveNumber, fen } = row.original
      const sideToMove = fen.split(' ')[1] === 'w' ? 'White' : 'Black'
      return (
        <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
          Move {moveNumber} · <span className="text-foreground">{sideToMove}</span>
        </span>
      )
    },
  },
  {
    id: 'white',
    header: 'White',
    cell: ({ row }) => {
      const g = row.original.game
      if (!g) return <span className="text-xs text-muted-foreground">—</span>
      return <PlayerCell name={g.white} title={g.whiteTitle} elo={g.whiteElo} />
    },
  },
  {
    id: 'black',
    header: 'Black',
    cell: ({ row }) => {
      const g = row.original.game
      if (!g) return <span className="text-xs text-muted-foreground">—</span>
      return <PlayerCell name={g.black} title={g.blackTitle} elo={g.blackElo} />
    },
  },
  {
    id: 'opening',
    header: 'Opening',
    cell: ({ row }) => {
      const o = row.original.opening
      if (!o) return <span className="text-xs text-muted-foreground">—</span>
      const label =
        o.displayName.length > OPENING_MAX_CHARS
          ? o.displayName.slice(0, OPENING_MAX_CHARS - 1) + '…'
          : o.displayName
      return <span className="text-xs text-muted-foreground">{label}</span>
    },
  },
  {
    id: 'link',
    header: '',
    enableSorting: false,
    cell: ({ row }) => {
      const url = row.original.analysisUrl
      if (!url) return null
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground"
          aria-label="View position on Lichess"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )
    },
  },
]

export function DecoyItemsSection(): React.ReactElement {
  const [selectedOpening, setSelectedOpening] = useState<Opening | null>(null)
  const [openingSearch, setOpeningSearch] = useState('')
  const [openingResults, setOpeningResults] = useState<Opening[]>([])
  const [openingDropdownOpen, setOpeningDropdownOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<DecoyItem[]>([])
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(20)
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
      .then((res) => {
        setItems(res.puzzles)
        setTotal(res.total)
        setPageSize(res.pageSize)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, selectedOpening])

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

  const filtersSlot = (
    <>
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
    </>
  )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold">Example puzzles</p>
      <DataTable
        columns={COLUMNS}
        data={items}
        hideSearch
        filtersSlot={filtersSlot}
        filtersActive={!!selectedOpening}
        onClearFilters={clearOpening}
        loading={loading}
        tableId={false}
        serverPagination={{
          totalRows: total,
          page,
          pageSize,
          onPageChange: setPage,
        }}
        emptyMessage="No puzzles match these filters."
      />
    </div>
  )
}
