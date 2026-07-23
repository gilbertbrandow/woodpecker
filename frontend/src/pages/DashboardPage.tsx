import * as React from 'react'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Swords, BookOpenText } from 'lucide-react'
import { dashboardRoute } from '../router'
import { api, type DashboardData, type DashboardStatusCard, type DashboardPrimaryAction, type DashboardRunAccuracy } from '../lib/api'
import { PageWrapper } from '../components/PageWrapper'
import { TrainingProgressCard } from '../components/TrainingProgressCard'
import { DashboardLeaderboard } from '../components/dashboard/DashboardLeaderboard'
import { TrainingRunPicker } from '../components/dashboard/TrainingRunPicker'
import { StatusBadge, trainingStateToStatusValue } from '../components/StatusBadge'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { ChartContainer, ChartTooltip, type ChartConfig } from '../components/ui/chart'
import { cn, formatSolveTimeMs } from '../lib/utils'

const ACCURACY_CONFIG: ChartConfig = {
  value: { label: 'Accuracy %', color: 'hsl(var(--chart-1))' },
  trend: { label: 'Trend', color: 'hsl(var(--chart-2))' },
}

type AccuracyPoint = { label: string; value: number; trend: number | null; completed: boolean; inProgress: boolean }

function buildAccuracyPoints(runsAccuracy: DashboardRunAccuracy[]): AccuracyPoint[] {
  return runsAccuracy.map((r) => {
    const label = `Run ${r.runIndex + 1}`
    if (r.accuracyPct === null) return { label, value: 0, trend: null, completed: false, inProgress: false }
    if (r.inProgress) return { label, value: r.accuracyPct, trend: null, completed: false, inProgress: true }
    return { label, value: r.accuracyPct, trend: r.accuracyPct, completed: true, inProgress: false }
  })
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  if (days >= 1) return `${days}d${hours > 0 ? ` ${hours}h` : ''}`
  const mins = Math.floor((totalSeconds % 3600) / 60)
  if (hours >= 1) return `${hours}h${mins > 0 ? ` ${mins}m` : ''}`
  if (mins >= 1) return `${mins}m`
  return `${totalSeconds % 60}s`
}

function formatSolveTimeDelta(ms: number): string {
  const sign = ms > 0 ? '+' : ms < 0 ? '-' : ''
  const abs = Math.abs(ms)
  const totalSecs = Math.floor(abs / 1000)
  const m = Math.floor(totalSecs / 60)
  const s = totalSecs % 60
  return `${sign}${m}:${String(s).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Status card copy
// ---------------------------------------------------------------------------

function statusCardTitle(card: DashboardStatusCard): string {
  switch (card.state) {
    case 'training_completed':          return 'Training completed'
    case 'training_aborted':            return 'Training aborted'
    case 'run_completed':               return `Run #${(card.runIndex ?? 0) + 1}`
    case 'not_started':                 return 'Ready to start'
    case 'active_run_ahead':
    case 'active_run_on_track':
    case 'active_run_behind':
    case 'active_run_overdue':          return `Run #${(card.runIndex ?? 0) + 1}`
    case 'scheduled_break':             return 'On a break'
    case 'overdue_to_start_next_run':   return `Ready for Run #${(card.nextRunIndex ?? 0) + 1}`
  }
}

