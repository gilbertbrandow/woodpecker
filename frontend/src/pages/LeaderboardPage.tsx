import * as React from 'react'
import { useState, useEffect, useCallback } from 'react'
import { PageWrapper } from '../components/PageWrapper'
import { useAuth } from '../context/auth'
import { api, type LeaderboardRun, type WeeklyLeaderboardRow, type ScheduleSummary } from '../lib/api'
import { RunLeaderboard } from '../components/leaderboard/RunLeaderboard'
import { WeeklyLeaderboard } from '../components/leaderboard/WeeklyLeaderboard'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'

export function LeaderboardPage(): React.ReactElement | null {
  const { user } = useAuth()

  const [schedules, setSchedules] = useState<ScheduleSummary[]>([])
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | undefined>(undefined)

  const [runRows, setRunRows] = useState<LeaderboardRun[] | null>(null)
  const [weeklyRows, setWeeklyRows] = useState<WeeklyLeaderboardRow[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.schedules
      .list({ lockedOnly: true, pageSize: 200 })
      .then((res) => setSchedules(res.items))
      .catch(() => {})
  }, [])

  const loadBoards = useCallback((scheduleId: number | undefined) => {
    setLoading(true)
    Promise.all([
      api.leaderboard.list(scheduleId),
      api.leaderboard.getWeekly(scheduleId),
    ])
      .then(([runs, weekly]) => {
        setRunRows(runs)
        setWeeklyRows(weekly)
      })
      .catch(() => {
        setRunRows([])
        setWeeklyRows([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadBoards(selectedScheduleId)
  }, [selectedScheduleId, loadBoards])

  if (!user) return null

  return (
    <PageWrapper className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-base font-semibold">Leaderboards</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Schedule</span>
          <Select
            value={selectedScheduleId !== undefined ? String(selectedScheduleId) : 'all'}
            onValueChange={(v) =>
              setSelectedScheduleId(v === 'all' ? undefined : Number(v))
            }
          >
            <SelectTrigger size="sm" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All schedules</SelectItem>
              {schedules.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b pb-2.5">
          <span className="text-sm font-medium">Weekly board</span>
          <span className="hidden text-xs text-muted-foreground sm:block">
            One row per user, rolling 7 days
          </span>
        </div>
        <WeeklyLeaderboard
          rows={weeklyRows ?? []}
          currentUserDisplayName={user.displayName}
          loading={loading}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b pb-2.5">
          <span className="text-sm font-medium">Run board</span>
          <span className="hidden text-xs text-muted-foreground sm:block">
            One row per run
          </span>
        </div>
        <RunLeaderboard
          rows={runRows ?? []}
          scheduleId={selectedScheduleId}
          allowFiltering
          loading={loading}
        />
      </section>
    </PageWrapper>
  )
}
