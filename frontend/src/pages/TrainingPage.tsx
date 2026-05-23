import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ChevronDown, Play } from 'lucide-react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import { useAuth } from '../context/auth'
import {
  api,
  type Run,
  type Training,
  type TrainingState,
  type TrainingInsights,
} from '../lib/api'
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '../components/ui/chart'
import { useSetBreadcrumbTitle } from '../hooks/useSetBreadcrumbTitle'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '../components/ui/collapsible'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Button } from '../components/ui/button'
import { UserAvatar } from '../components/UserAvatar'
import { Badge } from '../components/ui/badge'
import { StatusBadge } from '../components/StatusBadge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { ProgressBar } from '../components/ProgressBar'
import { formatDuration } from '../components/schedules/DurationInput'
import { formatStartedAt } from '../lib/utils'

const PROGRESS_CONFIG: ChartConfig = {
  expected: { label: 'Expected', color: 'hsl(var(--muted-foreground))' },
  actual: { label: 'Actual', color: 'hsl(var(--chart-1))' },
}

const ACCURACY_CONFIG: ChartConfig = {
  bar: { label: 'Accuracy %', color: 'hsl(var(--chart-1))' },
  trend: { label: 'Trend', color: 'hsl(var(--chart-2))' },
}

const SOLVE_TIME_CONFIG: ChartConfig = {
  bar: { label: 'Avg solve time', color: 'hsl(var(--chart-1))' },
  trend: { label: 'Trend', color: 'hsl(var(--chart-2))' },
}

type ProgressPoint = { timeMs: number; expected: number | null; actual: number | null }
type RunStatPoint = { label: string; value: number; trend: number | null; completed: boolean; inProgress: boolean }

type Anchor = { timeMs: number; value: number }

function interpolateAnchors(anchors: Anchor[], timeMs: number): number | null {
  if (anchors.length === 0) return null
  if (timeMs <= anchors[0]!.timeMs) return anchors[0]!.value
  if (timeMs >= anchors[anchors.length - 1]!.timeMs) return anchors[anchors.length - 1]!.value
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]!
    const b = anchors[i + 1]!
    if (timeMs >= a.timeMs && timeMs <= b.timeMs) {
      const ratio = (timeMs - a.timeMs) / (b.timeMs - a.timeMs)
      return a.value + ratio * (b.value - a.value)
    }
  }
  return null
}

function buildProgressData(training: Training, runs: Run[]): ProgressPoint[] {
  const puzzleCount = training.schedule.subset.puzzleCount
  const startMs = new Date(training.startedAt).getTime()

  const expectedAnchors: Anchor[] = [{ timeMs: startMs, value: 0 }]
  let cursor = startMs
  for (const runDef of training.schedule.runs) {
    const runEndMs = cursor + runDef.target_hours * 3_600_000
    const prevValue = expectedAnchors[expectedAnchors.length - 1]!.value
    expectedAnchors.push({ timeMs: runEndMs, value: prevValue + puzzleCount })
    if (runDef.break_after_hours > 0) {
      const breakEndMs = runEndMs + runDef.break_after_hours * 3_600_000
      expectedAnchors.push({ timeMs: breakEndMs, value: prevValue + puzzleCount })
      cursor = breakEndMs
    } else {
      cursor = runEndMs
    }
  }

  const actualAnchors: Anchor[] = [{ timeMs: startMs, value: 0 }]
  let cumulative = 0
  let lastActualMs = startMs
  const sortedRuns = [...runs].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  for (const run of sortedRuns) {
    const runStartMs = new Date(run.startedAt).getTime()
    if (run.status === 'completed' && run.completedAt !== null) {
      actualAnchors.push({ timeMs: runStartMs, value: cumulative })
      cumulative += run.totalItems
      const runEndMs = new Date(run.completedAt).getTime()
      actualAnchors.push({ timeMs: runEndMs, value: cumulative })
      lastActualMs = runEndMs
    } else if (run.status === 'active') {
      actualAnchors.push({ timeMs: runStartMs, value: cumulative })
      const resolved = run.solvedCount + run.solvedWithRetriesCount + run.failedCount
      const nowMs = Date.now()
      actualAnchors.push({ timeMs: nowMs, value: cumulative + resolved })
      lastActualMs = nowMs
    }
  }

  const allTimes = Array.from(
    new Set([...expectedAnchors.map((a) => a.timeMs), ...actualAnchors.map((a) => a.timeMs)]),
  ).sort((a, b) => a - b)

  return allTimes.map((timeMs) => ({
    timeMs,
    expected: interpolateAnchors(expectedAnchors, timeMs),
    actual: timeMs <= lastActualMs ? interpolateAnchors(actualAnchors, timeMs) : null,
  }))
}