function statusCardBody(card: DashboardStatusCard): string {
  const runNum = (card.runIndex ?? 0) + 1
  const totalRuns = card.totalRuns ?? 0
  const resolved = card.resolvedCount ?? 0
  const total = card.totalItems ?? 0
  const before = card.puzzlesToSolveBeforeTomorrow ?? 0
  const nextRunNum = (card.nextRunIndex ?? 0) + 1

  switch (card.state) {
    case 'not_started':
      return `You haven't started yet. Work your way through all the puzzles in each of the ${totalRuns} run${totalRuns !== 1 ? 's' : ''} to complete your training.`
    case 'active_run_ahead':
      return `You're on Run ${runNum} of ${totalRuns}. You've resolved ${resolved} of ${total} puzzles and you're ahead of pace — great work.`
    case 'active_run_on_track':
      return `You're on Run ${runNum} of ${totalRuns}. You've resolved ${resolved} of ${total} puzzles and you're right on schedule.`
    case 'active_run_behind':
      return `You're on Run ${runNum} of ${totalRuns}. You've resolved ${resolved} of ${total} puzzles. You're a little behind — try to get ${before} more done today to stay on track.`
    case 'active_run_overdue':
      return `You're on Run ${runNum} of ${totalRuns}. You've resolved ${resolved} of ${total} puzzles. This run is overdue — keep pushing to finish.`
    case 'scheduled_break': {
      const completedRunNum = card.nextRunIndex ?? 1
      return `Run ${completedRunNum} of ${totalRuns} is done. You're on a scheduled break before Run ${nextRunNum}. Rest up — you have ${formatMs(card.breakRemainingMs ?? 0)} remaining.`
    }
    case 'overdue_to_start_next_run':
      return `Your break ended ${formatMs(card.elapsedSinceBreakEndMs ?? 0)} ago. Run ${nextRunNum} of ${totalRuns} is ready — jump back in whenever you're ready.`
    case 'run_completed':
      return `Run ${runNum} of ${totalRuns} is complete. Well done — start your next run after your scheduled break.`
    case 'training_completed':
      return `You've finished all ${totalRuns} run${totalRuns !== 1 ? 's' : ''}. Your training is complete — great job seeing it through.`
    case 'training_aborted':
      return 'This training was aborted. You can start a new training from the same schedule if you want to try again.'
  }
}

function statusCardBadge(state: DashboardStatusCard['state']) {
  return trainingStateToStatusValue(state === 'run_completed' ? 'completed'
    : state === 'training_completed' ? 'completed'
    : state === 'training_aborted' ? 'aborted'
    : state === 'not_started' ? 'not_started'
    : state)
}

function primaryActionLabel(action: DashboardPrimaryAction): string {
  if (action.type === 'continue_run') return 'Continue run'
  return `Start Run ${action.runIndex + 1}`
}

// ---------------------------------------------------------------------------
// Status card component
// ---------------------------------------------------------------------------

