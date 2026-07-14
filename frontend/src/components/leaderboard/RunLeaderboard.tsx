import * as React from 'react'
import { useState, useMemo } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable'
import { MultiSelectFilter } from '../ui/multi-select-filter'
import { DATA_ICONS, CONCEPT_ICONS } from '../../lib/icons'
import { UserAvatar } from '../UserAvatar'
import { StatusBadge, runStatusToStatusValue } from '../StatusBadge'
import { formatDate, formatNumber, formatSolveTimeMs } from '../../lib/utils'
import type { LeaderboardRun } from '../../lib/api'
import { PositionBadge, getGlobalPosition } from './PositionBadge'

type Props = {
  rows: LeaderboardRun[]
  scheduleId?: number
  runIndex?: number
  allowFiltering?: boolean
  compact?: boolean
  currentUserId?: number
  loading?: boolean
  tableId?: string
  filtersSlot?: React.ReactNode
}

function formatDelta(delta: number | null): React.ReactElement {
  if (delta === null) return <span className="text-muted-foreground">—</span>
  const sign = delta > 0 ? '+' : ''
  const color =
    delta > 0
      ? 'text-green-600 dark:text-green-400'
      : delta < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-muted-foreground'
  return (
    <span className={`tabular-nums text-xs ${color}`}>
      {sign}{delta.toFixed(1)}%
    </span>
  )
}