function buildProgressTicks(startMs: number, endMs: number): number[] {
  const totalMs = endMs - startMs
  const DAY_MS = 86_400_000
  const WEEK_MS = 7 * DAY_MS
  const interval = totalMs <= 14 * DAY_MS ? DAY_MS : totalMs <= 60 * DAY_MS ? WEEK_MS : 4 * WEEK_MS
  const ticks: number[] = []
  let t = startMs
  while (t <= endMs) {
    ticks.push(t)
    t += interval
  }
  if (ticks[ticks.length - 1] !== endMs) ticks.push(endMs)
  return ticks
}

function buildAccuracyData(runs: Run[], runCount: number): RunStatPoint[] {
  return Array.from({ length: runCount }, (_, i) => {
    const run = runs.find((r) => r.runIndex === i && r.status !== 'aborted') ?? null
    if (run === null) return { label: `Run ${i + 1}`, value: 0, trend: null, completed: false, inProgress: false }
    const resolved = run.solvedCount + run.solvedWithRetriesCount + run.failedCount
    const acc = resolved > 0 ? Math.round((run.solvedCount / resolved) * 1000) / 10 : 0
    if (run.status === 'active') {
      return { label: `Run ${i + 1}`, value: acc, trend: null, completed: false, inProgress: true }
    }
    return { label: `Run ${i + 1}`, value: acc, trend: acc, completed: true, inProgress: false }
  })
}

function buildSolveTimeData(insights: TrainingInsights | null, runs: Run[], runCount: number): RunStatPoint[] {
  return Array.from({ length: runCount }, (_, i) => {
    const entry = insights?.runs.find((r) => r.runIndex === i)
    const isActive = runs.some((r) => r.runIndex === i && r.status === 'active')
    if (entry === undefined || entry.avgSolveTimeMs === null) {
      return { label: `Run ${i + 1}`, value: 0, trend: null, completed: false, inProgress: isActive }
    }
    const secs = Math.round(entry.avgSolveTimeMs / 1000)
    if (isActive) {
      return { label: `Run ${i + 1}`, value: secs, trend: null, completed: false, inProgress: true }
    }
    return { label: `Run ${i + 1}`, value: secs, trend: secs, completed: true, inProgress: false }
  })
}

function formatTickDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatSolveSeconds(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const SLOT_STATUS_LABELS: Record<'not_started' | 'active' | 'completed' | 'aborted', string> = {
  not_started: 'Not started',
  active: 'In progress',
  completed: 'Completed',
  aborted: 'Aborted',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  if (days >= 1) return `${days} day${days !== 1 ? 's' : ''}${hours > 0 ? ` ${hours}h` : ''}`
  return `${hours} hour${hours !== 1 ? 's' : ''}`
}

function getRunForSlot(runs: Run[], slotIndex: number): Run | null {
  const slotRuns = runs.filter((r) => r.runIndex === slotIndex)
  const live = slotRuns.find((r) => r.status === 'active' || r.status === 'completed')
  if (live) return live
  return slotRuns.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null
}


export function TrainingPage(): React.ReactElement | null {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { trainingId } = useParams({ from: '/app/app-shell/training/$trainingId' })
  const id = parseInt(trainingId, 10)

  const [training, setTraining] = useState<Training | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [trainingState, setTrainingState] = useState<TrainingState | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('configure')
  const [runsOpen, setRunsOpen] = useState(true)
  const [progressOpen, setProgressOpen] = useState(true)
  const [statsOpen, setStatsOpen] = useState(true)
  const [showAbortDialog, setShowAbortDialog] = useState(false)
  const [aborting, setAborting] = useState(false)
  const [startingNewTraining, setStartingNewTraining] = useState(false)
  const [startingIndex, setStartingIndex] = useState<number | null>(null)
  const [insights, setInsights] = useState<TrainingInsights | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [chartsReady, setChartsReady] = useState(false)

  useSetBreadcrumbTitle(training?.schedule?.name)

  useEffect(() => {
    if (!authLoading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, authLoading, navigate])

  useEffect(() => { setChartsReady(true) }, [])

  useEffect(() => {
    if (activeTab !== 'insights' || insights !== null || !user || !training) return
    setInsightsLoading(true)
    api.training
      .getInsights(training.id)
      .then(setInsights)
      .catch(() => toast.error('Failed to load insights', { description: 'Could not fetch chart data.' }))
      .finally(() => setInsightsLoading(false))
  }, [activeTab, insights, user, training])

  useEffect(() => {
    if (!user) return
    Promise.all([api.training.get(id), api.runs.list(id), api.training.listMine()])
      .then(([t, fetchedRuns, myTrainings]) => {
        setTraining(t)
        setRuns(fetchedRuns)
        const match = myTrainings.find((mt) => mt.id === id)
        if (match) setTrainingState(match.trainingState)
      })
      .catch(() =>
        toast.error('Failed to load training', {
          description: 'Could not fetch training data.',
        }),
      )
      .finally(() => setPageLoading(false))
  }, [id, user])


  const handleRunStarted = (run: Run): void => {
    setRuns((prev) => [...prev, run])
  }

  const handleStartRun = async (runIndex: number): Promise<void> => {
    if (startingIndex !== null || !training) return
    setStartingIndex(runIndex)
    try {
      const newRun = await api.runs.start(training.id, runIndex)
      handleRunStarted(newRun)
      void navigate({
        to: '/app/runs/$runId/solve',
        params: { runId: String(newRun.id) },
      })
    } catch {
      toast.error('Failed to start run', { description: 'Please try again.' })
      setStartingIndex(null)
    }
  }

  const handleAbortTraining = async (): Promise<void> => {
    if (!training || aborting) return
    setAborting(true)
    try {
      const updated = await api.training.abort(training.id)
      setTraining(updated)
      toast('Training aborted', { description: 'Your progress has been saved.' })
    } catch {
      toast.error('Failed to abort', { description: 'Please try again.' })
    } finally {
      setAborting(false)
      setShowAbortDialog(false)
    }
  }

  const handleStartNewTraining = async (): Promise<void> => {
    if (!training || startingNewTraining) return
    setStartingNewTraining(true)
    try {
      const newTraining = await api.training.create(training.scheduleId)
      void navigate({ to: '/app/training/$trainingId', params: { trainingId: String(newTraining.id) } })
    } catch {
      toast.error('Failed to start new training', { description: 'Please try again.' })
      setStartingNewTraining(false)
    }
  }

  const runCount = training?.schedule.runCount ?? 0
  const puzzleCount = training?.schedule.subset.puzzleCount ?? 0

  const progressData = useMemo(
    () => (training ? buildProgressData(training, runs) : []),
    [training, runs],
  )
  const progressEndMs = progressData.length > 0 ? (progressData[progressData.length - 1]?.timeMs ?? Date.now()) : Date.now()
  const progressStartMs = progressData.length > 0 ? (progressData[0]?.timeMs ?? Date.now()) : Date.now()
  const progressTicks = useMemo(
    () => buildProgressTicks(progressStartMs, progressEndMs),
    [progressStartMs, progressEndMs],
  )
  const totalExpectedPuzzles = runCount * puzzleCount

  const accuracyData = useMemo(
    () => buildAccuracyData(runs, runCount),
    [runs, runCount],
  )
  const solveTimeData = useMemo(
    () => buildSolveTimeData(insights, runs, runCount),
    [insights, runs, runCount],
  )
  const solveTimeCompletedCount = solveTimeData.filter((d) => d.completed).length

  if (authLoading || !user) return null

  if (pageLoading) {
    return (
      <PageWrapper>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PageWrapper>
    )
  }

  if (!training) {
    return (
      <PageWrapper>
        <p className="text-sm text-muted-foreground">Training not found.</p>
      </PageWrapper>
    )
  }

  const { schedule } = training
  const runDefs = schedule.runs
  const isOwner = training.ownerId === user.id
  const canManageRuns = isOwner && (training.status === 'draft' || training.status === 'in_progress')
  const completedRunCount = runs.filter((r) => r.status === 'completed').length
  const hasActiveRun = runs.some((r) => r.status === 'active')
  const startableRunIndex = (
    canManageRuns &&
    !hasActiveRun &&
    completedRunCount < schedule.runCount
  ) ? completedRunCount : null

  return (
    <PageWrapper>

      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-xl font-semibold">{schedule.name}</h1>
            <StatusBadge status={trainingState?.state ?? training.status} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            <UserAvatar displayName={training.ownerDisplayName} avatarUrl={training.ownerAvatarUrl} className="h-4 w-4" />
            <span>{training.ownerDisplayName}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>Started {formatStartedAt(training.startedAt)}</span>
          </div>
        </div>
        {isOwner && training.status === 'in_progress' && (
          <Button variant="ghost" size="sm" onClick={() => setShowAbortDialog(true)}>
            Abort training
          </Button>
        )}
      </div>

      {training.status === 'aborted' && training.abortedAt && (
        <div className="mb-6 flex items-center justify-between rounded-md border border-amber-600/30 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
          <span>This training was aborted on {formatDate(training.abortedAt)}.</span>
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleStartNewTraining()}
              disabled={startingNewTraining}
              className="ml-4 shrink-0 border-amber-600/40 text-amber-800 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/20"
            >
              {startingNewTraining ? 'Starting…' : 'Start new training'}
            </Button>
          )}
        </div>
      )}

      {training.status === 'completed' && training.completedAt && (
        <div className="mb-6 rounded-md border px-4 py-3 text-sm text-muted-foreground">
          Completed on {formatDate(training.completedAt)}.
        </div>
      )}

      {trainingState?.state === 'on_break' && (
        <div className="mb-6 rounded-md border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Suggested break · {formatMs(trainingState.breakRemainingMs)} remaining
        </div>
      )}

      {trainingState?.state === 'break_elapsed' && (
        <div className="mb-6 rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Suggested break ended {formatMs(trainingState.elapsedSinceBreakEndMs)} ago · Ready for Run #{trainingState.nextRunIndex + 1}?
        </div>
      )}

      <div className="mb-6 rounded-lg border bg-card">
        <div className="border-b px-4 py-2.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Schedule
          </span>
        </div>
        <div
          className="flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
          onClick={() =>
            void navigate({
              to: '/app/schedules/$scheduleId',
              params: { scheduleId: String(schedule.id) },
            })
          }
        >
          <UserAvatar
            displayName={schedule.createdBy.displayName}
            avatarUrl={schedule.createdBy.avatarUrl}
          />
          <span className="min-w-0 flex-1 truncate font-medium">{schedule.name}</span>
          <StatusBadge status="locked" />
          <span className="shrink-0 whitespace-nowrap text-sm tabular-nums text-muted-foreground">{schedule.runCount} runs</span>
          {schedule.totalHours > 0 && (
            <span className="hidden shrink-0 whitespace-nowrap text-sm text-muted-foreground sm:block">
              {formatDuration(schedule.totalHours)}
            </span>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="configure">Configure</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="configure">
          <Collapsible open={runsOpen} onOpenChange={setRunsOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between border-b pb-2.5 text-left"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                    style={{ transform: runsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                  Runs{schedule.runCount > 0 ? ` (${schedule.runCount})` : ''}
                </span>
                <span className="hidden text-xs text-muted-foreground sm:block">
                  All runs in this training session
                </span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
          <div className="rounded-md border mt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Break</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  {canManageRuns && (
                    <TableHead className="sticky right-0 bg-background" />
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: schedule.runCount }, (_, i) => {
                  const runDef = runDefs[i] ?? { target_hours: 0, break_after_hours: 0 }
                  const run = getRunForSlot(runs, i)
                  const slotStatus: 'not_started' | 'active' | 'completed' | 'aborted' =
                    run === null ? 'not_started'
                    : run.status === 'active' ? 'active'
                    : run.status === 'completed' ? 'completed'
                    : 'aborted'
                  const canStartThisRow = startableRunIndex === i && slotStatus !== 'active' && slotStatus !== 'completed'
                  const starting = startingIndex === i
                  const resolved = run !== null ? run.solvedCount + run.solvedWithRetriesCount + run.failedCount : 0
                  const progressValue = run !== null && run.totalItems > 0 ? (resolved / run.totalItems) * 100 : 0
                  const progressTooltip = run !== null
                    ? `${resolved} / ${run.totalItems} puzzles completed`
                    : 'Not started yet'

                  return (
                    <TableRow
                      key={i}
                      className={run !== null ? 'cursor-pointer' : ''}
                      onClick={() => {
                        if (run !== null) void navigate({ to: '/app/runs/$runId', params: { runId: String(run.id) } })
                      }}
                    >
                      <TableCell className="tabular-nums text-sm text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDuration(runDef.target_hours)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {runDef.break_after_hours > 0 ? formatDuration(runDef.break_after_hours) : <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell>
                        {slotStatus === 'active' ? (
                          <Badge
                            variant="outline"
                            className="text-xs border-blue-500/30 bg-blue-500/10 text-blue-600 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-400"
                          >
                            {SLOT_STATUS_LABELS[slotStatus]}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {SLOT_STATUS_LABELS[slotStatus]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <ProgressBar
                          value={progressValue}
                          tooltipLabel={progressTooltip}
                          className="w-28"
                        />
                      </TableCell>
                      {canManageRuns && (
                        <TableCell className="sticky right-0 bg-background text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canStartThisRow && (
                              <Button
                                size="sm"
                                disabled={startingIndex !== null}
                                onClick={(e) => { e.stopPropagation(); void handleStartRun(i) }}
                                className="bg-foreground text-background hover:bg-foreground/90"
                              >
                                {starting ? 'Starting…' : 'Start run'}
                              </Button>
                            )}
                            {slotStatus === 'active' && run !== null && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); void navigate({ to: '/app/runs/$runId/solve', params: { runId: String(run.id) } }) }}
                                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                                aria-label="Continue run"
                              >
                                <Play className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </div>
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>

        <TabsContent value="insights">
          <div className="flex flex-col gap-6">
            <Collapsible open={progressOpen} onOpenChange={setProgressOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between border-b pb-2.5 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                      style={{ transform: progressOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                    Progress
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    Expected vs actual cumulative completions over time
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-4">
                  {chartsReady && (
                    <div className="rounded-md border p-4">
                      <div className="mb-4">
                        <p className="text-sm font-semibold">Training progress</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Cumulative puzzles completed vs schedule target
                        </p>
                      </div>
                      <ChartContainer config={PROGRESS_CONFIG} className="h-64 min-w-0 w-full">
                        <ComposedChart
                          data={progressData}
                          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid
                            vertical={false}
                            stroke="hsl(var(--border))"
                            strokeOpacity={1}
                          />
                          <XAxis
                            dataKey="timeMs"
                            type="number"
                            scale="linear"
                            domain={[progressStartMs, progressEndMs]}
                            ticks={progressTicks}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 10 }}
                            tickFormatter={formatTickDate}
                          />
                          <YAxis hide domain={[0, totalExpectedPuzzles]} />
                          <ChartTooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const point = payload[0]?.payload as ProgressPoint
                              return (
                                <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
                                  <p className="font-medium">{formatTickDate(point.timeMs)}</p>
                                  {point.expected !== null && (
                                    <p className="text-muted-foreground">
                                      Expected: {Math.round(point.expected)}
                                    </p>
                                  )}
                                  {point.actual !== null && (
                                    <p className="text-muted-foreground">
                                      Actual: {point.actual}
                                    </p>
                                  )}
                                </div>
                              )
                            }}
                          />
                          <Line
                            dataKey="expected"
                            stroke="var(--color-expected)"
                            strokeWidth={1.5}
                            dot={false}
                            connectNulls
                            isAnimationActive={false}
                          />
                          <Line
                            dataKey="actual"
                            stroke="var(--color-actual)"
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                          {training.status === 'in_progress' && (
                            <ReferenceLine
                              x={Date.now()}
                              stroke="hsl(var(--muted-foreground))"
                              strokeDasharray="4 4"
                              strokeOpacity={0.5}
                            />
                          )}
                        </ComposedChart>
                      </ChartContainer>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between border-b pb-2.5 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                      style={{ transform: statsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                    Stats
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    Accuracy and solve time across runs
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex flex-col gap-4 pt-4">
                  {chartsReady && (
                    <>
                      <div className="rounded-md border p-4">
                        <div className="mb-4">
                          <p className="text-sm font-semibold">Accuracy per run</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            % of puzzles solved on first attempt
                          </p>
                        </div>
                        <ChartContainer config={ACCURACY_CONFIG} className="h-56 min-w-0 w-full">
                          <ComposedChart
                            data={accuracyData}
                            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                            barCategoryGap="30%"
                          >
                            <CartesianGrid
                              vertical={false}
                              stroke="hsl(var(--border))"
                              strokeOpacity={1}
                            />
                            <XAxis
                              dataKey="label"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 10 }}
                            />
                            <YAxis hide domain={[0, 100]} />
                            <ChartTooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null
                                const point = payload[0]?.payload as RunStatPoint
                                if (!point.completed && !point.inProgress) return null
                                return (
                                  <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
                                    <p className="font-medium">{point.label}{point.inProgress ? ' (in progress)' : ''}</p>
                                    <p className="text-muted-foreground">{point.value}%</p>
                                  </div>
                                )
                              }}
                            />
                            <Bar
                              dataKey="value"
                              isAnimationActive={false}
                              shape={(props: unknown) => {
                                const { x, y, width, height, inProgress } = props as { x: number; y: number; width: number; height: number; inProgress: boolean }
                                return <rect x={x} y={y} width={width} height={Math.max(0, height)} fill="var(--color-bar)" fillOpacity={inProgress ? 0.45 : 1} rx={2} ry={2} />
                              }}
                            />
                            {completedRunCount >= 2 && (
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

                      <div className="rounded-md border p-4">
                        <div className="mb-4">
                          <p className="text-sm font-semibold">Avg solve time per run</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Average time to solve each puzzle (m:ss)
                          </p>
                        </div>
                        {insightsLoading ? (
                          <p className="text-sm text-muted-foreground">Loading…</p>
                        ) : (
                          <ChartContainer config={SOLVE_TIME_CONFIG} className="h-56 min-w-0 w-full">
                            <ComposedChart
                              data={solveTimeData}
                              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                              barCategoryGap="30%"
                            >
                              <CartesianGrid
                                vertical={false}
                                stroke="hsl(var(--border))"
                                strokeOpacity={1}
                              />
                              <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10 }}
                              />
                              <YAxis hide />
                              <ChartTooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null
                                  const point = payload[0]?.payload as RunStatPoint
                                  if (!point.completed && !point.inProgress) return null
                                  return (
                                    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
                                      <p className="font-medium">{point.label}{point.inProgress ? ' (in progress)' : ''}</p>
                                      <p className="text-muted-foreground">
                                        {point.value > 0 ? formatSolveSeconds(point.value) : '—'}
                                      </p>
                                    </div>
                                  )
                                }}
                              />
                              <Bar
                                dataKey="value"
                                isAnimationActive={false}
                                shape={(props: unknown) => {
                                  const { x, y, width, height, inProgress } = props as { x: number; y: number; width: number; height: number; inProgress: boolean }
                                  return <rect x={x} y={y} width={width} height={Math.max(0, height)} fill="var(--color-bar)" fillOpacity={inProgress ? 0.45 : 1} rx={2} ry={2} />
                                }}
                              />
                              {solveTimeCompletedCount >= 2 && (
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
                        )}
                      </div>
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={showAbortDialog} onOpenChange={setShowAbortDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abort training?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Your completed runs will be preserved but the training
              will be marked as aborted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleAbortTraining()}
              disabled={aborting}
            >
              {aborting ? 'Aborting…' : 'Abort'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageWrapper>
  )
}
