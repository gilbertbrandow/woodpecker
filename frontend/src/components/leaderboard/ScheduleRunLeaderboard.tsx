import * as React from 'react'
import { useRef, useMemo, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Activity, CheckCircle2, XCircle } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import {
  ServerDataTable,
  type FetchParams,
  type MultiFilterSpec,
  type RangeFilterSpec,
  type DateFilterSpec,
} from '../ServerDataTable'
import { col, actionCol } from '../DataTable'
import { api, type LeaderboardRun } from '../../lib/api'
import { DATA_ICONS, CONCEPT_ICONS } from '../../lib/icons'
import { UserAvatar } from '../UserAvatar'
import { StatusBadge, runStatusToStatusValue } from '../StatusBadge'
import { formatDate, formatNumber, formatSolveTimeMs } from '../../lib/utils'
import { PositionBadge, getGlobalPosition } from './PositionBadge'

const PAGE_SIZE = 20

const RUN_STATUS_FILTER: MultiFilterSpec = {
  type: 'multi',
  key: 'status',
  label: 'Status',
  icon: Activity,
  options: [
    { value: 'active',    label: 'Active',    icon: <Activity className="h-3.5 w-3.5 text-blue-500" /> },
    { value: 'completed', label: 'Completed', icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> },
    { value: 'aborted',   label: 'Aborted',   icon: <XCircle className="h-3.5 w-3.5 text-red-600" /> },
  ],
}

const RUN_STARTED_FILTER: DateFilterSpec = {
  type: 'date',
  key: 'startedAt',
  label: 'Started',
  icon: DATA_ICONS.started,
}

const RUN_AVG_RATING_FILTER: RangeFilterSpec = {
  type: 'range',
  key: 'avgRating',
  label: 'Avg rating',
  min: 1000,
  max: 3000,
  step: 50,
  icon: DATA_ICONS.rating,
}

const RUN_RESOLVED_FILTER: RangeFilterSpec = {
  type: 'range',
  key: 'resolvedCount',
  label: 'Attempts completed',
  min: 0,
  max: 1000,
  step: 10,
  icon: DATA_ICONS.attempts,
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

const FILTERS = [
  { type: 'search' as const, key: 'q' },
  RUN_STATUS_FILTER,
  RUN_STARTED_FILTER,
  RUN_AVG_RATING_FILTER,
  RUN_RESOLVED_FILTER,
]

type Props = {
  scheduleId: number
  currentUserId?: number
}

export function ScheduleRunLeaderboard({ scheduleId, currentUserId }: Props): React.ReactElement {
  const navigate = useNavigate()
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
            {currentUserId === row.original.userId && (
              <span className="text-xs text-muted-foreground font-normal">you</span>
            )}
          </span>
        ),
      }),
      col({
        id: 'runNumber',
        accessorFn: (r) => r.runIndex + 1,
        header: 'Run',
        meta: { icon: CONCEPT_ICONS.Run },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">#{row.original.runIndex + 1}</span>
        ),
      }),
      col({
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        meta: { icon: DATA_ICONS.status },
        enableSorting: false,
        cell: ({ row }) => (
          <StatusBadge status={runStatusToStatusValue(row.original.status)} />
        ),
      }),
      col({
        id: 'startedAt',
        accessorFn: (r) => new Date(r.startedAt).getTime(),
        header: 'Started',
        meta: { icon: DATA_ICONS.started },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatDate(row.original.startedAt)}</span>
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
      col({
        id: 'avgTimeSolvedMs',
        accessorFn: (r) => r.avgTimeSolvedMs ?? Infinity,
        header: 'Avg time (solved)',
        meta: { rankDesc: false, icon: DATA_ICONS.time, defaultHidden: true },
        enableSorting: true,
        cell: ({ row }) =>
          row.original.avgTimeSolvedMs !== null ? (
            <span className="tabular-nums">{formatSolveTimeMs(row.original.avgTimeSolvedMs)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
      col({
        id: 'avgTimeFailedMs',
        accessorFn: (r) => r.avgTimeFailedMs ?? Infinity,
        header: 'Avg time (failed)',
        meta: { rankDesc: false, icon: DATA_ICONS.time, defaultHidden: true },
        enableSorting: true,
        cell: ({ row }) =>
          row.original.avgTimeFailedMs !== null ? (
            <span className="tabular-nums">{formatSolveTimeMs(row.original.avgTimeFailedMs)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
      col({
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
      }),
    ],
    [currentUserId], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const fetchData = useCallback(
    async (params: FetchParams): Promise<{ items: LeaderboardRun[]; total: number }> => {
      pageRef.current = { page: params.page, pageSize: params.pageSize }
      return api.leaderboard.listRuns({
        ...params,
        filters: { ...params.filters, scheduleId: ['is', String(scheduleId)] },
      })
    },
    [scheduleId],
  )

  return (
    <ServerDataTable
      tableId="leaderboard"
      columns={columns}
      filters={FILTERS}
      fetchData={fetchData}
      pageSize={PAGE_SIZE}
      initialSorting={[{ id: 'accuracyPct', desc: true }]}
      onRowClick={(r) =>
        void navigate({
          to: '/app/training/$trainingId',
          params: { trainingId: String(r.trainingId) },
        })
      }
      getRowClassName={(r) => (currentUserId === r.userId ? 'bg-muted/50' : '')}
      emptyMessage="No runs found."
    />
  )
}
