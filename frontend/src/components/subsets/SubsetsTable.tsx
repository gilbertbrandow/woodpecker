import * as React from 'react'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, Search, Trash2, PencilLine, Layers, Lock } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { UserAvatar } from '../UserAvatar'
import { StatusBadge } from '../StatusBadge'
import { DataTable } from '../DataTable'
import { UserSelector } from '../UserSelector'
import { Input } from '../ui/input'
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
import type { Subset, SelectableUser } from '../../lib/api'
import { api } from '../../lib/api'
import { useDebounce } from '../../hooks/useDebounce'
import { toast } from 'sonner'

const PAGE_SIZE = 20

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function SubsetsTable(): React.ReactElement {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [subsets, setSubsets] = useState<Subset[]>([])
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
    api.subsets
      .list({
        search: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
        userIds: selectedUsers.length > 0 ? selectedUsers.map((u) => u.id) : undefined,
        statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      })
      .then((r) => {
        setSubsets(r.items)
        setTotal(r.total)
      })
      .catch(() => toast.error('Failed to load subsets', { description: 'Could not fetch subsets.' }))
      .finally(() => setLoading(false))
  }, [user, debouncedSearch, page, selectedUsers, selectedStatuses, refreshKey])

  const statusFilterColumn = {
    id: 'status',
    label: 'statuses',
    options: [
      { label: 'Draft', value: 'draft', icon: <PencilLine className="h-3.5 w-3.5 text-muted-foreground" /> },
      { label: 'Filled', value: 'filled', icon: <Layers className="h-3.5 w-3.5 text-blue-600" /> },
      { label: 'Locked', value: 'locked', icon: <Lock className="h-3.5 w-3.5 text-violet-600" /> },
    ],
  }

  // Refs keep cell renderers current without invalidating the columns memo
  const deletingIdRef = useRef(deletingId)
  deletingIdRef.current = deletingId

  const handleDelete = async (item: Subset): Promise<void> => {
    setDeletingId(item.id)
    try {
      await api.subsets.delete(item.id)
      toast('Subset deleted', { description: `"${item.name}" has been removed.` })
      setRefreshKey((k) => k + 1)
    } catch {
      toast.error('Failed to delete subset', { description: 'Please try again.' })
    } finally {
      setDeletingId(null)
    }
  }
  const handleDeleteRef = useRef(handleDelete)
  handleDeleteRef.current = handleDelete

  const columns = useMemo<ColumnDef<Subset>[]>(
    () => [
      {
        id: 'creator',
        accessorFn: (row) => row.ownedBy.displayName,
        header: 'Creator',
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
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'puzzleCount',
        header: 'Puzzles',
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">{row.original.puzzleCount}</span>
        ),
      },
      {
        id: 'date',
        accessorFn: (row) =>
          row.lockedAt ? new Date(row.lockedAt).getTime() : new Date(row.createdAt).getTime(),
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.lockedAt
              ? formatDate(row.original.lockedAt)
              : formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const isOwn = row.original.ownedBy.id === user?.id
          if (!isOwn) return null
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
    <DataTable
      columns={columns}
      data={subsets}
      loading={loading}
      hideSearch
      filtersSlot={
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search subsets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 text-sm sm:w-56"
            />
          </div>
          <UserSelector value={selectedUsers} onChange={setSelectedUsers} />
        </>
      }
      filterableColumns={[statusFilterColumn]}
      onFilterChange={(id, values) => {
        if (id === 'status') setSelectedStatuses(values)
      }}
      serverPagination={{ totalRows: total, page, pageSize: PAGE_SIZE, onPageChange: setPage }}
      pageSize={PAGE_SIZE}
      onRowClick={(subset) =>
        void navigate({
          to: '/app/subsets/$subsetId',
          params: { subsetId: String(subset.id) },
        })
      }
      emptyMessage="No subsets match your filters."
    />
  )
}
