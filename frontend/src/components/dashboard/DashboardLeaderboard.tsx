import * as React from 'react'
import { useRef, useMemo, useCallback } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useAuth } from '../../context/auth'
import { ServerDataTable, type FetchParams } from '../ServerDataTable'
import { col, actionCol } from '../DataTable'
import { api, type LeaderboardRun } from '../../lib/api'
import { DATA_ICONS } from '../../lib/icons'
import { UserAvatar } from '../UserAvatar'
import { formatSolveTimeMs } from '../../lib/utils'
import { PositionBadge, getGlobalPosition } from '../leaderboard/PositionBadge'

const PAGE_SIZE = 10

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

type Props = {
  trainingId: number
  runIndex: number
  initialRows?: LeaderboardRun[]
}

export function DashboardLeaderboard({ trainingId, runIndex, initialRows }: Props): React.ReactElement {
  const { user } = useAuth()
  const pageRef = useRef({ page: 1, pageSize: PAGE_SIZE })

  const columns = useMemo<ColumnDef<LeaderboardRun>[]>(
    () => [
      actionCol({
        id: 'position',
        enableSorting: false,
        header: '',
        meta: { className: 'w-12' },
        cell: ({ row, table }) => {
          const { page, pageSize } = pageRef.current
          return <PositionBadge position={(page - 1) * pageSize + getGlobalPosition(row, table)} />
        },
      }),
      col({
        id: 'user',
        accessorFn: (r) => r.displayName,
        header: 'User',
        meta: { icon: DATA_ICONS.user },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <UserAvatar displayName={row.original.displayName} avatarUrl={row.original.avatarUrl} />
            <span className="font-medium">{row.original.displayName}</span>
            {user?.id === row.original.userId && (
              <span className="text-xs text-muted-foreground font-normal">you</span>
            )}
          </span>
        ),
      }),
      col({
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
      }),
      col({
        id: 'deltaAccuracyPct',
        accessorFn: (r) => r.deltaAccuracyPct ?? -Infinity,
        header: 'Δ accuracy',
        meta: { icon: DATA_ICONS.delta },
        enableSorting: true,
        cell: ({ row }) => formatDelta(row.original.deltaAccuracyPct),
      }),
      col({
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
      }),
      col({
        id: 'avgSolveTimeMs',
        accessorFn: (r) => r.avgSolveTimeMs ?? Infinity,
        header: 'Avg time',
        meta: { rankDesc: false, icon: DATA_ICONS.time },
        enableSorting: true,
        cell: ({ row }) =>
          row.original.avgSolveTimeMs !== null ? (
            <span className="tabular-nums">{formatSolveTimeMs(row.original.avgSolveTimeMs)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
    ],
    [user?.id], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const initialData = useMemo(
    () => (initialRows ? { items: initialRows, total: initialRows.length } : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const fetchData = useCallback(
    async (params: FetchParams): Promise<{ items: LeaderboardRun[]; total: number }> => {
      pageRef.current = { page: params.page, pageSize: params.pageSize }
      return api.leaderboard.listRunsByTraining(trainingId, runIndex, params)
    },
    [trainingId, runIndex],
  )

  return (
    <ServerDataTable
      columns={columns}
      fetchData={fetchData}
      initialData={initialData}
      pageSize={PAGE_SIZE}
      initialSorting={[{ id: 'accuracyPct', desc: true }]}
      getRowClassName={(r) => (user?.id === r.userId ? 'bg-muted/50' : '')}
      emptyMessage="No runs yet."
      compact
    />
  )
}
