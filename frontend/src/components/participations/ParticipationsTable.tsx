import * as React from 'react'
import { useState, useMemo } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
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
import { ProgressBar } from '../ProgressBar'
import { UserAvatar } from '../UserAvatar'
import type { AllParticipationSummary, ParticipationStatus } from '../../lib/api'

type SortKey = 'scheduleName' | 'status' | 'progress' | 'startedAt'
type SortDir = 'asc' | 'desc'

type ParticipationsTableProps = {
  participations: AllParticipationSummary[]
  hideSchedule?: boolean
}

const STATUS_LABELS: Record<ParticipationStatus, string> = {
  draft: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  aborted: 'Aborted',
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
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ParticipationsTable({
  participations,
  hideSchedule = false,
}: ParticipationsTableProps): React.ReactElement {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('startedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

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
    return participations
      .filter((p) => !q || p.scheduleName.toLowerCase().includes(q))
      .sort((a, b) => {
        let cmp = 0
        if (sortKey === 'scheduleName') {
          cmp = a.scheduleName.localeCompare(b.scheduleName)
        } else if (sortKey === 'status') {
          cmp = a.status.localeCompare(b.status)
        } else if (sortKey === 'progress') {
          cmp = a.runsCompleted / (a.totalRuns || 1) - b.runsCompleted / (b.totalRuns || 1)
        } else if (sortKey === 'startedAt') {
          cmp = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [participations, search, sortKey, sortDir])

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Search training…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-sm sm:w-56"
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">User</TableHead>
              {!hideSchedule && (
                <SortHead
                  label="Schedule"
                  sortKey="scheduleName"
                  current={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
              )}
              <SortHead
                label="Status"
                sortKey="status"
                current={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortHead
                label="Progress"
                sortKey="progress"
                current={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortHead
                label="Started"
                sortKey="startedAt"
                current={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="hidden sm:table-cell"
              />
              <TableHead className="hidden md:table-cell">Finished</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={hideSchedule ? 5 : 6}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  No training sessions match your search.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() =>
                    void navigate({
                      to: '/app/participations/$participationId',
                      params: { participationId: String(p.id) },
                    })
                  }
                >
                  <TableCell>
                    <UserAvatar username={p.user.username} avatarUrl={p.user.avatarUrl} />
                  </TableCell>
                  {!hideSchedule && (
                    <TableCell className="font-medium">
                      <Link
                        to="/app/schedules/$scheduleId"
                        params={{ scheduleId: String(p.scheduleId) }}
                        className="hover:underline"
                        title={p.scheduleName}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {p.scheduleName.length > 8 ? `${p.scheduleName.slice(0, 8)}…` : p.scheduleName}
                      </Link>
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {STATUS_LABELS[p.status as ParticipationStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ProgressBar
                      value={65}
                      tooltipLabel="3/5 Runs, 67% completed"
                      className="w-28"
                    />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {formatDate(p.startedAt)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {p.completedAt ? formatDate(p.completedAt) : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
