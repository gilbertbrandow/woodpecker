import * as React from 'react'
import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable'
import { UserAvatar } from '../UserAvatar'
import { formatSolveTimeMs } from '../../lib/utils'
import type { WeeklyLeaderboardRow } from '../../lib/api'
import { PositionBadge, getGlobalPosition } from './PositionBadge'

type Props = {
  rows: WeeklyLeaderboardRow[]
  currentUserDisplayName?: string
  loading?: boolean
}


export function WeeklyLeaderboard({ rows, currentUserDisplayName, loading = false }: Props): React.ReactElement {
  const columns = useMemo<ColumnDef<WeeklyLeaderboardRow>[]>(
    () => [
      {
        id: 'position',
        enableSorting: false,
        header: '',
        cell: ({ row, table }) => (
          <PositionBadge position={getGlobalPosition(row, table)} />
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
