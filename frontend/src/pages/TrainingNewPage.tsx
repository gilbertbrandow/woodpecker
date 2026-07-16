import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../context/auth'
import { api, type ScheduleSummary } from '../lib/api'
import { Button } from '../components/ui/button'
import { SchedulesTable } from '../components/schedules/SchedulesTable'

export function TrainingNewPage(): React.ReactElement | null {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleSummary | null>(null)
  const [enrolling, setEnrolling] = useState(false)

  React.useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, loading, navigate])

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

  return (
    <PageWrapper>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">New Training</h1>
        <p className="mt-1 text-sm text-muted-foreground">Select a schedule to start training.</p>
      </div>

      <div className="flex flex-col gap-6">
        <SchedulesTable
          selectedId={selectedSchedule?.id ?? null}
          onSelect={(schedule) => setSelectedSchedule(schedule)}
        />
        <Button
          className="self-start"
          disabled={selectedSchedule === null || enrolling}
          onClick={() => void handleEnroll()}
        >
          {enrolling ? 'Starting…' : 'Enroll in training'}
        </Button>
      </div>
    </PageWrapper>
  )
}
