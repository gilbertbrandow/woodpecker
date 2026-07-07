import * as React from 'react'
import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable'
import { UserAvatar } from '../UserAvatar'
import { formatSolveTimeMs } from '../../lib/utils'
import type { WeeklyLeaderboardRow } from '../../lib/api'
import { PositionBadge, getGlobalPosition } from './PositionBadge'
import { ScarecrowIcon } from '../TrainingItemTypeBadge'
import { DATA_ICONS } from '../../lib/icons'

type Props = {
  rows: WeeklyLeaderboardRow[]
  currentUserId?: number
  loading?: boolean
  tableId?: string
  filtersSlot?: React.ReactNode
}

export function WeeklyLeaderboard({ rows, currentUserId, loading = false, tableId, filtersSlot }: Props): React.ReactElement {
  const columns = useMemo<ColumnDef<WeeklyLeaderboardRow>[]>(
    () => [
      {
        id: 'position',
        enableSorting: false,
        header: '',
        meta: { className: 'w-12' },
        cell: ({ row, table }) => (
          <PositionBadge position={getGlobalPosition(row, table)} />
        ),
      },
      {
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
      },
      {
        id: 'puzzlesAttempted',
        accessorFn: (r) => r.puzzlesAttempted,
        header: 'Puzzles',
        meta: { icon: DATA_ICONS.puzzles },
        enableSorting: true,
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">{row.original.puzzlesAttempted}</span>
        ),
      },
      {
        id: 'lichessTacticPct',
        accessorFn: (r) => r.lichessTacticPct ?? -1,
        header: 'Tactical',
        meta: { icon: DATA_ICONS.tactical },
        enableSorting: true,
        cell: ({ row }) =>
          row.original.lichessTacticPct !== null ? (
            <span className="tabular-nums">{Math.round(row.original.lichessTacticPct)}%</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'scrapedPositionalPct',
        accessorFn: (r) => r.scrapedPositionalPct ?? -1,
        header: 'Positional',
        meta: { icon: DATA_ICONS.positional },
        enableSorting: true,
        cell: ({ row }) =>
          row.original.scrapedPositionalPct !== null ? (
            <span className="tabular-nums">{Math.round(row.original.scrapedPositionalPct)}%</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'decoyPct',
        accessorFn: (r) => r.decoyPct ?? -1,
        header: 'Decoy',
        meta: { icon: ScarecrowIcon },
        enableSorting: true,
        cell: ({ row }) =>
          row.original.decoyPct !== null ? (
            <span className="tabular-nums">{Math.round(row.original.decoyPct)}%</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
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
      },
      {
        id: 'avgAccuracyPct',
        accessorFn: (r) => r.avgAccuracyPct ?? -1,
        header: 'Accuracy',
        meta: { icon: DATA_ICONS.accuracy },
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
        meta: { rankDesc: false, icon: DATA_ICONS.time },
        enableSorting: true,
        cell: ({ row }) =>
          row.original.avgSolveTimeMs !== null ? (
            <span className="tabular-nums">{formatSolveTimeMs(row.original.avgSolveTimeMs)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [currentUserId],
  )

  return (
    <DataTable
      tableId={tableId}
      columns={columns}
      data={rows}
      hideSearch
      filtersSlot={filtersSlot}
      pageSize={20}
      initialSorting={[{ id: 'puzzlesAttempted', desc: true }]}
      loading={loading}
      getRowClassName={(r) =>
        currentUserId === r.userId ? 'bg-muted/50' : ''
      }
      emptyMessage="No activity in the last 7 days."
    />
  )
}
