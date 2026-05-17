import * as React from 'react'
import { useState, useMemo } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { Loader2, Trash2 } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { UserAvatar } from '../UserAvatar'
import { StatusBadge } from '../StatusBadge'
import { DataTable, type FilterableColumn } from '../DataTable'
import { UserSelector } from '../UserSelector'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '../ui/alert-dialog'
import type { ScheduleSummary, SelectableUser } from '../../lib/api'
import { formatDuration } from './DurationInput'

type SchedulesTableProps = {
  schedules: ScheduleSummary[]
  currentUserId: number
  deletingId: number | null
  onDelete: (schedule: ScheduleSummary) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function SchedulesTable({
  schedules,
  currentUserId,
  deletingId,
  onDelete,
}: SchedulesTableProps): React.ReactElement {
  const navigate = useNavigate()
  const [selectedUsers, setSelectedUsers] = useState<SelectableUser[]>([])

  const filteredSchedules = useMemo(
    () =>
      selectedUsers.length > 0
        ? schedules.filter((s) => selectedUsers.some((u) => u.id === s.createdBy.id))
        : schedules,
    [schedules, selectedUsers],
  )

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(schedules.map((s) => s.status))).map((v) => ({
        label: v.charAt(0).toUpperCase() + v.slice(1),
        value: v,
      })),
    [schedules],
  )

  const filterableColumns: FilterableColumn[] = [
    { id: 'status', label: 'statuses', options: statusOptions },
  ]

  const columns: ColumnDef<ScheduleSummary>[] = [
    {
      id: 'creator',
      accessorFn: (row) => row.createdBy.displayName,
      header: 'Creator',
      enableSorting: false,
      cell: ({ row }) => (
        <UserAvatar
          displayName={row.original.createdBy.displayName}
          avatarUrl={row.original.createdBy.avatarUrl}
        />
      ),
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      id: 'subset',
      accessorFn: (row) => row.subsetName,
      header: 'Subset',
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          to="/app/subsets/$subsetId"
          params={{ subsetId: String(row.original.subsetId) }}
          className="text-sm text-muted-foreground hover:underline"
          title={row.original.subsetName}
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.subsetName}
        </Link>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      filterFn: 'equals',
    },
    {
      accessorKey: 'runCount',
      header: 'Runs',
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.runCount > 0 ? row.original.runCount : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'totalHours',
      header: 'Duration',
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.totalHours > 0 ? formatDuration(row.original.totalHours) : '—'}
        </span>
      ),
    },
    {
      id: 'date',
      accessorFn: (row) =>
        row.lockedAt ? new Date(row.lockedAt).getTime() : new Date(row.createdAt).getTime(),
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.lockedAt ?? row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const isOwn = row.original.createdBy.id === currentUserId
        if (!isOwn) return null
        return (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={deletingId !== null}
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                aria-label="Delete schedule"
                onClick={(e) => e.stopPropagation()}
              >
                {deletingId === row.original.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete schedule?</AlertDialogTitle>
                <AlertDialogDescription>
                  &ldquo;{row.original.name}&rdquo; will be permanently removed. This cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(row.original)}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={filteredSchedules}
      globalFilterPlaceholder="Search schedules…"
      filterableColumns={filterableColumns}
      filtersSlot={
        <UserSelector value={selectedUsers} onChange={setSelectedUsers} />
      }
      pageSize={10}
      onRowClick={(schedule) =>
        void navigate({
          to: '/app/schedules/$scheduleId',
          params: { scheduleId: String(schedule.id) },
        })
      }
      emptyMessage="No schedules match your filters."
    />
  )
}
