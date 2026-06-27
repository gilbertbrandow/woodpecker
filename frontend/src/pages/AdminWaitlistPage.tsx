import * as React from 'react'
import { useMemo, useRef, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Loader2, UserCheck } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { PageWrapper } from '../components/PageWrapper'
import { ServerDataTable } from '../components/ServerDataTable'
import { AdminUserCapBanner } from '../components/AdminUserCapBanner'
import { api, type AdminWaitlistEntry } from '../lib/api'
import { formatDate } from '../lib/utils'
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

export function AdminWaitlistPage(): React.ReactElement {
  const [refreshKey, setRefreshKey] = useState(0)
  const [allowingUsername, setAllowingUsername] = useState<string | null>(null)
  const allowingUsernameRef = useRef(allowingUsername)
  allowingUsernameRef.current = allowingUsername

  const handleAllow = async (username: string): Promise<void> => {
    setAllowingUsername(username)
    try {
      await api.admin.addWhitelist(username)
      toast.success('User allowed', { description: `'${username}' will be let in on their next sign-in.` })
      setRefreshKey((k) => k + 1)
    } catch {
      toast.error('Failed to allow user')
    } finally {
      setAllowingUsername(null)
    }
  }
  const handleAllowRef = useRef(handleAllow)
  handleAllowRef.current = handleAllow

  const columns = useMemo<ColumnDef<AdminWaitlistEntry>[]>(
    () => [
      {
        accessorKey: 'lichessUsername',
        header: 'Lichess username',
        cell: ({ row }) => (
          <span className="font-medium">{row.original.lichessUsername}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.isWhitelisted ? (
            <Badge variant="outline" className="border-green-600/40 text-xs text-green-600">
              Whitelisted
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Pending
            </Badge>
          ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Joined',
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: 'Last attempt',
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatDate(row.original.updatedAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const username = row.original.lichessUsername
          if (row.original.isWhitelisted) return null
          return (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={allowingUsernameRef.current !== null}
                  onClick={(e) => e.stopPropagation()}
                >
                  {allowingUsernameRef.current === username ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5" />
                  )}
                  Allow user
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Allow this user?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &lsquo;{username}&rsquo; will be added to the whitelist and removed from the
                    waitlist. They can sign in immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void handleAllowRef.current(username)}>
                    Allow
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        },
      },
    ],
    [],
  )

  const filters = useMemo(
    () => [{ type: 'search' as const, key: 'q', placeholder: 'Search by username…' }],
    [],
  )

  return (
    <PageWrapper className="flex flex-col gap-6">
      <h1 className="text-base font-semibold">Waitlist</h1>
      <AdminUserCapBanner />
      <ServerDataTable<AdminWaitlistEntry>
        columns={columns}
        pageSize={PAGE_SIZE}
        refreshKey={refreshKey}
        filters={filters}
        fetchData={({ filters: f, page }) =>
          api.admin.waitlist({ page, q: f.q?.[0] || undefined })
        }
        emptyMessage="Nobody on the waitlist."
      />
    </PageWrapper>
  )
}
