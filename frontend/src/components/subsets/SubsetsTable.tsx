import * as React from 'react'
import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowUpDown, ArrowUp, ArrowDown, Loader2, Trash2 } from 'lucide-react'
import { UserAvatar } from '../UserAvatar'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/table'
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

type SortKey = 'name' | 'puzzleCount' | 'lockedAt'
type SortDir = 'asc' | 'desc'

type SubsetsTableProps = {
  subsets: Subset[]
  currentUsername: string
  deletingId: number | null
  onDelete: (subset: Subset) => void
}


function SortHead({
  label,
  sortKey,
  current,
  dir,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  className?: string
}): React.ReactElement {
  const active = current === sortKey
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {label}
        {active ? (
          dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const STATUS_BADGE: Record<Subset['status'], string> = {
  draft: 'outline',
  filled: 'outline',
  locked: 'outline',
}

export function SubsetsTable({ subsets, currentUsername, deletingId, onDelete }: SubsetsTableProps): React.ReactElement {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('lockedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const owners = useMemo(() => {
    const names = Array.from(new Set(subsets.map((s) => s.ownedBy.username))).sort()
    return names
  }, [subsets])

  const handleSort = (key: SortKey): void => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return subsets
      .filter((s) => {
        if (q && !s.name.toLowerCase().includes(q)) return false
        if (ownerFilter && s.ownedBy.username !== ownerFilter) return false
        return true
      })
      .sort((a, b) => {
        let cmp = 0
        if (sortKey === 'name') {
          cmp = a.name.localeCompare(b.name)
        } else if (sortKey === 'puzzleCount') {
          cmp = a.puzzleCount - b.puzzleCount
        } else if (sortKey === 'lockedAt') {
          const aTime = a.lockedAt ? new Date(a.lockedAt).getTime() : 0
          const bTime = b.lockedAt ? new Date(b.lockedAt).getTime() : 0
          cmp = aTime - bTime
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [subsets, search, ownerFilter, sortKey, sortDir])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search subsets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm sm:w-56"
        />
        {owners.length > 1 && (
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring sm:w-44"
          >
            <option value="">All creators</option>
            {owners.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">Creator</TableHead>
              <SortHead label="Name" sortKey="name" current={sortKey} dir={sortDir} onSort={handleSort} />
              <TableHead className="hidden md:table-cell">Status</TableHead>
              <SortHead label="Puzzles" sortKey="puzzleCount" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
              <SortHead label="Date" sortKey="lockedAt" current={sortKey} dir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                  No subsets match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((subset) => {
                const isOwn = subset.ownedBy.username === currentUsername
                return (
                  <TableRow
                    key={subset.id}
                    className="cursor-pointer"
                    onClick={() => void navigate({ to: '/app/subsets/$subsetId', params: { subsetId: String(subset.id) } })}
                  >
                    <TableCell>
                      <UserAvatar username={subset.ownedBy.username} avatarUrl={subset.ownedBy.avatarUrl} />
                    </TableCell>
                    <TableCell className="font-medium">{subset.name}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant={STATUS_BADGE[subset.status] as 'outline'} className="capitalize text-xs">
                        {subset.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {subset.puzzleCount}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {subset.lockedAt ? formatDate(subset.lockedAt) : formatDate(subset.createdAt)}
                    </TableCell>
                    <TableCell>
                      {isOwn && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              type="button"
                              disabled={deletingId !== null}
                              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                              aria-label="Delete subset"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {deletingId === subset.id ? (
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
                                "{subset.name}" and all its puzzles will be permanently removed. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(subset)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
