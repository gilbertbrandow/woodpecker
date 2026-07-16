import * as React from 'react'
import { Check, X, CircleOff, CheckCheck } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { formatSolveTimeMs } from '../../lib/utils'
import { api } from '../../lib/api'
import { UserAvatar } from '../../components/UserAvatar'
import { CONCEPT_ICONS, DATA_ICONS } from '../../lib/icons'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'
import { ServerDataTable, type FetchParams } from '../../components/ServerDataTable'
import { col } from '../../components/DataTable'
import { useUserFilterSpec } from '../../hooks/useUserFilterSpec'
import { UserSelector } from '../../components/UserSelector'
import type { SelectableUser } from '../../lib/api'

export type OverviewAttemptHistoryRow = {
  attemptId: number
  runId: number
  runLabel: string
  runOrder: number
  runTrainingItemId: number
  tryNumber: number
  countsTowardsTraining: boolean
  result: 'solved' | 'failed'
  timeSpentMs: number | null
  startedAt?: string | null
  userId?: number
  displayName?: string
  avatarUrl?: string | null
}

const PAGE_SIZE = 15

const RESULT_OPTIONS = [
  { label: 'Solved', value: 'solved', icon: <Check className="h-3.5 w-3.5 text-green-600" /> },
  { label: 'Failed', value: 'failed', icon: <X className="h-3.5 w-3.5 text-red-500" /> },
]

const columns: ColumnDef<OverviewAttemptHistoryRow>[] = [
  col({
    id: 'user',
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex"><DATA_ICONS.user className="h-3.5 w-3.5" /></span>
        </TooltipTrigger>
        <TooltipContent>User</TooltipContent>
      </Tooltip>
    ),
    meta: { className: 'px-2 py-1 text-xs', icon: DATA_ICONS.user },
    enableSorting: false,
    cell: ({ row }) => {
      const { displayName, avatarUrl } = row.original
      return displayName ? (
        <UserAvatar displayName={displayName} avatarUrl={avatarUrl ?? null} className="h-4 w-4" />
      ) : (
        <span className="inline-block h-4 w-4 rounded-full bg-muted" />
      )
    },
  }),
  col({
    id: 'runLabel',
    accessorKey: 'runOrder',
    header: 'Run',
    meta: { className: 'px-2 py-1', icon: CONCEPT_ICONS.Run },
    enableSorting: true,
    cell: ({ row }) => row.original.runLabel,
  }),
  col({
    accessorKey: 'tryNumber',
    header: 'Try',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.countsTowardsTraining ? (
        `#${row.original.tryNumber}`
      ) : (
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-default items-center text-muted-foreground/60">
              <CircleOff className="h-3 w-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent>This attempt did not count towards score.</TooltipContent>
        </Tooltip>
      ),
    meta: { className: 'px-2 py-1', icon: DATA_ICONS.tries },
  }),
  col({
    accessorKey: 'result',
    header: () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex"><CheckCheck className="h-3.5 w-3.5" /></span>
        </TooltipTrigger>
        <TooltipContent>Result</TooltipContent>
      </Tooltip>
    ),
    enableSorting: false,
    cell: ({ row }) =>
      row.original.result === 'solved' ? (
        <Check className="h-3 w-3" />
      ) : (
        <X className="h-3 w-3" />
      ),
    meta: { className: 'px-2 py-1 text-xs', icon: CheckCheck },
  }),
  col({
    accessorKey: 'timeSpentMs',
    header: 'Time',
    enableSorting: true,
    sortUndefined: 'last',
    cell: ({ row }) =>
      row.original.timeSpentMs !== null ? formatSolveTimeMs(row.original.timeSpentMs) : '—',
    meta: { className: 'px-2 py-1', icon: DATA_ICONS.time },
  }),
  col({
    accessorKey: 'startedAt',
    header: 'Date',
    enableSorting: true,
    cell: ({ row }) => (row.original.startedAt ? row.original.startedAt.slice(0, 10) : '—'),
    meta: { className: 'px-2 py-1', icon: DATA_ICONS.started },
  }),
]

type OverviewAttemptHistoryTableProps = {
  trainingItemId: number
  initialRows: OverviewAttemptHistoryRow[]
  currentUser: SelectableUser
  selectedAttemptId: number | null
  onRowClick: (row: OverviewAttemptHistoryRow) => void
  tableId?: string
  onUserFilterChange?: (users: SelectableUser[]) => void
}

export function OverviewAttemptHistoryTable({
  trainingItemId,
  initialRows,
  currentUser,
  selectedAttemptId,
  onRowClick,
  tableId = 'hist',
  onUserFilterChange,
}: OverviewAttemptHistoryTableProps): React.ReactElement {
  const baseUserFilter = useUserFilterSpec('userId')

  const filters = React.useMemo(
    () => [
      {
        ...baseUserFilter,
        render: (value: SelectableUser[], onChange: (u: SelectableUser[]) => void) => (
          <UserSelector
            value={value}
            onChange={(users) => {
              onChange(users)
              onUserFilterChange?.(users)
            }}
            className="h-7 text-xs"
          />
        ),
      },
      { type: 'multi' as const, key: 'result', label: 'Result', options: RESULT_OPTIONS },
    ],
    [baseUserFilter, onUserFilterChange],
  )

  const initialCustomValues = React.useMemo(
    () => ({ userId: [currentUser] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // captured at mount; currentUser provides the default "me" filter
  )

  const initialData = React.useMemo(
    () => ({ items: initialRows, total: initialRows.length }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const fetchData = React.useCallback(
    async (params: FetchParams): Promise<{ items: OverviewAttemptHistoryRow[]; total: number }> => {
      const { attempts, total } = await api.trainingItems.getAttemptHistory(trainingItemId, params)
      return {
        items: attempts.map((a) => ({
          attemptId: a.attemptId,
          runId: a.runId,
          runLabel: `Run ${a.runIndex + 1}`,
          runOrder: a.runIndex,
          runTrainingItemId: a.runTrainingItemId,
          tryNumber: a.tryNumber,
          countsTowardsTraining: a.countsTowardsTraining,
          result: a.result,
          timeSpentMs: a.timeSpentMs,
          startedAt: a.startedAt,
          userId: a.userId,
          displayName: a.displayName,
          avatarUrl: a.avatarUrl,
        })),
        total,
      }
    },
    [trainingItemId],
  )

  const getRowClassName = React.useCallback(
    (row: OverviewAttemptHistoryRow) =>
      row.attemptId === selectedAttemptId ? 'bg-muted/50' : '',
    [selectedAttemptId],
  )

  return (
    <ServerDataTable
      tableId={tableId}
      columns={columns}
      filters={filters}
      pageSize={PAGE_SIZE}
      fetchData={fetchData}
      initialData={initialData}
      initialCustomValues={initialCustomValues}
      onRowClick={onRowClick}
      getRowClassName={getRowClassName}
      initialSorting={[{ id: 'startedAt', desc: true }]}
      emptyMessage="No attempts recorded."
      compact
    />
  )
}
