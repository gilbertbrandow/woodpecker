import * as React from 'react'
import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, Trash2 } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { UserAvatar } from '../UserAvatar'
import { StatusBadge } from '../StatusBadge'
import { DataTable, type FilterableColumn } from '../DataTable'
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
import type { Subset } from '../../lib/api'

type SubsetsTableProps = {
  subsets: Subset[]
  currentUsername: string
  deletingId: number | null
  onDelete: (subset: Subset) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function SubsetsTable({
  subsets,
  currentUsername,
  deletingId,
  onDelete,
}: SubsetsTableProps): React.ReactElement {
  const navigate = useNavigate()

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(subsets.map((s) => s.status))).map((v) => ({
        label: v.charAt(0).toUpperCase() + v.slice(1),
        value: v,
      })),
    [subsets],
  )

  const ownerOptions = useMemo(
    () =>
      Array.from(new Set(subsets.map((s) => s.ownedBy.username)))
        .sort()
        .map((v) => ({ label: v, value: v })),
    [subsets],
  )

  const filterableColumns: FilterableColumn[] = [
    { id: 'status', label: 'statuses', options: statusOptions },
    ...(ownerOptions.length > 1
      ? [{ id: 'creator', label: 'creators', options: ownerOptions }]
      : []),
  ]

  const columns: ColumnDef<Subset>[] = [
    {
      id: 'creator',
      accessorFn: (row) => row.ownedBy.username,
      header: 'Creator',
      enableSorting: false,
      cell: ({ row }) => (
        <UserAvatar
          username={row.original.ownedBy.username}
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
      filterFn: 'equals',
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
        const isOwn = row.original.ownedBy.username === currentUsername
        if (!isOwn) return null
        return (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={deletingId !== null}
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                aria-label="Delete subset"
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
                <AlertDialogTitle>Delete subset?</AlertDialogTitle>
                <AlertDialogDescription>
                  &ldquo;{row.original.name}&rdquo; and all its puzzles will be permanently
                  removed. This cannot be undone.
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
      data={subsets}
      globalFilterPlaceholder="Search subsets…"
      filterableColumns={filterableColumns}
      pageSize={10}
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
