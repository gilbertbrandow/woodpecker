import * as React from 'react'
import { useState, useEffect } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuth } from '../context/auth'
import { api, type Subset } from '../lib/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '../components/ui/breadcrumb'

export function ScheduleNewPage(): React.ReactElement | null {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [subsetId, setSubsetId] = useState('')
  const [subsets, setSubsets] = useState<Subset[]>([])
  const [subsetsLoading, setSubsetsLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, loading, navigate])

  useEffect(() => {
    if (!user) return
    api.subsets
      .list()
      .then((all) => {
        const locked = all.filter((s) => s.status === 'locked' && s.ownedBy.username === user.username)
        setSubsets(locked)
      })
      .catch(() => toast.error('Failed to load subsets', { description: 'Could not fetch subsets.' }))
      .finally(() => setSubsetsLoading(false))
  }, [user])

  if (loading || !user) return null

  const canSubmit = name.trim().length > 0 && subsetId !== '' && !submitting

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const schedule = await api.schedules.create(name.trim(), parseInt(subsetId, 10))
      void navigate({ to: '/app/schedules/$scheduleId', params: { scheduleId: String(schedule.id) } })
    } catch {
      toast.error('Failed to create schedule', { description: 'Please try again.' })
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/app">Schedules</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New schedule</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="mb-6 text-xl font-semibold">New schedule</h1>

      {!subsetsLoading && subsets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You have no locked subsets.{' '}
          <Link to="/app" className="underline hover:text-foreground">
            Lock a subset
          </Link>{' '}
          before creating a schedule.
        </p>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
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
            <label className="text-sm font-medium" htmlFor="schedule-subset">
              Subset
            </label>
            {subsetsLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <select
                id="schedule-subset"
                value={subsetId}
                onChange={(e) => setSubsetId(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select a subset…</option>
                {subsets.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            )}
          </div>

          <Button type="submit" disabled={!canSubmit} className="mt-2">
            {submitting ? 'Creating…' : 'Create'}
          </Button>
        </form>
      )}
    </div>
  )
}
