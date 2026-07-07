import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { useAuth } from '../context/auth'
import { api, type ScheduleSummary } from '../lib/api'
import { Button } from '../components/ui/button'
import { UserAvatar } from '../components/UserAvatar'
import { DataTable } from '../components/DataTable'
import { formatDuration } from '../components/schedules/DurationInput'
import { CONCEPT_ICONS, DATA_ICONS } from '../lib/icons'

export function TrainingNewPage(): React.ReactElement | null {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([])
  const [schedulesLoading, setSchedulesLoading] = useState(true)
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleSummary | null>(null)
  const [enrolling, setEnrolling] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, loading, navigate])

  useEffect(() => {
    if (!user) return
    api.schedules
      .list({ lockedOnly: true })
      .then((r) => setSchedules(r.items))
      .catch(() => {})
      .finally(() => setSchedulesLoading(false))
  }, [user])

  if (loading || !user) return null

  const handleEnroll = async (): Promise<void> => {
    if (!selectedSchedule) return
    setEnrolling(true)
    try {
      const training = await api.training.create(selectedSchedule.id)
      void navigate({ to: '/app/training/$trainingId', params: { trainingId: String(training.id) } })
    } catch {
      setEnrolling(false)
    }
  }

  const selectedId = selectedSchedule?.id ?? null

  const columns: ColumnDef<ScheduleSummary>[] = useMemo(
    () => [
      {
        id: 'select',
        header: 'Selected',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="h-4 w-4 shrink-0 rounded-full border border-primary flex items-center justify-center">
            {row.original.id === selectedId && (
              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
            )}
          </div>
        ),
      },
      {
        id: 'creator',
        header: 'Creator',
        meta: { icon: DATA_ICONS.user },
        enableSorting: false,
        cell: ({ row }) => (
          <UserAvatar
            displayName={row.original.createdBy.displayName}
            avatarUrl={row.original.createdBy.avatarUrl}
          />
        ),
      },
      {
        accessorKey: 'name',
        header: 'Name',
        meta: { icon: DATA_ICONS.name },
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: 'subsetName',
        header: 'Subset',
        meta: { icon: CONCEPT_ICONS.Subset },
        accessorFn: (row) => row.subsetName,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.subsetName}</span>
        ),
      },
      {
        id: 'runCount',
        header: 'Runs',
        meta: { icon: CONCEPT_ICONS.Run },
        accessorFn: (row) => row.runCount,
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.original.runCount > 0 ? row.original.runCount : '—'}
          </span>
        ),
      },
      {
        id: 'duration',
        header: 'Duration',
        meta: { icon: DATA_ICONS.time },
        accessorFn: (row) => row.totalHours,
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.original.totalHours > 0 ? formatDuration(row.original.totalHours) : '—'}
          </span>
        ),
      },
    ],
    [selectedId],
  )

  return (
    <PageWrapper>

      <div className="mb-6">
        <h1 className="text-xl font-semibold">New Training</h1>
        <p className="mt-1 text-sm text-muted-foreground">Select a schedule to start training.</p>
      </div>

      {schedulesLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-muted-foreground">No locked schedules available.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <DataTable
            tableId={false}
            columns={columns}
            data={schedules}
            globalFilterPlaceholder="Search schedules…"
            pageSize={10}
            onRowClick={(schedule) => setSelectedSchedule(selectedSchedule?.id === schedule.id ? null : schedule)}
            getRowClassName={(row) => row.id === selectedId ? 'bg-muted' : ''}
            emptyMessage="No locked schedules available."
          />
          <Button
            className="self-start"
            disabled={selectedSchedule === null || enrolling}
            onClick={() => void handleEnroll()}
          >
            {enrolling ? 'Starting…' : 'Enroll in training'}
          </Button>
        </div>
      )}
    </PageWrapper>
  )
}
