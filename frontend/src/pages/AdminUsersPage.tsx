import * as React from 'react'
import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { PageWrapper } from '../components/PageWrapper'
import { ServerDataTable } from '../components/ServerDataTable'
import { UserAvatar } from '../components/UserAvatar'
import { Badge } from '../components/ui/badge'
import { api, type AdminUser } from '../lib/api'
import { formatDate } from '../lib/utils'
import { DATA_ICONS } from '../lib/icons'

const PAGE_SIZE = 20

const COLUMNS: ColumnDef<AdminUser>[] = [
  {
    accessorKey: 'displayName',
    header: 'User',
    meta: { icon: DATA_ICONS.user },
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <UserAvatar displayName={row.original.displayName} avatarUrl={row.original.avatarUrl} />
        <span className="font-medium">{row.original.displayName}</span>
      </div>
    ),
  },
  {
    accessorKey: 'lichessUsername',
    header: 'Lichess username',
    meta: { icon: DATA_ICONS.lichessUsername },
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.lichessUsername}</span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Joined',
    meta: { icon: DATA_ICONS.started },
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
  {
    accessorKey: 'lastLoginAt',
    header: 'Last login',
    meta: { icon: DATA_ICONS.lastLogin },
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {row.original.lastLoginAt ? formatDate(row.original.lastLoginAt) : '—'}
      </span>
    ),
  },
  {
    accessorKey: 'lastSeenAt',
    header: 'Last seen',
    meta: { icon: DATA_ICONS.lastSeen },
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {row.original.lastSeenAt ? formatDate(row.original.lastSeenAt) : '—'}
      </span>
    ),
  },
  {
    id: 'role',
    header: 'Role',
    meta: { icon: DATA_ICONS.role },
    cell: ({ row }) =>
      row.original.isSuperAdmin ? (
        <Badge className="text-xs">Admin</Badge>
      ) : (
        <Badge variant="outline" className="text-xs text-muted-foreground">Default</Badge>
      ),
  },
]

export function AdminUsersPage(): React.ReactElement {
  const filters = useMemo(
    () => [{ type: 'search' as const, key: 'q', placeholder: 'Search by username…' }],
    [],
  )

  return (
    <PageWrapper className="flex flex-col gap-6">
      <h1 className="text-base font-semibold">Users</h1>
      <ServerDataTable<AdminUser>
        columns={COLUMNS}
        pageSize={PAGE_SIZE}
        filters={filters}
        fetchData={({ filters: f, page }) =>
          api.admin.users({ page, q: f.q?.[0] || undefined })
        }
        emptyMessage="No users found."
      />
    </PageWrapper>
  )
}
