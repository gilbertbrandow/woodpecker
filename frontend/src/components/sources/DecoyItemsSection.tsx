import * as React from 'react'
import { useMemo } from 'react'
import { ExternalLink, Compass } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { api, type DecoyItem } from '../../lib/api'
import { ServerDataTable, type FetchParams } from '../ServerDataTable'
import { col, actionCol } from '../DataTable'
import { DATA_ICONS } from '../../lib/icons'
import { useOpeningFilterSpec } from '../../hooks/useOpeningFilterSpec'

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


const PAGE_SIZE = 20

export function DecoyItemsSection(): React.ReactElement {
  const openingFilterSpec = useOpeningFilterSpec('opening')

  const columns = useMemo<ColumnDef<DecoyItem>[]>(() => [
    col({
      id: 'position',
      header: 'Position',
      meta: { icon: DATA_ICONS.positional },
      enableSorting: false,
      cell: ({ row }) => {
        const { moveNumber, fen } = row.original
        const sideToMove = fen.split(' ')[1] === 'w' ? 'White' : 'Black'
        return (
          <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
            Move {moveNumber} · <span className="text-foreground">{sideToMove}</span>
          </span>
        )
      },
    }),
    col({
      id: 'white',
      header: 'White',
      meta: { icon: DATA_ICONS.user },
      enableSorting: false,
      cell: ({ row }) => {
        const g = row.original.game
        if (!g) return <span className="text-xs text-muted-foreground">—</span>
        return <PlayerCell name={g.white} title={g.whiteTitle} elo={g.whiteElo} />
      },
    }),
    col({
      id: 'black',
      header: 'Black',
      meta: { icon: DATA_ICONS.user },
      enableSorting: false,
      cell: ({ row }) => {
        const g = row.original.game
        if (!g) return <span className="text-xs text-muted-foreground">—</span>
        return <PlayerCell name={g.black} title={g.blackTitle} elo={g.blackElo} />
      },
    }),
    col({
      id: 'opening',
      header: 'Opening',
      meta: { icon: Compass },
      enableSorting: false,
      cell: ({ row }) => {
        const o = row.original.opening
        if (!o) return <span className="text-xs text-muted-foreground">—</span>
        const label =
          o.displayName.length > OPENING_MAX_CHARS
            ? o.displayName.slice(0, OPENING_MAX_CHARS - 1) + '…'
            : o.displayName
        return <span className="text-xs text-muted-foreground">{label}</span>
      },
    }),
    actionCol({
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
    }),
  ], [])

  const fetchData = React.useCallback(async (params: FetchParams) => {
    const res = await api.sources.decoys.items(params)
    return { items: res.puzzles, total: res.total }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold">Example puzzles</p>
      <ServerDataTable
        tableId="decoy"
        columns={columns}
        pageSize={PAGE_SIZE}
        filters={[openingFilterSpec]}
        fetchData={fetchData}
        initialSorting={[]}
        emptyMessage="No puzzles match these filters."
      />
    </div>
  )
}
