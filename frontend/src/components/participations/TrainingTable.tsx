import * as React from 'react'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { StatusBadge } from '../StatusBadge'
import { DataTable, type FilterableColumn } from '../DataTable'
import { ProgressBar } from '../ProgressBar'
import { UserAvatar } from '../UserAvatar'
import { UserSelector } from '../UserSelector'
import { Button } from '../ui/button'
import { useAuth } from '../../context/auth'
import { api, type AllTrainingSummary, type SelectableUser, type TrainingStatus } from '../../lib/api'

const PAGE_SIZE = 20

type TrainingTableProps = {
  scheduleId?: number
  hideSchedule?: boolean
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function TrainingTable({
  scheduleId,
  hideSchedule = false,
}: TrainingTableProps): React.ReactElement {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [trainings, setTrainings] = useState<AllTrainingSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [selectedUsers, setSelectedUsers] = useState<SelectableUser[]>(() =>
    user && user.status === 'active'
      ? [{ id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl }]
      : [],
  )
  const userIds = useMemo(() => selectedUsers.map((u) => u.id), [selectedUsers])

  useEffect(() => {
    setLoading(true)
    api.training
      .listAll({
        scheduleId,
        userIds: userIds.length > 0 ? userIds : undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .then(({ items, total: t }) => {
        setTrainings(items)
        setTotal(t)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [scheduleId, userIds, page])

  const handleUsersChange = useCallback((users: SelectableUser[]) => {
    setSelectedUsers(users)
    setPage(1)
  }, [])

  const statusOptions = useMemo(
    () => [
      { label: 'Not started', value: 'draft' },
      { label: 'In progress', value: 'in_progress' },
      { label: 'Completed', value: 'completed' },
      { label: 'Aborted', value: 'aborted' },
    ],
    [],
  )

  const filterableColumns: FilterableColumn[] = [
    { id: 'status', label: 'statuses', options: statusOptions },
  ]

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const columns: ColumnDef<AllTrainingSummary>[] = useMemo(
    () => [
      {
        id: 'user',
        accessorFn: (row) => row.user.displayName,
        header: 'User',
        enableSorting: false,
        cell: ({ row }) => (
          <UserAvatar displayName={row.original.user.displayName} avatarUrl={row.original.user.avatarUrl} />
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => <StatusBadge status={row.original.status as TrainingStatus} />,
        filterFn: 'equals',
      },
      {
        id: 'progress',
        accessorFn: (row) =>
          row.totalPuzzles > 0 ? row.completedPuzzles / row.totalPuzzles : 0,
        header: 'Progress',
        cell: ({ row }) => {
          const pct =
            row.original.totalPuzzles > 0
              ? Math.round((row.original.completedPuzzles / row.original.totalPuzzles) * 100)
              : 0
          return (
            <ProgressBar
              value={pct}
              tooltipLabel={`${row.original.completedPuzzles}/${row.original.totalPuzzles} puzzles`}
              className="w-28"
            />
          )
        },
      },
      ...(!hideSchedule
        ? ([
            {
              id: 'schedule',
              accessorFn: (row: AllTrainingSummary) => row.scheduleName,
              header: 'Schedule',
              cell: ({ row }: { row: { original: AllTrainingSummary } }) => (
                <Link
                  to="/app/schedules/$scheduleId"
                  params={{ scheduleId: String(row.original.scheduleId) }}
                  className="font-medium hover:underline"
                  title={row.original.scheduleName}
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.original.scheduleName}
                </Link>
              ),
            },
          ] as ColumnDef<AllTrainingSummary>[])
        : []),
      {
        id: 'startedAt',
        accessorFn: (row) => new Date(row.startedAt).getTime(),
        header: 'Started',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatDate(row.original.startedAt)}</span>
        ),
      },
      {
        id: 'completedAt',
        accessorFn: (row) => (row.completedAt ? new Date(row.completedAt).getTime() : 0),
        header: 'Finished',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.completedAt ? formatDate(row.original.completedAt) : '—'}
          </span>
        ),
      },
    ],
    [hideSchedule],
  )

  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={trainings}
            filterableColumns={filterableColumns}
            filtersSlot={
              <UserSelector value={selectedUsers} onChange={handleUsersChange} />
            }
            pageSize={PAGE_SIZE}
            onRowClick={(t) =>
              void navigate({
                to: '/app/training/$trainingId',
                params: { trainingId: String(t.id) },
              })
            }
            emptyMessage="No training sessions match your filters."
          />
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
