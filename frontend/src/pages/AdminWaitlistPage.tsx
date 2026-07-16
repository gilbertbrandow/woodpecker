import * as React from 'react'
import { useMemo, useRef, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { CheckCircle2, Clock, Loader2, UserCheck } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { PageWrapper } from '../components/PageWrapper'
import { ServerDataTable } from '../components/ServerDataTable'
import { col, actionCol } from '../components/DataTable'
import { AdminUserCapBanner } from '../components/AdminUserCapBanner'
import { api, type AdminWaitlistEntry } from '../lib/api'
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

const WAITLIST_STATUS_OPTIONS = [
  { value: 'whitelisted', label: 'Whitelisted', icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> },
  { value: 'pending', label: 'Pending', icon: <Clock className="h-3.5 w-3.5 text-muted-foreground" /> },
]

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
          row.original.isWhitelisted ? (
            <Badge variant="outline" className="border-green-600/40 text-xs text-green-600">
              Whitelisted
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Pending
            </Badge>
          ),
      }),
      col({
        accessorKey: 'email',
        header: 'Email',
        meta: { icon: DATA_ICONS.email },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email ?? '—'}</span>
        ),
      }),
      col({
        accessorKey: 'createdAt',
        header: 'Joined',
        meta: { icon: DATA_ICONS.started },
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      }),
      col({
        accessorKey: 'updatedAt',
        header: 'Last attempt',
        meta: { icon: DATA_ICONS.lastAttempt },
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatDate(row.original.updatedAt)}
          </span>
        ),
      }),
      actionCol({
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
      }),
    ],
    [],
  )

  const filters = useMemo(
    () => [
      { type: 'search' as const, key: 'q' },
      { type: 'multi' as const, key: 'status', label: 'Status', icon: DATA_ICONS.status, options: WAITLIST_STATUS_OPTIONS },
      { type: 'date' as const, key: 'createdAt', label: 'Joined', icon: DATA_ICONS.started },
      { type: 'date' as const, key: 'updatedAt', label: 'Last attempt', icon: DATA_ICONS.lastAttempt },
    ],
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
        fetchData={(params) => api.admin.waitlist(params)}
        initialSorting={[{ id: 'createdAt', desc: true }]}
        emptyMessage="Nobody on the waitlist."
      />
    </PageWrapper>
  )
}
