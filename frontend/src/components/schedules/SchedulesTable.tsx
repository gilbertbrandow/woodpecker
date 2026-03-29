import * as React from 'react'
import { useState, useMemo } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { ArrowUpDown, ArrowUp, ArrowDown, Loader2, Trash2 } from 'lucide-react'
import { UserAvatar } from '../UserAvatar'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
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
import type { ScheduleSummary } from '../../lib/api'
import { formatDuration } from './DurationInput'

type SortKey = 'name' | 'runCount' | 'totalHours' | 'lockedAt'
type SortDir = 'asc' | 'desc'

type SchedulesTableProps = {
  schedules: ScheduleSummary[]
  currentUsername: string
  deletingId: number | null
  onDelete: (schedule: ScheduleSummary) => void
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

export function SchedulesTable({ schedules, currentUsername, deletingId, onDelete }: SchedulesTableProps): React.ReactElement {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [creatorFilter, setCreatorFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('lockedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const creators = useMemo(() => {
    return Array.from(new Set(schedules.map((s) => s.createdBy.username))).sort()
  }, [schedules])

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
    return schedules
      .filter((s) => {
        if (q && !s.name.toLowerCase().includes(q)) return false
        if (creatorFilter && s.createdBy.username !== creatorFilter) return false
        return true
      })
      .sort((a, b) => {
        let cmp = 0
        if (sortKey === 'name') {
          cmp = a.name.localeCompare(b.name)
        } else if (sortKey === 'runCount') {
          cmp = a.runCount - b.runCount
        } else if (sortKey === 'totalHours') {
          cmp = a.totalHours - b.totalHours
        } else if (sortKey === 'lockedAt') {
          const aTime = a.lockedAt ? new Date(a.lockedAt).getTime() : 0
          const bTime = b.lockedAt ? new Date(b.lockedAt).getTime() : 0
          cmp = aTime - bTime
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [schedules, search, creatorFilter, sortKey, sortDir])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search schedules…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm sm:w-56"
        />
        {creators.length > 1 && (
          <select
            value={creatorFilter}
            onChange={(e) => setCreatorFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring sm:w-44"
          >
            <option value="">All creators</option>
            {creators.map((c) => (
              <option key={c} value={c}>{c}</option>
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
              <TableHead className="hidden sm:table-cell">Subset</TableHead>
              <TableHead className="hidden md:table-cell">Status</TableHead>
              <SortHead label="Runs" sortKey="runCount" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
              <SortHead label="Duration" sortKey="totalHours" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
              <SortHead label="Date" sortKey="lockedAt" current={sortKey} dir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                  No schedules match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((schedule) => {
                const isOwn = schedule.createdBy.username === currentUsername
                return (
                  <TableRow
                    key={schedule.id}
                    className="cursor-pointer"
                    onClick={() => void navigate({ to: '/app/schedules/$scheduleId', params: { scheduleId: String(schedule.id) } })}
                  >
                    <TableCell>
                      <UserAvatar username={schedule.createdBy.username} avatarUrl={schedule.createdBy.avatarUrl} />
                    </TableCell>
                    <TableCell className="font-medium">{schedule.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Link
                        to="/app/subsets/$subsetId"
                        params={{ subsetId: String(schedule.subsetId) }}
                        className="text-sm text-muted-foreground hover:underline"
                        title={schedule.subsetName}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {schedule.subsetName.length > 8 ? `${schedule.subsetName.slice(0, 8)}…` : schedule.subsetName}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="capitalize text-xs">
                        {schedule.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {schedule.runCount > 0 ? schedule.runCount : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {schedule.totalHours > 0 ? formatDuration(schedule.totalHours) : '—'}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDate(schedule.lockedAt ?? schedule.createdAt)}
                    </TableCell>
                    <TableCell>
                      {isOwn && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              type="button"
                              disabled={deletingId !== null}
                              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                              aria-label="Delete schedule"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {deletingId === schedule.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete schedule?</AlertDialogTitle>
                              <AlertDialogDescription>
                                "{schedule.name}" will be permanently removed. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(schedule)}>
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
