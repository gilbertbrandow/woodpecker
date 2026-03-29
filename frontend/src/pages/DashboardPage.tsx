import * as React from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/auth'
import { api, type Subset, type ScheduleSummary, type AllParticipationSummary } from '../lib/api'
import { SubsetsTable } from '../components/subsets/SubsetsTable'
import { SchedulesTable } from '../components/schedules/SchedulesTable'
import { ParticipationsTable } from '../components/participations/ParticipationsTable'

export function DashboardPage(): React.ReactElement | null {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [subsets, setSubsets] = useState<Subset[]>([])
  const [subsetsLoading, setSubsetsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([])
  const [schedulesLoading, setSchedulesLoading] = useState(true)
  const [deletingScheduleId, setDeletingScheduleId] = useState<number | null>(null)
  const [participations, setParticipations] = useState<AllParticipationSummary[]>([])
  const [participationsLoading, setParticipationsLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, loading, navigate])

  useEffect(() => {
    if (!user) return
    api.subsets
      .list()
      .then(setSubsets)
      .catch(() => toast.error('Failed to load subsets', { description: 'Could not fetch subsets.' }))
      .finally(() => setSubsetsLoading(false))
  }, [user])

  useEffect(() => {
    if (!user) return
    api.schedules
      .list()
      .then(setSchedules)
      .catch(() => toast.error('Failed to load schedules', { description: 'Could not fetch schedules.' }))
      .finally(() => setSchedulesLoading(false))
  }, [user])

  useEffect(() => {
    if (!user) return
    api.participations
      .listAll()
      .then(setParticipations)
      .catch(() =>
        toast.error('Failed to load training', { description: 'Could not fetch your training sessions.' }),
      )
      .finally(() => setParticipationsLoading(false))
  }, [user])

  const handleDeleteSchedule = async (schedule: ScheduleSummary): Promise<void> => {
    setDeletingScheduleId(schedule.id)
    try {
      await api.schedules.delete(schedule.id)
      setSchedules((prev) => prev.filter((s) => s.id !== schedule.id))
      toast('Schedule deleted', { description: `"${schedule.name}" has been removed.` })
    } catch {
      toast.error('Failed to delete schedule', { description: 'Please try again.' })
    } finally {
      setDeletingScheduleId(null)
    }
  }

  const handleDelete = async (subset: Subset): Promise<void> => {
    setDeletingId(subset.id)
    try {
      await api.subsets.delete(subset.id)
      setSubsets((prev) => prev.filter((s) => s.id !== subset.id))
      toast('Subset deleted', { description: `"${subset.name}" has been removed.` })
    } catch {
      toast.error('Failed to delete subset', { description: 'Please try again.' })
    } finally {
      setDeletingId(null)
    }
  }

  if (loading || !user) return null

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h1 className="text-base font-semibold">Subsets</h1>
          <Link
            to="/app/subsets/new"
            className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New subset
          </Link>
        </div>

        <div className="p-6">
          {subsetsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : subsets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No subsets yet. Create one to get started.
            </p>
          ) : (
            <SubsetsTable
              subsets={subsets}
              currentUsername={user.username}
              deletingId={deletingId}
              onDelete={(s) => void handleDelete(s)}
            />
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h1 className="text-base font-semibold">Schedules</h1>
          <Link
            to="/app/schedules/new"
            className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New schedule
          </Link>
        </div>

        <div className="p-6">
          {schedulesLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No schedules yet. Create one to get started.
            </p>
          ) : (
            <SchedulesTable
              schedules={schedules}
              currentUsername={user.username}
              deletingId={deletingScheduleId}
              onDelete={(s) => void handleDeleteSchedule(s)}
            />
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h1 className="text-base font-semibold">Training</h1>
          <Link
            to="/app/participations/new"
            className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New training
          </Link>
        </div>

        <div className="p-6">
          {participationsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : participations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have not started any training yet.
            </p>
          ) : (
            <ParticipationsTable participations={participations} />
          )}
        </div>
      </div>
    </div>
  )
}
