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
import { toast } from '../../lib/toast'
import { useTableUrlSync } from '../../hooks/useTableUrlSync'
import { useUrlHydratedFilter } from '../../hooks/useUrlHydratedFilter'

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
  const { getParam, getMultiParam, setParams } = useTableUrlSync(undefined)

  const {
    value: selectedUsers,
    setValue: setSelectedUsers,
    isHydrating: usersHydrating,
    syncedFilter: userSyncedFilter,
  } = useUrlHydratedFilter<SelectableUser>({
    urlKey: 'userIds',
    tableId: undefined,
    fetchByIds: (ids) => api.users.getByIds(ids.map(Number)),
    getIdFromItem: (u) => String(u.id),
    resolveInstant: user ? (id) => String(user.id) === id
      ? { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl }
      : null : undefined,
  })

  const [subsets, setSubsets] = useState<Subset[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(() => {
    const p = getParam('page')
    return p ? Math.max(1, parseInt(p, 10)) : 1
  })
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [search, setSearch] = useState(() => getParam('q') ?? '')
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() =>
    getMultiParam('statuses'),
  )

  const debouncedSearch = useDebounce(search, 300)

  // Sync debounced search to URL; skip first render to preserve URL-restored page
  const searchMountedRef = useRef(false)
  useEffect(() => {
    if (!searchMountedRef.current) {
      searchMountedRef.current = true
      return
    }
    setPage(1)
    setParams({ q: debouncedSearch || null, page: null })
  }, [debouncedSearch, setParams])

  useEffect(() => {
    if (!user || usersHydrating) return
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
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, usersHydrating, debouncedSearch, page, selectedUsers, selectedStatuses, refreshKey])

  const statusFilterColumn = {
    id: 'statuses',
    label: 'statuses',
    options: [
      { label: 'Draft', value: 'draft', icon: <PencilLine className="h-3.5 w-3.5 text-muted-foreground" /> },
      { label: 'Filled', value: 'filled', icon: <Layers className="h-3.5 w-3.5 text-blue-600" /> },
      { label: 'Locked', value: 'locked', icon: <Lock className="h-3.5 w-3.5 text-violet-600" /> },
    ],
  }

  const deletingIdRef = useRef(deletingId)
  deletingIdRef.current = deletingId

  const handleDelete = async (item: Subset): Promise<void> => {
    setDeletingId(item.id)
    try {
      await api.subsets.delete(item.id)
      toast.success('Subset deleted', { description: `"${item.name}" has been removed.` })
      setRefreshKey((k) => k + 1)
    } catch {
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
          <UserSelector
            value={selectedUsers}
            onChange={(users) => { setSelectedUsers(users); setPage(1) }}
          />
        </>
      }
      filterableColumns={[statusFilterColumn]}
      onFilterChange={(id, values) => {
        if (id === 'statuses') {
          setSelectedStatuses(values)
          setPage(1)
        }
      }}
      syncedFilters={[userSyncedFilter]}
      filtersActive={search !== ''}
      onClearFilters={() => {
        setSearch('')
        setSelectedUsers([])
        setPage(1)
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