function StatusCard({
  card,
  onStartRun,
  startingRun,
}: {
  card: DashboardStatusCard
  onStartRun: (trainingId: number, runIndex: number) => void
  startingRun: boolean
}): React.ReactElement {
  const navigate = useNavigate()
  const title = statusCardTitle(card)
  const body = statusCardBody(card)
  const action = card.primaryAction

  function handleAction(): void {
    if (!action) return
    if (action.type === 'continue_run') {
      void navigate({ to: '/app/runs/$runId/solve', params: { runId: String(action.runId) } })
    } else {
      onStartRun(action.trainingId, action.runIndex)
    }
  }

  return (
    <div className="rounded-md border bg-card px-5 py-4 h-full flex flex-col gap-4 min-h-40">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-sm text-foreground">{title}</p>
        <StatusBadge status={statusCardBadge(card.state)} />
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1">{body}</p>
      {action && (
        <div>
          <Button
            size="sm"
            disabled={startingRun}
            onClick={handleAction}
            className="h-7 px-3 text-xs bg-foreground text-background hover:bg-foreground/90"
          >
            {startingRun && action.type === 'start_run' ? 'Starting…' : primaryActionLabel(action)}
          </Button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Metric card component
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  delta,
  deltaLabel,
  lowerIsBetter,
}: {
  label: string
  value: string
  delta: string | null
  deltaLabel?: string
  lowerIsBetter?: boolean
}): React.ReactElement {
  const deltaNum = delta !== null ? parseFloat(delta.replace(/[^0-9.-]/g, '')) : null
  const positive = deltaNum !== null && deltaNum > 0
  const negative = deltaNum !== null && deltaNum < 0
  const deltaGood = lowerIsBetter ? negative : positive
  const deltaBad = lowerIsBetter ? positive : negative
  const deltaColor = deltaGood
    ? 'text-green-600 dark:text-green-400'
    : deltaBad
      ? 'text-red-600 dark:text-red-400'
      : 'text-muted-foreground'

  return (
    <div className="rounded-md border bg-card px-4 py-3 h-full flex flex-col justify-between gap-3">
      <div>
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
      </div>
      {delta !== null && (
        <p className={cn('text-xs tabular-nums', deltaColor)}>
          {delta}{deltaLabel ? ` ${deltaLabel}` : ''}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Accuracy chart
// ---------------------------------------------------------------------------

function AccuracyChart({ runsAccuracy }: { runsAccuracy: DashboardRunAccuracy[] }): React.ReactElement {
  const points = useMemo(() => buildAccuracyPoints(runsAccuracy), [runsAccuracy])
  const completedCount = points.filter((p) => p.completed).length

  return (
    <div className="flex-1 min-h-0 min-h-48 mt-4 rounded-md border p-4 flex flex-col">
      <div className="mb-4">
        <p className="text-sm font-semibold">Accuracy per run</p>
        <p className="mt-1 text-xs text-muted-foreground">% solved on first attempt</p>
      </div>
      <ChartContainer config={ACCURACY_CONFIG} className="flex-1 min-h-0 min-w-0 w-full">
        <ComposedChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={1} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
          <YAxis hide domain={[0, 100]} />
          <ChartTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const point = payload[0]?.payload as AccuracyPoint
              if (!point.completed && !point.inProgress) return null
              return (
                <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
                  <p className="font-medium">{point.label}{point.inProgress ? ' (in progress)' : ''}</p>
                  <p className="text-muted-foreground">{point.value.toFixed(1)}%</p>
                </div>
              )
            }}
          />
          <Bar
            dataKey="value"
            isAnimationActive={false}
            shape={(props: unknown) => {
              const { x, y, width, height, inProgress } = props as { x: number; y: number; width: number; height: number; inProgress: boolean }
              return <rect x={x} y={y} width={width} height={Math.max(0, height)} fill="var(--color-value)" fillOpacity={inProgress ? 0.45 : 1} rx={2} ry={2} />
            }}
          />
          {completedCount >= 2 && (
            <Line
              dataKey="trend"
              stroke="var(--color-trend)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton loading state
// ---------------------------------------------------------------------------

function DashboardSkeleton(): React.ReactElement {
  return (
    <PageWrapper className="flex flex-col gap-6 max-w-none flex-1 min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch xl:gap-8 flex-1 min-h-0">
        <div className="flex flex-col gap-4 min-w-0 flex-1">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="sm:col-span-2 min-h-40 rounded-md" />
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-4">
              <Skeleton className="h-24 rounded-md" />
              <Skeleton className="h-24 rounded-md" />
            </div>
          </div>
          <Skeleton className="flex-1 min-h-72 rounded-md" />
        </div>
        <div className="w-full xl:w-[40rem] shrink-0 flex flex-col gap-4">
          <Skeleton className="flex-1 min-h-48 rounded-md" />
          <Skeleton className="min-h-48 rounded-md" />
        </div>
      </div>
    </PageWrapper>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-6 text-center max-w-sm">
      <div className="space-y-2">
        <p className="text-base font-semibold">No active trainings</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Start a training to track your progress here. Pick an existing schedule with a ready-made puzzle set, or build your own subset and schedule from scratch.
        </p>
      </div>
      <div className="flex gap-2">
        <Link to="/app/training/new">
          <Button size="sm"><Swords className="h-3.5 w-3.5" />Start training</Button>
        </Link>
        <Link to="/app/guide">
          <Button variant="outline" size="sm"><BookOpenText className="h-3.5 w-3.5" />How does it work?</Button>
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function DashboardPage(): React.ReactElement {
  const navigate = useNavigate()
  const search = dashboardRoute.useSearch()

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [startingRun, setStartingRun] = useState(false)
  const [pickerTrainingId, setPickerTrainingId] = useState<number | null>(null)
  const [pickerRunIndex, setPickerRunIndex] = useState<number | null>(null)

  const fetchDashboard = useCallback(
    (trainingId?: number, runIndex?: number) => {
      setLoading(true)
      api.dashboard
        .get({ trainingId, runIndex })
        .then((d) => {
          setData(d)
          setPickerTrainingId(d.selectedTrainingId)
          setPickerRunIndex(d.selectedRunIndex)
          // Replace URL with resolved params
          if (d.selectedTrainingId !== null && d.selectedRunIndex !== null) {
            void navigate({
              to: '/app',
              search: { trainingId: d.selectedTrainingId, runIndex: d.selectedRunIndex },
              replace: true,
            })
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    },
    [navigate],
  )

  // Initial load and re-fetch when URL search params change externally (e.g. browser back)
  useEffect(() => {
    fetchDashboard(search.trainingId, search.runIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStartRun = async (trainingId: number, runIndex: number): Promise<void> => {
    if (startingRun) return
    setStartingRun(true)
    try {
      const run = await api.runs.start(trainingId, runIndex)
      void navigate({ to: '/app/runs/$runId/solve', params: { runId: String(run.id) } })
    } catch {
      setStartingRun(false)
    }
  }

  if (loading && !data) {
    return <DashboardSkeleton />
  }

  if (!data || data.trainings.length === 0) {
    return (
      <PageWrapper className="flex flex-col items-center justify-center flex-1">
        <EmptyState />
      </PageWrapper>
    )
  }

  const { selectedTrainingId, selectedRunIndex, trainings, runSlots, statusCard, metricCards, runsAccuracy, progressCard } = data
  const isVirtualRun = selectedRunIndex === 0 && runSlots.find((s) => s.runIndex === 0)?.runId === null

  // Metric card display values
  const accuracyValue = isVirtualRun
    ? 'N/A'
    : metricCards?.accuracy.valuePct !== null
      ? `${metricCards?.accuracy.valuePct?.toFixed(1)}%`
      : '0%'
  const accuracyDelta =
    !isVirtualRun && metricCards?.accuracy.deltaPct !== null && metricCards?.accuracy.deltaPct !== undefined
      ? (metricCards.accuracy.deltaPct >= 0 ? '+' : '') + metricCards.accuracy.deltaPct.toFixed(1) + '%'
      : null

  const solveTimeValue = isVirtualRun
    ? 'N/A'
    : metricCards?.avgSolveTime.valueMs !== null && metricCards?.avgSolveTime.valueMs !== undefined
      ? formatSolveTimeMs(metricCards.avgSolveTime.valueMs)
      : '0:00'
  const solveTimeDelta =
    !isVirtualRun && metricCards?.avgSolveTime.deltaMs !== null && metricCards?.avgSolveTime.deltaMs !== undefined
      ? formatSolveTimeDelta(metricCards.avgSolveTime.deltaMs)
      : null

  return (
    <PageWrapper className="flex flex-col gap-6 max-w-none flex-1 min-h-0">
      {/* Header row: title + selectors */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-semibold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">Viewing</span>
          <TrainingRunPicker
            trainings={trainings}
            runSlots={runSlots}
            selectedTrainingId={pickerTrainingId}
            selectedRunIndex={pickerRunIndex}
            onSelect={(trainingId, runIndex) => {
              setPickerTrainingId(trainingId)
              setPickerRunIndex(runIndex ?? null)
              fetchDashboard(trainingId, runIndex)
            }}
          />
        </div>
      </div>

      {/* Main layout: content + leaderboard rail */}
      <div className={cn('flex flex-col gap-6 xl:flex-row xl:items-stretch xl:gap-8 flex-1 min-h-0 transition-opacity duration-150', loading && 'opacity-50 pointer-events-none')}>
        {/* Left: cards */}
        <div className="flex flex-col gap-4 min-w-0 flex-1">
          {/* Top: status card (2/3 width) + stacked metric cards (1/3 width) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {statusCard && (
              <div className="sm:col-span-2">
                <StatusCard
                  card={statusCard}
                  onStartRun={(tid, ri) => { void handleStartRun(tid, ri) }}
                  startingRun={startingRun}
                />
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-4">
              <MetricCard
                label="Accuracy"
                value={accuracyValue}
                delta={accuracyDelta}
                deltaLabel="vs prev run"
              />
              <MetricCard
                label="Avg solve time"
                value={solveTimeValue}
                delta={solveTimeDelta}
                deltaLabel="vs prev run"
                lowerIsBetter
              />
            </div>
          </div>

          {/* Training progress card */}
          {progressCard && <TrainingProgressCard progress={progressCard} grow />}
        </div>

        {/* Right rail: leaderboard + accuracy chart */}
        {selectedTrainingId !== null && selectedRunIndex !== null && (
          <div className="w-full xl:w-[40rem] shrink-0 flex flex-col">
            <DashboardLeaderboard
              trainingId={selectedTrainingId}
              runIndex={selectedRunIndex}
            />
            {runsAccuracy.length > 0 && (
              <AccuracyChart runsAccuracy={runsAccuracy} />
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
