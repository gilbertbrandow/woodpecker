import * as React from 'react'
import { useCallback, useMemo, useRef } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { Activity, CheckCircle2, XCircle } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { PageWrapper } from '../components/PageWrapper'
import { useAuth } from '../context/auth'
import { ServerDataTable } from '../components/ServerDataTable'
import type { FetchParams, FilterSpec, MultiFilterSpec, RangeFilterSpec, DateFilterSpec } from '../components/ServerDataTable'
import { useUserFilterSpec } from '../hooks/useUserFilterSpec'
import { useScheduleFilterSpec } from '../hooks/useScheduleFilterSpec'
import { useScheduleSetFilterSpec } from '../hooks/useScheduleSetFilterSpec'
import { DATA_ICONS, CONCEPT_ICONS } from '../lib/icons'
import { UserAvatar } from '../components/UserAvatar'
import { StatusBadge, runStatusToStatusValue } from '../components/StatusBadge'
import { formatDate, formatNumber, formatSolveTimeMs } from '../lib/utils'
import { ScarecrowIcon } from '../components/TrainingItemTypeBadge'
import { PositionBadge, getGlobalPosition } from '../components/leaderboard/PositionBadge'
import { api } from '../lib/api'
import type { LeaderboardRun, WeeklyLeaderboardRow } from '../lib/api'

const PAGE_SIZE = 50

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

const WEEKLY_PUZZLES_FILTER: RangeFilterSpec = {
  type: 'range',
  key: 'puzzles',
  label: 'Puzzles',
  min: 0,
  max: 1000,
  step: 10,
  icon: DATA_ICONS.puzzles,
}

const WEEKLY_AVG_RATING_FILTER: RangeFilterSpec = {
  type: 'range',
  key: 'avgRating',
  label: 'Avg rating',
  min: 1000,
  max: 3000,
  step: 50,
  icon: DATA_ICONS.rating,
}

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

