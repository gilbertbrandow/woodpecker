import * as React from 'react'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { Loader2, Search, Trash2, PencilLine, Lock } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { UserAvatar } from '../UserAvatar'
import { StatusBadge } from '../StatusBadge'
import { DataTable } from '../DataTable'
import { UserSelector } from '../UserSelector'
import { Input } from '../ui/input'
import { MultiSelectFilter } from '../ui/multi-select-filter'
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
import { useAuth } from '../../context/auth'
import type { ScheduleSummary, SelectableUser } from '../../lib/api'
import { api } from '../../lib/api'
import { formatDuration } from './DurationInput'
import { useDebounce } from '../../hooks/useDebounce'
import { toast } from 'sonner'

const PAGE_SIZE = 20

type SchedulesTableProps = {
  subsetId?: number
  onCountChange?: (count: number) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function SchedulesTable({ subsetId, onCountChange }: SchedulesTableProps): React.ReactElement {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [schedules, setSchedules] = useState<ScheduleSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [search, setSearch] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<SelectableUser[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])

  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, selectedUsers, selectedStatuses])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    api.schedules
      .list({
        subsetId,
        search: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
        userIds: selectedUsers.length > 0 ? selectedUsers.map((u) => u.id) : undefined,
        statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      })
      .then((r) => {
        setSchedules(r.items)
        setTotal(r.total)
        onCountChange?.(r.total)
      })
      .catch(() => toast.error('Failed to load schedules', { description: 'Could not fetch schedules.' }))
      .finally(() => setLoading(false))
  }, [user, subsetId, debouncedSearch, page, selectedUsers, selectedStatuses, onCountChange, refreshKey])

  const statusOptions = [
    { label: 'Draft', value: 'draft', icon: <PencilLine className="h-3.5 w-3.5 text-muted-foreground" /> },
    { label: 'Locked', value: 'locked', icon: <Lock className="h-3.5 w-3.5 text-violet-600" /> },
  ]

  // Refs keep cell renderers current without invalidating the columns memo
  const deletingIdRef = useRef(deletingId)
  deletingIdRef.current = deletingId

  const handleDelete = async (item: ScheduleSummary): Promise<void> => {
    setDeletingId(item.id)
    try {
      await api.schedules.delete(item.id)
      toast('Schedule deleted', { description: `"${item.name}" has been removed.` })
      setRefreshKey((k) => k + 1)
    } catch {
      toast.error('Failed to delete schedule', { description: 'Please try again.' })
    } finally {
      setDeletingId(null)
    }
  }
  const handleDeleteRef = useRef(handleDelete)
  handleDeleteRef.current = handleDelete

  const columns = useMemo<ColumnDef<ScheduleSummary>[]>(
    () => [
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
          const isOwn = row.original.createdBy.id === user?.id
          if (!isOwn) return null
          return (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={deletingIdRef.current !== null}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                  aria-label="Delete schedule"
                  onClick={(e) => e.stopPropagation()}
                >
                  {deletingIdRef.current === row.original.id ? (
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
                  <AlertDialogAction onClick={() => void handleDeleteRef.current(row.original)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        },
      },
    ],
    [user],
  )

  return (
    <DataTable
      columns={columns}
      data={schedules}
      loading={loading}
      hideSearch
      filtersSlot={
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search schedules…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 text-sm sm:w-56"
            />
          </div>
          <UserSelector value={selectedUsers} onChange={setSelectedUsers} />
          <MultiSelectFilter
            label="All statuses"
            options={statusOptions}
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
          />
        </>
      }
      serverPagination={{ totalRows: total, page, pageSize: PAGE_SIZE, onPageChange: setPage }}
      pageSize={PAGE_SIZE}
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
