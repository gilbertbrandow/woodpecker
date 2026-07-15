import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Database, Zap, Compass } from 'lucide-react'
import { useAuth } from '../context/auth'
import { TrainingItemTypeBadge, ScarecrowIcon } from '../components/TrainingItemTypeBadge'
import { ConceptIcon } from '../components/ConceptIcon'
import { WhatIsThisDrawer } from '../components/WhatIsThisDrawer'
import { DataTable } from '../components/DataTable'
import { FilterChipBar } from '../components/FilterChipBar'
import { getHandler } from '../components/filters'
import type { FilterSpec, FilterValues, MultiVal, DateVal } from '../components/filters'
import { type ColumnDef } from '@tanstack/react-table'
import { type SourceListItem, api } from '../lib/api'
import { DATA_ICONS } from '../lib/icons'
import { formatDate, formatNumber } from '../lib/utils'
import { SOURCE_NAMES, SOURCE_ROUTES } from '../lib/sources'
import { useApiData } from '../hooks/useApiData'

const FILTER_SPECS: FilterSpec[] = [
  {
    type: 'multi',
    key: 'sourceType',
    label: 'Type',
    icon: DATA_ICONS.type,
    options: [
      { value: 'LICHESS_TACTIC',    label: 'Tactical',    icon: <Zap className="h-3.5 w-3.5 text-cyan-500" /> },
      { value: 'SCRAPED_POSITIONAL', label: 'Positional', icon: <Compass className="h-3.5 w-3.5 text-indigo-500" /> },
      { value: 'DECOY',             label: 'Decoy',       icon: <ScarecrowIcon className="h-3.5 w-3.5 text-amber-500" /> },
    ],
  },
  {
    type: 'date',
    key: 'firstImported',
    label: 'First imported',
    icon: DATA_ICONS.started,
    nullable: true,
  },
  {
    type: 'date',
    key: 'lastSynced',
    label: 'Last synced',
    icon: DATA_ICONS.lastAttempt,
    nullable: true,
  },
]

function makeDefaultFilterValues(): FilterValues {
  const result: FilterValues = {}
  for (const spec of FILTER_SPECS) {
    result[spec.key] = getHandler(spec).defaultValue(spec)
  }
  return result
}

function matchesDateFilter(dateStr: string | null, filter: DateVal | null): boolean {
  if (!filter) return true
  if (filter.op === 'set') return dateStr !== null
  if (filter.op === 'not_set') return dateStr === null
  if (!filter.from || !dateStr) return true
  const row = dateStr.slice(0, 10)
  const from = filter.from
  const to = filter.to
  switch (filter.op) {
    case 'after':       return row > from
    case 'before':      return row < from
    case 'between':     return row >= from && (!to || row <= to)
    case 'not_between': return !(row >= from && (!to || row <= to))
    default:            return true
  }
}

const columns: ColumnDef<SourceListItem>[] = [
  {
    id: 'name',
    header: 'Name',
    meta: { icon: DATA_ICONS.name },
    accessorFn: (row) => SOURCE_NAMES[row.sourceType],
    cell: ({ row }) => <span className="font-medium">{SOURCE_NAMES[row.original.sourceType]}</span>,
  },
  {
    accessorKey: 'sourceType',
    header: 'Type',
    meta: { icon: DATA_ICONS.type },
    enableSorting: false,
    cell: ({ row }) => <TrainingItemTypeBadge source={row.original.sourceType} />,
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
  {
    accessorKey: 'puzzleCount',
    header: 'Puzzles',
    meta: { icon: DATA_ICONS.puzzles, className: 'text-right' },
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {formatNumber(row.original.puzzleCount)}
      </span>
    ),
  },
]

export function SourcesListPage(): React.ReactElement | null {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, loading } = useApiData(api.sources.list)
  const sources = data?.sources ?? []

  const [filterValues, setFilterValues] = useState<FilterValues>(makeDefaultFilterValues)

  const handleFilterChange = useCallback((key: string, value: unknown) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleClearFilters = useCallback(() => {
    setFilterValues(makeDefaultFilterValues())
  }, [])

  const hasActiveFilters = useMemo(
    () => FILTER_SPECS.some((spec) => {
      const handler = getHandler(spec)
      return !handler.isEmpty(filterValues[spec.key] ?? handler.defaultValue(spec))
    }),
    [filterValues],
  )

  const filteredSources = useMemo(() => {
    const typeFilter = filterValues.sourceType as MultiVal | undefined
    const firstImportedFilter = filterValues.firstImported as DateVal | null
    const lastSyncedFilter = filterValues.lastSynced as DateVal | null

    return sources.filter((row) => {
      if (typeFilter && typeFilter.values.length > 0) {
        const inList = typeFilter.values.includes(row.sourceType)
        if (typeFilter.op === 'is' && !inList) return false
        if (typeFilter.op === 'is_not' && inList) return false
      }
      if (!matchesDateFilter(row.firstImported, firstImportedFilter)) return false
      if (!matchesDateFilter(row.lastSynced, lastSyncedFilter)) return false
      return true
    })
  }, [sources, filterValues])

  const filtersSlot = (
    <FilterChipBar
      specs={FILTER_SPECS}
      values={filterValues}
      onChange={handleFilterChange}
      onClear={handleClearFilters}
      hasActiveFilters={hasActiveFilters}
    />
  )

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
        data={filteredSources}
        loading={loading}
        pageSize={20}
        tableId="sources"
        filtersSlot={filtersSlot}
        onRowClick={(row) => void navigate({ to: SOURCE_ROUTES[row.sourceType] as any })}
      />
    </PageWrapper>
  )
}
