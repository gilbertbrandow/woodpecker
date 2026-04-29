import * as React from 'react'
import { useMemo } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { StatusBadge } from '../StatusBadge'
import { DataTable, type FilterableColumn } from '../DataTable'
import { ProgressBar } from '../ProgressBar'
import { UserAvatar } from '../UserAvatar'
import type { AllTrainingSummary, TrainingStatus } from '../../lib/api'

type TrainingTableProps = {
  trainings: AllTrainingSummary[]
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
  trainings,
  hideSchedule = false,
}: TrainingTableProps): React.ReactElement {
  const navigate = useNavigate()

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(trainings.map((t) => t.status))).map((v) => ({
        label:
          v === 'draft'
            ? 'Not started'
            : v === 'in_progress'
              ? 'In progress'
              : v === 'completed'
                ? 'Completed'
                : 'Aborted',
        value: v,
      })),
    [trainings],
  )

  const filterableColumns: FilterableColumn[] = [
    { id: 'status', label: 'statuses', options: statusOptions },
  ]

  const columns: ColumnDef<AllTrainingSummary>[] = [
    {
      id: 'user',
      accessorFn: (row) => row.user.username,
      header: 'User',
      enableSorting: false,
      cell: ({ row }) => (
        <UserAvatar username={row.original.user.username} avatarUrl={row.original.user.avatarUrl} />
      ),
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
      accessorKey: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => <StatusBadge status={row.original.status as TrainingStatus} />,
      filterFn: 'equals',
    },
    {
      id: 'progress',
      accessorFn: (row) =>
        row.totalRuns > 0 ? row.runsCompleted / row.totalRuns : 0,
      header: 'Progress',
      cell: ({ row }) => {
        const pct =
          row.original.totalRuns > 0
            ? Math.round((row.original.runsCompleted / row.original.totalRuns) * 100)
            : 0
        return (
          <ProgressBar
            value={pct}
            tooltipLabel={`${row.original.runsCompleted}/${row.original.totalRuns} runs`}
            className="w-28"
          />
        )
      },
    },
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
          {row.original.completedAt ? formatDate(row.original.completedAt) : '\u2014'}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={trainings}
      globalFilterPlaceholder="Search training…"
      filterableColumns={filterableColumns}
      pageSize={10}
      onRowClick={(t) =>
        void navigate({
          to: '/app/training/$trainingId',
          params: { trainingId: String(t.id) },
        })
      }
      emptyMessage="No training sessions match your filters."
    />
  )
}
