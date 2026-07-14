import * as React from 'react'
import { useState, useRef } from 'react'
import { useServerTable } from '../../hooks/useServerTable'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, Trash2, PencilLine, Layers, Lock, Activity } from 'lucide-react'
import { formatDate } from '../../lib/utils'
import { type ColumnDef } from '@tanstack/react-table'
import { UserAvatar } from '../UserAvatar'
import { StatusBadge } from '../StatusBadge'
import { ServerDataTable } from '../ServerDataTable'
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
import type { Subset } from '../../lib/api'
import { api } from '../../lib/api'
import { toast } from '../../lib/toast'
import { useUserFilterSpec } from '../../hooks/useUserFilterSpec'
import { DATA_ICONS } from '../../lib/icons'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { label: 'Draft',  value: 'draft',  icon: <PencilLine className="h-3.5 w-3.5 text-muted-foreground" /> },
  { label: 'Filled', value: 'filled', icon: <Layers className="h-3.5 w-3.5 text-blue-600" /> },
  { label: 'Locked', value: 'locked', icon: <Lock className="h-3.5 w-3.5 text-violet-600" /> },
]

export function SubsetsTable(): React.ReactElement {
  const { user } = useAuth()
  const navigate = useNavigate()
  const userFilterSpec = useUserFilterSpec('userId', 'Creator')

  const [deletingId, setDeletingId] = useState<number | null>(null)
  const { refreshKey, refetch } = useServerTable()

  const deletingIdRef = useRef(deletingId)
  deletingIdRef.current = deletingId

  const blockNavRef = useRef(false)

  const handleDelete = async (item: Subset): Promise<void> => {
    setDeletingId(item.id)
    blockNavRef.current = true
    try {
      await api.subsets.delete(item.id)
      toast.success('Subset deleted', { description: `"${item.name}" has been removed.` })
      refetch()
    } catch {
    } finally {
      setDeletingId(null)
      setTimeout(() => { blockNavRef.current = false }, 300)
    }
  }
  const handleDeleteRef = useRef(handleDelete)
  handleDeleteRef.current = handleDelete

  const columns = React.useMemo<ColumnDef<Subset>[]>(
    () => [
      {
        id: 'creator',
        accessorFn: (row) => row.ownedBy.displayName,
        header: 'Creator',
        meta: { icon: DATA_ICONS.user },
        enableSorting: false,
        cell: ({ row }) => (
          <UserAvatar
            displayName={row.original.ownedBy.displayName}
            avatarUrl={row.original.ownedBy.avatarUrl}
          />
        ),
      },
      {
        accessorKey: 'name',
        header: 'Name',
        meta: { icon: DATA_ICONS.name },
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: { icon: DATA_ICONS.status },
        enableSorting: false,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'puzzleCount',
        header: 'Puzzles',
        meta: { icon: DATA_ICONS.puzzles },
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">{row.original.puzzleCount}</span>
        ),
      },
      {
        id: 'date',
        accessorFn: (row) =>
          row.lockedAt ? new Date(row.lockedAt).getTime() : new Date(row.createdAt).getTime(),
        header: 'Date',
        meta: { icon: DATA_ICONS.started },
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
        enableHiding: false,
        cell: ({ row }) => {
          const canDelete = row.original.ownedBy.id === user?.id && row.original.status !== 'locked'
          if (!canDelete) return null
          return (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={deletingIdRef.current !== null}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                  aria-label="Delete subset"
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
                  <AlertDialogTitle>Delete subset?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &ldquo;{row.original.name}&rdquo; and all its puzzles will be permanently
                    removed. This cannot be undone.
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
    <ServerDataTable
      columns={columns}
      pageSize={PAGE_SIZE}
      refreshKey={refreshKey}
      filters={[
        userFilterSpec,
        { type: 'multi', key: 'status', label: 'Status', options: STATUS_OPTIONS, icon: Activity },
        { type: 'date', key: 'date', label: 'Date', icon: DATA_ICONS.started },
        { type: 'range', key: 'puzzleCount', label: 'Puzzles', min: 0, max: 1000, step: 25, icon: DATA_ICONS.puzzles, formatValue: (v) => v >= 1000 ? '1000+' : String(v) },
        { type: 'search', key: 'q' },
      ]}
      fetchData={(params) => api.subsets.list(params)}
      onRowClick={(subset) => {
        if (blockNavRef.current) return
        void navigate({
          to: '/app/subsets/$subsetId',
          params: { subsetId: String(subset.id) },
        })
      }}
      emptyMessage="No subsets match your filters."
    />
  )
}
