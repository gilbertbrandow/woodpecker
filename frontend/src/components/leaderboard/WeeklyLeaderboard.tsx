import * as React from 'react'
import { useMemo } from 'react'
import { type ColumnDef, type Table } from '@tanstack/react-table'
import { DataTable } from '../DataTable'
import { UserAvatar } from '../UserAvatar'
import { formatSolveTimeMs } from '../../lib/utils'
import type { WeeklyLeaderboardRow } from '../../lib/api'

type Props = {
  rows: WeeklyLeaderboardRow[]
  currentUserDisplayName?: string
  loading?: boolean
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

function getGlobalPosition(row: { id: string }, table: Table<WeeklyLeaderboardRow>): number {
  return table.getSortedRowModel().rows.findIndex((r) => r.id === row.id) + 1
}

export function WeeklyLeaderboard({ rows, currentUserDisplayName, loading = false }: Props): React.ReactElement {
  const columns = useMemo<ColumnDef<WeeklyLeaderboardRow>[]>(
    () => [
      {
        id: 'position',
        enableSorting: false,
        header: '',
        cell: ({ row, table }) => (
          <PositionBadge position={getGlobalPosition(row, table as Table<WeeklyLeaderboardRow>)} />
        ),
      },
      {
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
      },
      {
        id: 'puzzlesSolved',
        accessorFn: (r) => r.puzzlesSolved,
        header: 'Puzzles solved',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">{row.original.puzzlesSolved}</span>
        ),
      },
      {
        id: 'avgRating',
        accessorFn: (r) => r.avgRating ?? -1,
        header: 'Avg rating',
        enableSorting: true,
        cell: ({ row }) =>
          row.original.avgRating !== null ? (
            <span className="tabular-nums">{Math.round(row.original.avgRating)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'avgAccuracyPct',
        accessorFn: (r) => r.avgAccuracyPct ?? -1,
        header: 'Accuracy',
        enableSorting: true,
        cell: ({ row }) =>
          row.original.avgAccuracyPct !== null ? (
            <span className="tabular-nums">{row.original.avgAccuracyPct.toFixed(1)}%</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'avgSolveTimeMs',
        accessorFn: (r) => r.avgSolveTimeMs ?? Infinity,
        header: 'Avg solve time',
        enableSorting: true,
        cell: ({ row }) =>
          row.original.avgSolveTimeMs !== null ? (
            <span className="tabular-nums">{formatSolveTimeMs(row.original.avgSolveTimeMs)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [currentUserDisplayName],
  )

  return (
    <DataTable
      columns={columns}
      data={rows}
      hideSearch
      pageSize={20}
      initialSorting={[{ id: 'puzzlesSolved', desc: true }]}
      loading={loading}
      getRowClassName={(r) =>
        currentUserDisplayName === r.displayName ? 'bg-muted/50' : ''
      }
      emptyMessage="No activity in the last 7 days."
    />
  )
}
