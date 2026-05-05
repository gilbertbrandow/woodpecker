import * as React from 'react'
import { useMemo } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable, type FilterableColumn } from '../DataTable'
import { UserAvatar } from '../UserAvatar'
import { StatusBadge } from '../StatusBadge'
import { formatNumber, formatSolveTimeMs } from '../../lib/utils'
import type { LeaderboardRun, RunStatus, TrainingStatus } from '../../lib/api'

type LeaderboardTableProps = {
  runs: LeaderboardRun[]
  hideSchedule?: boolean
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function runStatusToTrainingStatus(status: RunStatus): TrainingStatus {
  if (status === 'active') return 'in_progress'
  if (status === 'completed') return 'completed'
  return 'aborted'
}

export function LeaderboardTable({ runs, hideSchedule = false }: LeaderboardTableProps): React.ReactElement {
  const navigate = useNavigate()

  const scheduleOptions = useMemo(
    () =>
      Array.from(new Map(runs.map((r) => [r.scheduleId, r.scheduleName])).entries()).map(
        ([id, name]) => ({ label: name, value: String(id) }),
      ),
    [runs],
  )

  const runNumberOptions = useMemo(
    () =>
      Array.from(new Set(runs.map((r) => r.runIndex + 1)))
        .sort((a, b) => a - b)
        .map((n) => ({ label: `Run ${n}`, value: String(n) })),
    [runs],
  )

  const filterableColumns: FilterableColumn[] = [
    ...(!hideSchedule ? [{ id: 'schedule', label: 'schedules', options: scheduleOptions }] : []),
    { id: 'runNumber', label: 'runs', options: runNumberOptions },
  ]

  const scheduleColumn: ColumnDef<LeaderboardRun> = {
    id: 'schedule',
    accessorFn: (row) => String(row.scheduleId),
    header: 'Schedule',
    enableSorting: false,
    filterFn: 'equals',
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

  const columns: ColumnDef<LeaderboardRun>[] = [
    {
      id: 'user',
      accessorFn: (row) => row.nickname ?? row.username,
      header: 'User',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <UserAvatar username={row.original.username} avatarUrl={row.original.avatarUrl} />
          <span className="font-medium">{row.original.nickname ?? row.original.username}</span>
        </span>
      ),
    },
    ...(!hideSchedule ? [scheduleColumn] : []),
    {
      id: 'runNumber',
      accessorFn: (row) => String(row.runIndex + 1),
      header: 'Run',
      enableSorting: false,
      filterFn: 'equals',
      cell: ({ row }) => (
        <span className="tabular-nums">#{row.original.runIndex + 1}</span>
      ),
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => (
        <StatusBadge status={runStatusToTrainingStatus(row.original.status)} />
      ),
    },
    {
      id: 'startedAt',
      accessorFn: (row) => new Date(row.startedAt).getTime(),
      header: 'Started',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.startedAt)}</span>
      ),
    },
    {
      id: 'accuracyPct',
      accessorFn: (row) => row.accuracyPct ?? -1,
      header: 'Accuracy',
      enableSorting: true,
      cell: ({ row }) =>
        row.original.accuracyPct !== null ? (
          <span className="tabular-nums">{formatNumber(Math.round(row.original.accuracyPct * 10) / 10)}%</span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        ),
    },
    {
      id: 'avgSolveTimeMs',
      accessorFn: (row) => row.avgSolveTimeMs ?? Infinity,
      header: 'Avg solve time',
      enableSorting: true,
      cell: ({ row }) =>
        row.original.avgSolveTimeMs !== null ? (
          <span className="tabular-nums">{formatSolveTimeMs(row.original.avgSolveTimeMs)}</span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        ),
    },
    {
      id: 'resolvedCount',
      accessorFn: (row) => row.resolvedCount,
      header: 'Attempts completed',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatNumber(row.original.resolvedCount)} / {formatNumber(row.original.totalPuzzles)}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={runs}
      globalFilterPlaceholder="Search leaderboard…"
      filterableColumns={filterableColumns}
      pageSize={20}
      initialSorting={[{ id: 'startedAt', desc: true }]}
      onRowClick={(r) =>
        void navigate({
          to: '/app/training/$trainingId',
          params: { trainingId: String(r.trainingId) },
        })
      }
      emptyMessage="No runs match your filters."
    />
  )
}
