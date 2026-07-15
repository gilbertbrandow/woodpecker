import * as React from 'react'
import { useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { PageWrapper } from '../components/PageWrapper'
import { ServerDataTable } from '../components/ServerDataTable'
import { col, actionCol } from '../components/DataTable'
import { AdminUserCapBanner } from '../components/AdminUserCapBanner'
import { api, type AdminWhitelistEntry } from '../lib/api'
import { formatDate } from '../lib/utils'
import { DATA_ICONS } from '../lib/icons'
import { toast } from '../lib/toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog'

const PAGE_SIZE = 20

export function AdminWhitelistPage(): React.ReactElement {
  const [refreshKey, setRefreshKey] = useState(0)
  const [deletingUsername, setDeletingUsername] = useState<string | null>(null)
  const deletingUsernameRef = useRef(deletingUsername)
  deletingUsernameRef.current = deletingUsername

  const handleDelete = async (username: string): Promise<void> => {
    setDeletingUsername(username)
    try {
      await api.admin.deleteWhitelist(username)
      toast.success('Removed from whitelist', { description: `'${username}' has been removed.` })
      setRefreshKey((k) => k + 1)
    } catch {
      toast.error('Failed to remove entry')
    } finally {
      setDeletingUsername(null)
    }
  }
  const handleDeleteRef = useRef(handleDelete)
  handleDeleteRef.current = handleDelete

  const columns = useMemo<ColumnDef<AdminWhitelistEntry>[]>(
    () => [
      col({
        accessorKey: 'lichessUsername',
        header: 'Lichess username',
        meta: { icon: DATA_ICONS.lichessUsername },
        cell: ({ row }) => (
          <span className="font-medium">{row.original.lichessUsername}</span>
        ),
      }),
      col({
        id: 'status',
        header: 'Status',
        meta: { icon: DATA_ICONS.status },
        enableSorting: false,
        cell: ({ row }) =>
          row.original.isRegistered ? (
            <Badge variant="outline" className="border-green-600/40 text-xs text-green-600">
              Registered
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Pending
            </Badge>
          ),
      }),
      col({
        accessorKey: 'createdAt',
        header: 'Added',
        meta: { icon: DATA_ICONS.started },
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      }),
      actionCol({
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const username = row.original.lichessUsername
          return (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={deletingUsernameRef.current !== null}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                  aria-label="Remove from whitelist"
                  onClick={(e) => e.stopPropagation()}
                >
                  {deletingUsernameRef.current === username ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove from whitelist?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &lsquo;{username}&rsquo; will no longer be able to bypass the user cap. If
                    they have already signed up, their account is unaffected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void handleDeleteRef.current(username)}>
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        },
      }),
    ],
    [],
  )

  const filters = useMemo(
    () => [{ type: 'search' as const, key: 'q' }],
    [],
  )

  return (
    <PageWrapper className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <h1 className="text-base font-semibold">Whitelist</h1>
        <Link
          to="/app/admin/whitelist/new"
          className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add entry
        </Link>
      </div>

      <AdminUserCapBanner />

      <ServerDataTable<AdminWhitelistEntry>
        columns={columns}
        pageSize={PAGE_SIZE}
        refreshKey={refreshKey}
        filters={filters}
        fetchData={({ filters: f, page }) =>
          api.admin.whitelist({ page, q: f.q?.[0] || undefined })
        }
        initialSorting={[{ id: 'createdAt', desc: true }]}
        emptyMessage="The whitelist is empty."
      />
    </PageWrapper>
  )
}
