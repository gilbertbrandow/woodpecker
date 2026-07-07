import * as React from 'react'
import { useState, useMemo } from 'react'
import { Activity, CheckCircle2, XCircle } from 'lucide-react'
import { PageWrapper } from '../components/PageWrapper'
import { useAuth } from '../context/auth'
import { useRunLeaderboard } from '../hooks/useRunLeaderboard'
import { useWeeklyLeaderboard } from '../hooks/useWeeklyLeaderboard'
import { RunLeaderboard } from '../components/leaderboard/RunLeaderboard'
import { WeeklyLeaderboard } from '../components/leaderboard/WeeklyLeaderboard'
import { UserSelector } from '../components/UserSelector'
import { MultiSelectFilter } from '../components/ui/multi-select-filter'
import type { SelectableUser } from '../lib/api'

const RUN_STATUS_OPTIONS = [
  { value: 'active',    label: 'Active',    icon: <Activity className="h-3.5 w-3.5 text-blue-500" /> },
  { value: 'completed', label: 'Completed', icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> },
  { value: 'aborted',   label: 'Aborted',   icon: <XCircle className="h-3.5 w-3.5 text-red-600" /> },
]

export function LeaderboardPage(): React.ReactElement | null {
  const { user } = useAuth()

  const [weeklyScheduleIds, setWeeklyScheduleIds] = useState<string[]>([])
  const [weeklySelectedUsers, setWeeklySelectedUsers] = useState<SelectableUser[]>([])
  const [runSelectedUsers, setRunSelectedUsers] = useState<SelectableUser[]>([])
  const [runSelectedStatuses, setRunSelectedStatuses] = useState<string[]>([])

  const { rows: runRows, loading: runLoading } = useRunLeaderboard({})
  const { rows: weeklyRows, loading: weeklyLoading } = useWeeklyLeaderboard({
    scheduleIds: weeklyScheduleIds.length ? weeklyScheduleIds.map(Number) : undefined,
  })

  const scheduleOptions = useMemo(
    () =>
      Array.from(new Map(runRows.map((r) => [r.scheduleId, r.scheduleName])).entries()).map(
        ([id, name]) => ({ id, name }),
      ),
    [runRows],
  )

  const filteredWeeklyRows = useMemo(() => {
    if (weeklySelectedUsers.length === 0) return weeklyRows
    const ids = new Set(weeklySelectedUsers.map((u) => u.id))
    return weeklyRows.filter((r) => ids.has(r.userId))
  }, [weeklyRows, weeklySelectedUsers])

  const filteredRunRows = useMemo(() => {
    let r = runRows
    if (runSelectedUsers.length > 0) {
      const ids = new Set(runSelectedUsers.map((u) => u.id))
      r = r.filter((row) => ids.has(row.userId))
    }
    if (runSelectedStatuses.length > 0) {
      r = r.filter((row) => runSelectedStatuses.includes(row.status))
    }
    return r
  }, [runRows, runSelectedUsers, runSelectedStatuses])

  const weeklyFiltersSlot = (
    <>
      <MultiSelectFilter
        label="schedules"
        options={scheduleOptions.map((s) => ({ value: String(s.id), label: s.name }))}
        selected={weeklyScheduleIds}
        onChange={setWeeklyScheduleIds}
      />
      <UserSelector value={weeklySelectedUsers} onChange={setWeeklySelectedUsers} />
    </>
  )

  const runFiltersSlot = (
    <>
      <UserSelector value={runSelectedUsers} onChange={setRunSelectedUsers} />
      <MultiSelectFilter
        label="statuses"
        options={RUN_STATUS_OPTIONS}
        selected={runSelectedStatuses}
        onChange={setRunSelectedStatuses}
      />
    </>
  )

  if (!user) return null

  return (
    <PageWrapper className="flex flex-col gap-8">
      <h1 className="text-base font-semibold">Leaderboards</h1>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b pb-2.5">
          <span className="text-sm font-medium">Weekly board</span>
          <span className="hidden text-xs text-muted-foreground sm:block">
            One row per user, rolling 7 days
          </span>
        </div>
        <WeeklyLeaderboard
          tableId="weekly"
          rows={filteredWeeklyRows}
          currentUserId={user.id}
          loading={weeklyLoading}
          filtersSlot={weeklyFiltersSlot}
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
          rows={filteredRunRows}
          allowFiltering
          loading={runLoading}
          currentUserId={user.id}
          filtersSlot={runFiltersSlot}
        />
      </section>
    </PageWrapper>
  )
}
