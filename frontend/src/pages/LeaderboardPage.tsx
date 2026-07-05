import * as React from 'react'
import { useState, useMemo } from 'react'
import { PageWrapper } from '../components/PageWrapper'
import { useAuth } from '../context/auth'
import { useRunLeaderboard } from '../hooks/useRunLeaderboard'
import { useWeeklyLeaderboard } from '../hooks/useWeeklyLeaderboard'
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
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | undefined>(undefined)

  const { rows: runRows, loading: runLoading } = useRunLeaderboard({ scheduleId: selectedScheduleId })
  const { rows: weeklyRows, loading: weeklyLoading } = useWeeklyLeaderboard({ scheduleId: selectedScheduleId })

  const scheduleOptions = useMemo(
    () =>
      Array.from(new Map(runRows.map((r) => [r.scheduleId, r.scheduleName])).entries()).map(
        ([id, name]) => ({ id, name }),
      ),
    [runRows],
  )

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
              {scheduleOptions.map((s) => (
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
          tableId="weekly"
          rows={weeklyRows}
          currentUserDisplayName={user.displayName}
          loading={weeklyLoading}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b pb-2.5">
          <span className="flex items-center gap-1.5 text-sm font-medium">Run board</span>
          <span className="hidden text-xs text-muted-foreground sm:block">
            One row per run
          </span>
        </div>
        <RunLeaderboard
          tableId="run"
          rows={runRows}
          scheduleId={selectedScheduleId}
          allowFiltering
          loading={runLoading}
        />
      </section>
    </PageWrapper>
  )
}
