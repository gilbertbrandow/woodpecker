import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { api, type DashboardLeaderboardRow } from '../../lib/api'
import { DataTable } from '../DataTable'
import { UserAvatar } from '../UserAvatar'
import { StatusBadge } from '../StatusBadge'
import { formatSolveTimeMs } from '../../lib/utils'
import { useAuth } from '../../context/auth'

function formatAccuracyDelta(delta: number | null): React.ReactElement | null {
  if (delta === null) return null
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

function runStatusToTrainingStatus(status: DashboardLeaderboardRow['status']) {
  if (status === 'active') return 'in_progress' as const
  if (status === 'completed') return 'completed' as const
  return 'aborted' as const
}

type Props = {
  trainingId: number
  runIndex: number
}

export function DashboardLeaderboard({ trainingId, runIndex }: Props): React.ReactElement | null {
  const { user } = useAuth()
  const [rows, setRows] = useState<DashboardLeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    api.leaderboard
      .getRunLeaderboard(trainingId, runIndex)
      .then(setRows)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [trainingId, runIndex])

  const hasDelta = useMemo(() => rows.some((r) => r.deltaAccuracyPct !== null), [rows])

  const columns = useMemo<ColumnDef<DashboardLeaderboardRow>[]>(() => [
    {
      id: 'position',
      header: '#',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">{row.index + 1}</span>
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
          {user?.displayName === row.original.displayName && (
            <span className="text-xs text-muted-foreground font-normal">you</span>
          )}
        </span>
      ),
    },
    {
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
    },
    ...(hasDelta
      ? [{
          id: 'deltaAccuracyPct',
          accessorFn: (r: DashboardLeaderboardRow) => r.deltaAccuracyPct ?? -Infinity,
          header: 'Δ accuracy',
          enableSorting: true,
          cell: ({ row }: { row: { original: DashboardLeaderboardRow } }) =>
            formatAccuracyDelta(row.original.deltaAccuracyPct) ?? (
              <span className="text-muted-foreground">—</span>
            ),
        } as ColumnDef<DashboardLeaderboardRow>]
      : []),
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
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => (
        <StatusBadge status={runStatusToTrainingStatus(row.original.status)} />
      ),
    },
  ], [hasDelta, user])

  const emptyMessage = loading ? (
    <span className="flex items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading…
    </span>
  ) : error ? (
    <span className="text-muted-foreground">Failed to load leaderboard.</span>
  ) : (
    <span className="text-muted-foreground">No runs found.</span>
  )

  return (
    <div>
      <DataTable
        columns={columns}
        data={rows}
        hideSearch
        pageSize={5}
        initialSorting={[{ id: 'accuracyPct', desc: true }]}
        emptyMessage={emptyMessage}
        getRowClassName={(row) =>
          user?.displayName === row.displayName ? 'bg-muted/50' : ''
        }
      />
    </div>
  )
}
