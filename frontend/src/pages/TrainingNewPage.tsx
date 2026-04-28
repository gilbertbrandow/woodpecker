import * as React from 'react'
import { useState, useEffect } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/auth'
import { api, type ScheduleSummary } from '../lib/api'
import { UserAvatar } from '../components/UserAvatar'
import { formatDuration } from '../components/schedules/DurationInput'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '../components/ui/breadcrumb'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

export function TrainingNewPage(): React.ReactElement | null {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([])
  const [schedulesLoading, setSchedulesLoading] = useState(true)
  const [enrollingId, setEnrollingId] = useState<number | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, loading, navigate])

  useEffect(() => {
    if (!user) return
    api.schedules
      .list()
      .then((all) => setSchedules(all.filter((s) => s.status === 'locked')))
      .catch(() => toast.error('Failed to load schedules', { description: 'Could not fetch schedules.' }))
      .finally(() => setSchedulesLoading(false))
  }, [user])

  if (loading || !user) return null

  const handleEnroll = async (schedule: ScheduleSummary): Promise<void> => {
    setEnrollingId(schedule.id)
    try {
      const training = await api.training.create(schedule.id)
      void navigate({ to: '/app/training/$trainingId', params: { trainingId: String(training.id) } })
    } catch {
      toast.error('Failed to start training', { description: 'Could not enrol in this schedule.' })
      setEnrollingId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/app/training">Training</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New Training</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6">
        <h1 className="text-xl font-semibold">New Training</h1>
        <p className="mt-1 text-sm text-muted-foreground">Select a schedule to start training.</p>
      </div>

      {schedulesLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-muted-foreground">No locked schedules available.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Creator</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Subset</TableHead>
                <TableHead className="text-right">Runs</TableHead>
                <TableHead className="hidden md:table-cell text-right">Duration</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow
                  key={schedule.id}
                  className={enrollingId === null ? 'cursor-pointer' : 'opacity-60'}
                  onClick={() => enrollingId === null && void handleEnroll(schedule)}
                >
                  <TableCell>
                    <UserAvatar username={schedule.createdBy.username} avatarUrl={schedule.createdBy.avatarUrl} />
                  </TableCell>
                  <TableCell className="font-medium">{schedule.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {schedule.subsetName}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {schedule.runCount > 0 ? schedule.runCount : '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">
                    {schedule.totalHours > 0 ? formatDuration(schedule.totalHours) : '—'}
                  </TableCell>
                  <TableCell>
                    {enrollingId === schedule.id && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
