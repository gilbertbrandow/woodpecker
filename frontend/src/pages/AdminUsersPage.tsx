import * as React from 'react'
import { useMemo } from 'react'
import { ShieldCheck, User } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { PageWrapper } from '../components/PageWrapper'
import { ServerDataTable } from '../components/ServerDataTable'
import { col } from '../components/DataTable'
import { UserAvatar } from '../components/UserAvatar'
import { Badge } from '../components/ui/badge'
import { api, type AdminUser } from '../lib/api'
import { formatDate } from '../lib/utils'
import { DATA_ICONS } from '../lib/icons'

const PAGE_SIZE = 20

const COLUMNS: ColumnDef<AdminUser>[] = [
  col({
    accessorKey: 'displayName',
    header: 'User',
    meta: { icon: DATA_ICONS.user },
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <UserAvatar displayName={row.original.displayName} avatarUrl={row.original.avatarUrl} />
        <span className="font-medium">{row.original.displayName}</span>
      </div>
    ),
  }),
  col({
    accessorKey: 'lichessUsername',
    header: 'Lichess username',
    meta: { icon: DATA_ICONS.lichessUsername },
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.lichessUsername}</span>
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
    accessorKey: 'lastLoginAt',
    header: 'Last login',
    meta: { icon: DATA_ICONS.lastLogin },
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {row.original.lastLoginAt ? formatDate(row.original.lastLoginAt) : '—'}
      </span>
    ),
  }),
  col({
    accessorKey: 'lastSeenAt',
    header: 'Last seen',
    meta: { icon: DATA_ICONS.lastSeen },
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {row.original.lastSeenAt ? formatDate(row.original.lastSeenAt) : '—'}
      </span>
    ),
  }),
  col({
    id: 'role',
    header: 'Role',
    meta: { icon: DATA_ICONS.role },
    cell: ({ row }) =>
      row.original.isSuperAdmin ? (
        <Badge className="text-xs">Admin</Badge>
      ) : (
        <Badge variant="outline" className="text-xs text-muted-foreground">Default</Badge>
      ),
  }),
]

export function AdminUsersPage(): React.ReactElement {
  const filters = useMemo(
    () => [
      { type: 'search' as const, key: 'q' },
      {
        type: 'multi' as const,
        key: 'role',
        label: 'Role',
        icon: DATA_ICONS.role,
        options: [
          { value: 'admin', label: 'Admin', icon: <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> },
          { value: 'default', label: 'Default', icon: <User className="h-3.5 w-3.5 text-muted-foreground" /> },
        ],
      },
      { type: 'date' as const, key: 'createdAt', label: 'Joined', icon: DATA_ICONS.started },
      { type: 'date' as const, key: 'lastLoginAt', label: 'Last login', icon: DATA_ICONS.lastLogin },
      { type: 'date' as const, key: 'lastSeenAt', label: 'Last seen', icon: DATA_ICONS.lastSeen },
    ],
    [],
  )

  return (
    <PageWrapper className="flex flex-col gap-6">
      <h1 className="text-base font-semibold">Users</h1>
      <ServerDataTable<AdminUser>
        columns={COLUMNS}
        pageSize={PAGE_SIZE}
        filters={filters}
        fetchData={(params) => api.admin.users(params)}
        initialSorting={[{ id: 'createdAt', desc: true }]}
        emptyMessage="No users found."
      />
    </PageWrapper>
  )
}
