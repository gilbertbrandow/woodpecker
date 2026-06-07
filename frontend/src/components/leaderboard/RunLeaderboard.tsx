import * as React from 'react'
import { useMemo } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { type ColumnDef, type Table } from '@tanstack/react-table'
import { DataTable, type FilterableColumn } from '../DataTable'
import { UserAvatar } from '../UserAvatar'
import { StatusBadge } from '../StatusBadge'
import { formatNumber, formatSolveTimeMs } from '../../lib/utils'
import type { LeaderboardRun, RunStatus, TrainingStatus } from '../../lib/api'

type Props = {
  rows: LeaderboardRun[]
  scheduleId?: number
  runIndex?: number
  allowFiltering?: boolean
  compact?: boolean
  currentUserDisplayName?: string
  loading?: boolean
}

function runStatusToTrainingStatus(status: RunStatus): TrainingStatus {
  if (status === 'active') return 'in_progress'
  if (status === 'completed') return 'completed'
  return 'aborted'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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

function PositionBadge({ position }: { position: number }): React.ReactElement {
  if (position === 1) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold dark:bg-yellow-900/40 dark:text-yellow-400">
        1
      </span>
    )
  }
  if (position === 2) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-600 text-xs font-bold dark:bg-slate-800 dark:text-slate-300">
        2
      </span>
    )
  }
  if (position === 3) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-xs font-bold dark:bg-orange-900/40 dark:text-orange-400">
        3
      </span>
    )
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center tabular-nums text-sm text-muted-foreground">
      {position}
    </span>
  )
}

function getGlobalPosition(row: { id: string }, table: Table<LeaderboardRun>): number {
  return table.getSortedRowModel().rows.findIndex((r) => r.id === row.id) + 1
}

export function RunLeaderboard({
  rows,
  scheduleId,
  runIndex,
  allowFiltering = false,
  compact = false,
  currentUserDisplayName,
  loading = false,
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

  const filterableColumns = useMemo<FilterableColumn[]>(() => {
    if (!allowFiltering) return []
    const result: FilterableColumn[] = []
    if (scheduleId === undefined) {
      result.push({ id: 'schedule', label: 'schedules', options: scheduleOptions })
    }
    if (runIndex === undefined) {
      result.push({ id: 'runNumber', label: 'runs', options: runNumberOptions })
    }
    return result
  }, [allowFiltering, scheduleId, runIndex, scheduleOptions, runNumberOptions])

  const columns = useMemo<ColumnDef<LeaderboardRun>[]>(() => {
    const positionColumn: ColumnDef<LeaderboardRun> = {
      id: 'position',
      enableSorting: false,
      header: '',
      cell: ({ row, table }) => (
        <PositionBadge position={getGlobalPosition(row, table as Table<LeaderboardRun>)} />
      ),
    }

    const userColumn: ColumnDef<LeaderboardRun> = {
      id: 'user',
      accessorFn: (r) => r.displayName,
      header: 'User',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <UserAvatar displayName={row.original.displayName} avatarUrl={row.original.avatarUrl} />
          <span className="font-medium">{row.original.displayName}</span>
          {currentUserDisplayName === row.original.displayName && (
            <span className="text-xs text-muted-foreground font-normal">you</span>
          )}
        </span>
      ),
    }

    const scheduleColumn: ColumnDef<LeaderboardRun> = {
      id: 'schedule',
      accessorFn: (r) => String(r.scheduleId),
      header: 'Schedule',
      enableSorting: false,
      filterFn: (row, id, val: string[]) => !val.length || val.includes(row.getValue(id) as string),
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
      enableSorting: false,
      filterFn: (row, id, val: string[]) => !val.length || val.includes(row.getValue(id) as string),
      cell: ({ row }) => (
        <span className="tabular-nums">#{row.original.runIndex + 1}</span>
      ),
    }

    const accuracyColumn: ColumnDef<LeaderboardRun> = {
      id: 'accuracyPct',
      accessorFn: (r) => r.accuracyPct ?? -1,
      header: 'Accuracy',
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
      enableSorting: true,
      cell: ({ row }) => formatDelta(row.original.deltaAccuracyPct),
    }

    const avgSolveTimeColumn: ColumnDef<LeaderboardRun> = {
      id: 'avgSolveTimeMs',
      accessorFn: (r) => r.avgSolveTimeMs ?? Infinity,
      header: 'Avg time',
      enableSorting: true,
      cell: ({ row }) =>
        row.original.avgSolveTimeMs !== null ? (
          <span className="tabular-nums">{formatSolveTimeMs(row.original.avgSolveTimeMs)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    }

    if (compact) {
      return [positionColumn, userColumn, accuracyColumn, deltaColumn, avgSolveTimeColumn]
    }

    const statusColumn: ColumnDef<LeaderboardRun> = {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => (
        <StatusBadge status={runStatusToTrainingStatus(row.original.status)} />
      ),
    }

    const startedColumn: ColumnDef<LeaderboardRun> = {
      id: 'startedAt',
      accessorFn: (r) => new Date(r.startedAt).getTime(),
      header: 'Started',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.startedAt)}</span>
      ),
    }

    const avgTimeSolvedColumn: ColumnDef<LeaderboardRun> = {
      id: 'avgTimeSolvedMs',
      accessorFn: (r) => r.avgTimeSolvedMs ?? Infinity,
      header: 'Avg time (solved)',
      enableSorting: true,
      cell: ({ row }) =>
        row.original.avgTimeSolvedMs !== null ? (
          <span className="tabular-nums">{formatSolveTimeMs(row.original.avgTimeSolvedMs)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    }

    const avgTimeFailedColumn: ColumnDef<LeaderboardRun> = {
      id: 'avgTimeFailedMs',
      accessorFn: (r) => r.avgTimeFailedMs ?? Infinity,
      header: 'Avg time (failed)',
      enableSorting: true,
      cell: ({ row }) =>
        row.original.avgTimeFailedMs !== null ? (
          <span className="tabular-nums">{formatSolveTimeMs(row.original.avgTimeFailedMs)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    }

    const resolvedColumn: ColumnDef<LeaderboardRun> = {
      id: 'resolvedCount',
      accessorFn: (r) => r.resolvedCount,
      header: 'Attempts completed',
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
      avgSolveTimeColumn,
      avgTimeSolvedColumn,
      avgTimeFailedColumn,
      resolvedColumn,
    ]
  }, [scheduleId, runIndex, compact, currentUserDisplayName])

  return (
    <DataTable
      columns={columns}
      data={rows}
      globalFilterPlaceholder="Search leaderboard…"
      filterableColumns={filterableColumns}
      hideSearch={compact}
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
        currentUserDisplayName === r.displayName ? 'bg-muted/50' : ''
      }
      emptyMessage="No runs match your filters."
    />
  )
}