export function LeaderboardPage(): React.ReactElement | null {
  const { user } = useAuth()
  const navigate = useNavigate()

  const userFilterSpec = useUserFilterSpec('userId')
  const scheduleFilterSpec = useScheduleFilterSpec('scheduleId')
  const scheduleSetFilterSpec = useScheduleSetFilterSpec('scheduleIds')

  // Page refs for computing global position badge offsets in server-paginated mode.
  // ServerDataTable sets pageIndex=0 in the tanstack table, so getGlobalPosition()
  // returns a 1-based local index. We add the server-page offset to get global rank.
  const runPageRef = useRef({ page: 1, pageSize: PAGE_SIZE })
  const weeklyPageRef = useRef({ page: 1, pageSize: PAGE_SIZE })

  const runFilters = useMemo<FilterSpec[]>(
    () => [{ type: 'search', key: 'q' }, userFilterSpec, RUN_STATUS_FILTER, scheduleFilterSpec, RUN_STARTED_FILTER, RUN_AVG_RATING_FILTER, RUN_RESOLVED_FILTER],
    [userFilterSpec, scheduleFilterSpec],
  )

  const weeklyFilters = useMemo<FilterSpec[]>(
    () => [{ type: 'search', key: 'q' }, userFilterSpec, WEEKLY_PUZZLES_FILTER, WEEKLY_AVG_RATING_FILTER, scheduleSetFilterSpec],
    [userFilterSpec, scheduleSetFilterSpec],
  )

  const fetchRunData = useCallback((params: FetchParams) => {
    runPageRef.current = { page: params.page, pageSize: params.pageSize }
    return api.leaderboard.listRuns(params)
  }, [])

  const fetchWeeklyData = useCallback((params: FetchParams) => {
    weeklyPageRef.current = { page: params.page, pageSize: params.pageSize }
    return api.leaderboard.listWeekly(params)
  }, [])

  const runColumns = useMemo<ColumnDef<LeaderboardRun>[]>(() => [
    {
      id: 'position',
      enableSorting: false,
      header: '',
      meta: { className: 'w-12' },
      cell: ({ row, table }) => {
        const { page, pageSize } = runPageRef.current
        return <PositionBadge position={(page - 1) * pageSize + getGlobalPosition(row, table)} />
      },
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
          {user?.id === row.original.userId && (
            <span className="text-xs text-muted-foreground font-normal">you</span>
          )}
        </span>
      ),
    },
    {
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
    },
    {
      id: 'runNumber',
      accessorFn: (r) => String(r.runIndex + 1),
      header: 'Run',
      meta: { icon: CONCEPT_ICONS.Run },
      enableSorting: false,
      cell: ({ row }) => (
        <span className="tabular-nums">#{row.original.runIndex + 1}</span>
      ),
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      meta: { icon: DATA_ICONS.status },
      enableSorting: false,
      cell: ({ row }) => (
        <StatusBadge status={runStatusToStatusValue(row.original.status)} />
      ),
    },
    {
      id: 'startedAt',
      accessorFn: (r) => new Date(r.startedAt).getTime(),
      header: 'Started',
      meta: { icon: DATA_ICONS.started },
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.startedAt)}</span>
      ),
    },
    {
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
    },
    {
      id: 'deltaAccuracyPct',
      accessorFn: (r) => r.deltaAccuracyPct ?? -Infinity,
      header: 'Δ accuracy',
      meta: { icon: DATA_ICONS.delta },
      enableSorting: true,
      cell: ({ row }) => formatDelta(row.original.deltaAccuracyPct),
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
    },
    {
      id: 'avgTimeSolvedMs',
      accessorFn: (r) => r.avgTimeSolvedMs ?? Infinity,
      header: 'Avg time (solved)',
      meta: { rankDesc: false, icon: DATA_ICONS.time },
      enableSorting: true,
      cell: ({ row }) =>
        row.original.avgTimeSolvedMs !== null ? (
          <span className="tabular-nums">{formatSolveTimeMs(row.original.avgTimeSolvedMs)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'avgTimeFailedMs',
      accessorFn: (r) => r.avgTimeFailedMs ?? Infinity,
      header: 'Avg time (failed)',
      meta: { rankDesc: false, icon: DATA_ICONS.time },
      enableSorting: true,
      cell: ({ row }) =>
        row.original.avgTimeFailedMs !== null ? (
          <span className="tabular-nums">{formatSolveTimeMs(row.original.avgTimeFailedMs)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
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
    },
  ], [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const weeklyColumns = useMemo<ColumnDef<WeeklyLeaderboardRow>[]>(() => [
    {
      id: 'position',
      enableSorting: false,
      header: '',
      meta: { className: 'w-12' },
      cell: ({ row, table }) => {
        const { page, pageSize } = weeklyPageRef.current
        return <PositionBadge position={(page - 1) * pageSize + getGlobalPosition(row, table)} />
      },
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
          {user?.id === row.original.userId && (
            <span className="text-xs text-muted-foreground font-normal">you</span>
          )}
        </span>
      ),
    },
    {
      id: 'schedules',
      header: 'Schedules',
      meta: { icon: CONCEPT_ICONS.Schedule, defaultHidden: true },
      enableSorting: false,
      cell: ({ row }) => {
        const names = row.original.scheduleNames
        if (names.length === 0) return <span className="text-muted-foreground">—</span>
        return (
          <span className="flex items-center gap-1">
            <span className="truncate max-w-32">{names[0]}</span>
            {names.length > 1 && (
              <span className="text-xs text-muted-foreground shrink-0">+{names.length - 1}</span>
            )}
          </span>
        )
      },
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
  ], [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null

  return (
    <PageWrapper className="flex flex-col gap-8">
      <h1 className="text-base font-semibold">Leaderboards</h1>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b pb-2.5">
          <span className="text-sm font-medium">Weekly board</span>
          <span className="hidden text-xs text-muted-foreground sm:block">
            One row per user, rolling 7 days
          </span>
        </div>
        <ServerDataTable
          tableId="weekly"
          columns={weeklyColumns}
          filters={weeklyFilters}
          pageSize={PAGE_SIZE}
          fetchData={fetchWeeklyData}
          initialSorting={[{ id: 'puzzlesAttempted', desc: true }]}
          getRowClassName={(r) => user.id === r.userId ? 'bg-muted/50' : ''}
          emptyMessage="No activity in the last 7 days."
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b pb-2.5">
          <span className="flex items-center gap-1.5 text-sm font-medium">Run board</span>
          <span className="hidden text-xs text-muted-foreground sm:block">
            One row per run
          </span>
        </div>
        <ServerDataTable
          tableId="run"
          columns={runColumns}
          filters={runFilters}
          pageSize={PAGE_SIZE}
          fetchData={fetchRunData}
          initialSorting={[{ id: 'accuracyPct', desc: true }]}
          onRowClick={(r) =>
            void navigate({
              to: '/app/training/$trainingId',
              params: { trainingId: String(r.trainingId) },
            })
          }
          getRowClassName={(r) => user.id === r.userId ? 'bg-muted/50' : ''}
          emptyMessage="No runs match your filters."
        />
      </section>
    </PageWrapper>
  )
}