export function RunLeaderboard({
  rows,
  scheduleId,
  runIndex,
  allowFiltering = false,
  compact = false,
  currentUserId,
  loading = false,
  tableId,
  filtersSlot,
}: Props): React.ReactElement {
  const navigate = useNavigate()

  const scheduleOptions = useMemo(
    () =>
      Array.from(new Map(rows.map((r) => [r.scheduleId, r.scheduleName])).entries()).map(
        ([id, name]) => ({ label: name, value: String(id) }),
      ),
    [rows],
  )

  const runNumberOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.runIndex + 1)))
        .sort((a, b) => a - b)
        .map((n) => ({ label: `Run ${n}`, value: String(n) })),
    [rows],
  )

  const [selectedSchedules, setSelectedSchedules] = useState<string[]>([])
  const [selectedRuns, setSelectedRuns] = useState<string[]>([])

  const filteredRows = useMemo(() => {
    let r = rows
    if (selectedSchedules.length > 0) {
      r = r.filter((row) => selectedSchedules.includes(String(row.scheduleId)))
    }
    if (selectedRuns.length > 0) {
      r = r.filter((row) => selectedRuns.includes(String(row.runIndex + 1)))
    }
    return r
  }, [rows, selectedSchedules, selectedRuns])

  const columns = useMemo<ColumnDef<LeaderboardRun>[]>(() => {
    const positionColumn: ColumnDef<LeaderboardRun> = {
      id: 'position',
      enableSorting: false,
      header: '',
      meta: { className: 'w-12' },
      cell: ({ row, table }) => (
        <PositionBadge position={getGlobalPosition(row, table)} />
      ),
    }

    const userColumn: ColumnDef<LeaderboardRun> = {
      id: 'user',
      accessorFn: (r) => r.displayName,
      header: 'User',
      meta: { icon: DATA_ICONS.user },
      enableSorting: false,
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <UserAvatar displayName={row.original.displayName} avatarUrl={row.original.avatarUrl} />
          <span className="font-medium">{row.original.displayName}</span>
          {currentUserId === row.original.userId && (
            <span className="text-xs text-muted-foreground font-normal">you</span>
          )}
        </span>
      ),
    }

    const scheduleColumn: ColumnDef<LeaderboardRun> = {
      id: 'schedule',
      accessorFn: (r) => String(r.scheduleId),
      header: 'Schedule',
      meta: { icon: CONCEPT_ICONS.Schedule },
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          to="/app/schedules/$scheduleId"
          params={{ scheduleId: String(row.original.scheduleId) }}
          className="font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.scheduleName}
        </Link>
      ),
    }

    const runNumberColumn: ColumnDef<LeaderboardRun> = {
      id: 'runNumber',
      accessorFn: (r) => String(r.runIndex + 1),
      header: 'Run',
      meta: { icon: CONCEPT_ICONS.Run },
      enableSorting: false,
      cell: ({ row }) => (
        <span className="tabular-nums">#{row.original.runIndex + 1}</span>
      ),
    }

    const accuracyColumn: ColumnDef<LeaderboardRun> = {
      id: 'accuracyPct',
      accessorFn: (r) => r.accuracyPct ?? -1,
      header: 'Accuracy',
      meta: { icon: DATA_ICONS.accuracy },
      enableSorting: true,
      cell: ({ row }) =>
        row.original.accuracyPct !== null ? (
          <span className="tabular-nums">{row.original.accuracyPct.toFixed(1)}%</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    }

    const deltaColumn: ColumnDef<LeaderboardRun> = {
      id: 'deltaAccuracyPct',
      accessorFn: (r) => r.deltaAccuracyPct ?? -Infinity,
      header: 'Δ accuracy',
      meta: { icon: DATA_ICONS.delta },
      enableSorting: true,
      cell: ({ row }) => formatDelta(row.original.deltaAccuracyPct),
    }

    const avgRatingColumn: ColumnDef<LeaderboardRun> = {
      id: 'avgRating',
      accessorFn: (r) => r.avgRating ?? -1,
      header: 'Avg rating',
      meta: { icon: DATA_ICONS.rating },
      enableSorting: true,
      cell: ({ row }) =>
        row.original.avgRating !== null ? (
          <span className="tabular-nums">{Math.round(row.original.avgRating)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    }

    function makeTimeColumn(
      id: 'avgSolveTimeMs' | 'avgTimeSolvedMs' | 'avgTimeFailedMs',
      label: string,
    ): ColumnDef<LeaderboardRun> {
      return {
        id,
        accessorFn: (r) => r[id] ?? Infinity,
        header: label,
        meta: { rankDesc: false, icon: DATA_ICONS.time },
        enableSorting: true,
        cell: ({ row }) => {
          const v = row.original[id]
          return v !== null
            ? <span className="tabular-nums">{formatSolveTimeMs(v)}</span>
            : <span className="text-muted-foreground">—</span>
        },
      }
    }

    const avgSolveTimeColumn = makeTimeColumn('avgSolveTimeMs', 'Avg time')

    if (compact) {
      return [positionColumn, userColumn, accuracyColumn, deltaColumn, avgRatingColumn, avgSolveTimeColumn]
    }

    const statusColumn: ColumnDef<LeaderboardRun> = {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      meta: { icon: DATA_ICONS.status },
      enableSorting: false,
      cell: ({ row }) => (
        <StatusBadge status={runStatusToStatusValue(row.original.status)} />
      ),
    }

    const startedColumn: ColumnDef<LeaderboardRun> = {
      id: 'startedAt',
      accessorFn: (r) => new Date(r.startedAt).getTime(),
      header: 'Started',
      meta: { icon: DATA_ICONS.started },
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.startedAt)}</span>
      ),
    }

    const avgTimeSolvedColumn = makeTimeColumn('avgTimeSolvedMs', 'Avg time (solved)')
    const avgTimeFailedColumn = makeTimeColumn('avgTimeFailedMs', 'Avg time (failed)')

    const resolvedColumn: ColumnDef<LeaderboardRun> = {
      id: 'resolvedCount',
      accessorFn: (r) => r.resolvedCount,
      header: 'Attempts completed',
      meta: { icon: DATA_ICONS.attempts },
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatNumber(row.original.resolvedCount)} / {formatNumber(row.original.totalPuzzles)}
        </span>
      ),
    }

    return [
      positionColumn,
      userColumn,
      ...(scheduleId === undefined ? [scheduleColumn] : []),
      ...(runIndex === undefined ? [runNumberColumn] : []),
      statusColumn,
      startedColumn,
      accuracyColumn,
      deltaColumn,
      avgRatingColumn,
      avgSolveTimeColumn,
      avgTimeSolvedColumn,
      avgTimeFailedColumn,
      resolvedColumn,
    ]
  }, [scheduleId, runIndex, compact, currentUserId])

  const internalFiltersSlot = allowFiltering && (scheduleId === undefined || runIndex === undefined) ? (
    <>
      {scheduleId === undefined && (
        <MultiSelectFilter
          label="schedules"
          options={scheduleOptions}
          selected={selectedSchedules}
          onChange={setSelectedSchedules}
        />
      )}
      {runIndex === undefined && (
        <MultiSelectFilter
          label="runs"
          options={runNumberOptions}
          selected={selectedRuns}
          onChange={setSelectedRuns}
        />
      )}
    </>
  ) : undefined

  const combinedFiltersSlot = (internalFiltersSlot || filtersSlot) ? (
    <>
      {internalFiltersSlot}
      {filtersSlot}
    </>
  ) : undefined

  return (
    <DataTable
      tableId={tableId}
      columns={columns}
      data={filteredRows}
      filtersSlot={compact ? undefined : combinedFiltersSlot}
      hideSearch
      pageSize={compact ? 5 : 20}
      initialSorting={[{ id: 'accuracyPct', desc: true }]}
      loading={loading}
      onRowClick={
        compact
          ? undefined
          : (r) =>
              void navigate({
                to: '/app/training/$trainingId',
                params: { trainingId: String(r.trainingId) },
              })
      }
      getRowClassName={(r) =>
        currentUserId === r.userId ? 'bg-muted/50' : ''
      }
      emptyMessage="No runs match your filters."
    />
  )
}
