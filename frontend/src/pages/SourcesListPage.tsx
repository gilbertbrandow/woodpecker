import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Database } from 'lucide-react'
import { useAuth } from '../context/auth'
import { TrainingItemTypeBadge } from '../components/TrainingItemTypeBadge'
import { ConceptIcon } from '../components/ConceptIcon'
import { WhatIsThisDrawer } from '../components/WhatIsThisDrawer'
import { DataTable } from '../components/DataTable'
import { type ColumnDef } from '@tanstack/react-table'
import { type SourceListItem, api } from '../lib/api'
import { DATA_ICONS } from '../lib/icons'
import { formatDate } from '../lib/utils'

const SOURCE_ROUTES: Record<string, string> = {
  LICHESS_TACTIC: '/app/sources/lichess-tactics',
  SCRAPED_POSITIONAL: '/app/sources/scraped-positional-puzzles',
  DECOY: '/app/sources/decoys',
}

const columns: ColumnDef<SourceListItem>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    meta: { icon: DATA_ICONS.name },
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'sourceType',
    header: 'Type',
    meta: { icon: DATA_ICONS.type },
    enableSorting: false,
    cell: ({ row }) => <TrainingItemTypeBadge source={row.original.sourceType} />,
  },
  {
    accessorKey: 'puzzleCount',
    header: 'Puzzles',
    meta: { icon: DATA_ICONS.puzzles },
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {row.original.puzzleCount.toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: 'firstImported',
    header: 'First imported',
    meta: { icon: DATA_ICONS.started },
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.firstImported ? formatDate(row.original.firstImported) : '—'}
      </span>
    ),
  },
  {
    accessorKey: 'lastSynced',
    header: 'Last synced',
    meta: { icon: DATA_ICONS.lastAttempt },
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.lastSynced ? formatDate(row.original.lastSynced) : '—'}
      </span>
    ),
  },
]

export function SourcesListPage(): React.ReactElement | null {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sources, setSources] = React.useState<SourceListItem[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    api.sources.list()
      .then(({ sources: items }) => setSources(items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (!user) return null

  return (
    <PageWrapper className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 text-base font-semibold">
        <ConceptIcon concept="Source" />Sources
      </h1>

      <WhatIsThisDrawer
        triggerLabel="What is a Source?"
        title={<><Database className="h-4 w-4" />Source</>}
        description="A named external puzzle database and the origin of all puzzles that can be included in a Subset. Each source defines its own solving conditions — what constitutes a correct solution is source-specific, not universal."
      />

      <DataTable
        columns={columns}
        data={sources}
        loading={loading}
        hideSearch
        pageSize={25}
        tableId={false}
        onRowClick={(row) => void navigate({ to: SOURCE_ROUTES[row.sourceType] as any })}
      />
    </PageWrapper>
  )
}
