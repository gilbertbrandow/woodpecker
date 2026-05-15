import * as React from 'react'
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/auth'
import { api, type ScheduleSummary } from '../lib/api'
import { SchedulesTable } from '../components/schedules/SchedulesTable'

export function SchedulesListPage(): React.ReactElement | null {
  const { user } = useAuth()
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    api.schedules
      .list()
      .then(setSchedules)
      .catch(() => toast.error('Failed to load schedules', { description: 'Could not fetch schedules.' }))
      .finally(() => setLoading(false))
  }, [user])

  const handleDelete = async (schedule: ScheduleSummary): Promise<void> => {
    setDeletingId(schedule.id)
    try {
      await api.schedules.delete(schedule.id)
      setSchedules((prev) => prev.filter((s) => s.id !== schedule.id))
      toast('Schedule deleted', { description: `"${schedule.name}" has been removed.` })
    } catch {
      toast.error('Failed to delete schedule', { description: 'Please try again.' })
    } finally {
      setDeletingId(null)
    }
  }

  if (!user) return null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Schedules</h1>
        <Link
          to="/app/schedules/new"
          className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New schedule
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-muted-foreground">No schedules yet. Create one to get started.</p>
      ) : (
        <SchedulesTable
          schedules={schedules}
          currentUserId={user.id}
          deletingId={deletingId}
          onDelete={(s) => void handleDelete(s)}
        />
      )}
    </div>
  )
}
