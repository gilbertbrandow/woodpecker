import * as React from 'react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../context/auth'
import { api, type Subset } from '../lib/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { SubsetsTable } from '../components/subsets/SubsetsTable'

export function ScheduleNewPage(): React.ReactElement | null {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [selectedSubset, setSelectedSubset] = useState<Subset | null>(null)
  const [subsetsTotal, setSubsetsTotal] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  React.useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, loading, navigate])

  if (loading || !user) return null

  const canSubmit = name.trim().length > 0 && selectedSubset !== null && !submitting

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit || selectedSubset === null) return
    setSubmitting(true)
    try {
      const schedule = await api.schedules.create(name.trim(), selectedSubset.id)
      void navigate({ to: '/app/schedules/$scheduleId', params: { scheduleId: String(schedule.id) } })
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-xl font-semibold">New schedule</h1>

      {subsetsTotal === 0 ? (
        <p className="text-sm text-muted-foreground">
          No locked subsets available. Subsets must be locked before they can be used in a schedule.
        </p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void handleSubmit() }} className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="schedule-name">
              Schedule name
            </label>
            <Input
              id="schedule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 5-cycle spaced repetition"
              maxLength={100}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Subset</label>
            <SubsetsTable
              selectedId={selectedSubset?.id ?? null}
              onSelect={(subset) => setSelectedSubset(subset)}
              onCountChange={(total) => setSubsetsTotal(total)}
            />
          </div>

          <Button type="submit" disabled={!canSubmit} className="self-start">
            {submitting ? 'Creating…' : 'Create schedule'}
          </Button>
        </form>
      )}
    </div>
  )
}
