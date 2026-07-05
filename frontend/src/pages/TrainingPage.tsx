import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams, Link } from '@tanstack/react-router'
import { toast } from '../lib/toast'
import { Ban, ChevronDown, Loader2, Play } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { useAuth } from '../context/auth'
import {
  api,
  type Run,
  type Training,
  type TrainingInsights,
  type TrainingProgressData,
  type TrainingDetailStatus,
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
import { StatusBadge, runStatusToStatusValue, trainingStateToStatusValue, type StatusValue } from '../components/StatusBadge'
import { ProgressBar } from '../components/ProgressBar'
import { DataTable } from '../components/DataTable'
import { formatDuration } from '../components/schedules/DurationInput'
import { formatDate, formatStartedAt } from '../lib/utils'
import { TrainingProgressCard } from '../components/TrainingProgressCard'
import { CurrentTrainingStatus } from '../components/CurrentTrainingStatus'
import { ConceptIcon } from '../components/ConceptIcon'

const ACCURACY_CONFIG: ChartConfig = {
  bar: { label: 'Accuracy %', color: 'hsl(var(--chart-1))' },
  trend: { label: 'Trend', color: 'hsl(var(--chart-2))' },
}

const SOLVE_TIME_CONFIG: ChartConfig = {
  bar: { label: 'Avg solve time', color: 'hsl(var(--chart-1))' },
  trend: { label: 'Trend', color: 'hsl(var(--chart-2))' },
}

type RunStatPoint = { label: string; value: number; trend: number | null; completed: boolean; inProgress: boolean }

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

function formatSolveSeconds(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

type RunSlotRow = {
  index: number
  targetHours: number
  breakAfterHours: number
  slotStatus: 'not_started' | 'active' | 'completed' | 'aborted'
  run: Run | null
  progressValue: number
  progressTooltip: string
  canStart: boolean
  isStarting: boolean
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
  const [pageLoading, setPageLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('configure')
  const [runsOpen, setRunsOpen] = useState(true)
  const [progressOpen, setProgressOpen] = useState(true)
  const [statsOpen, setStatsOpen] = useState(true)
  const [showAbortDialog, setShowAbortDialog] = useState(false)
  const [aborting, setAborting] = useState(false)
  const [startingIndex, setStartingIndex] = useState<number | null>(null)
  const [insights, setInsights] = useState<TrainingInsights | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [progress, setProgress] = useState<TrainingProgressData | null>(null)
  const [detailStatus, setDetailStatus] = useState<TrainingDetailStatus | null>(null)
  const [chartsReady, setChartsReady] = useState(false)

  useSetBreadcrumbTitle(training?.schedule?.name)

  useEffect(() => {
    if (!authLoading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, authLoading, navigate])

  useEffect(() => { setChartsReady(true) }, [])

  useEffect(() => {
    if (!user || !training) return
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    api.training.getDetailStatus(training.id, tz).then(setDetailStatus).catch(() => {})
  }, [user, training])

  useEffect(() => {
    if (activeTab !== 'insights' || !user || !training) return
    if (insights === null) {
      setInsightsLoading(true)
      api.training
        .getInsights(training.id)
        .then(setInsights)
        .catch(() => {})
        .finally(() => setInsightsLoading(false))
    }
    if (progress === null) {
      api.training.getProgress(training.id).then(setProgress).catch(() => {})
    }
  }, [activeTab, insights, progress, user, training])

  useEffect(() => {
    if (!user) return
    Promise.all([api.training.get(id), api.runs.list(id)])
      .then(([t, fetchedRuns]) => {
        setTraining(t)
        setRuns(fetchedRuns)
      })
      .catch(() => {})
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
      setStartingIndex(null)
    }
  }

  const handleAbortTraining = async (): Promise<void> => {
    if (!training || aborting) return
    setAborting(true)
    try {
      const updated = await api.training.abort(training.id)
      setTraining(updated)
      toast.success('Training aborted', { description: 'Your progress has been saved.' })
    } catch {
    } finally {
      setAborting(false)
      setShowAbortDialog(false)
    }
  }

  const runCount = training?.schedule.runCount ?? 0

  const accuracyData = useMemo(
    () => buildAccuracyData(runs, runCount),
    [runs, runCount],
  )
  const solveTimeData = useMemo(
    () => buildSolveTimeData(insights, runs, runCount),
    [insights, runs, runCount],
  )
  const solveTimeCompletedCount = solveTimeData.filter((d) => d.completed).length

  const runRows = useMemo<RunSlotRow[]>(() => {
    if (!training || !user) return []
    const sch = training.schedule
    const defs = sch.runs
    const isOwner = training.ownerId === user.id
    const canManage = isOwner && (training.status === 'not_started' || training.status === 'in_progress')
    const completedCount = runs.filter((r) => r.status === 'completed').length
    const hasActive = runs.some((r) => r.status === 'active')
    const startableIdx = (canManage && !hasActive && completedCount < sch.runCount) ? completedCount : null
    return Array.from({ length: sch.runCount }, (_, i) => {
      const runDef = defs[i] ?? { target_hours: 0, break_after_hours: 0 }
      const run = getRunForSlot(runs, i)
      const slotStatus: RunSlotRow['slotStatus'] =
        run === null ? 'not_started'
        : run.status === 'active' ? 'active'
        : run.status === 'completed' ? 'completed'
        : 'aborted'
      const resolved = run !== null ? run.solvedCount + run.solvedWithRetriesCount + run.failedCount : 0
      const progressValue = run !== null && run.totalItems > 0 ? (resolved / run.totalItems) * 100 : 0
      return {
        index: i,
        targetHours: runDef.target_hours,
        breakAfterHours: runDef.break_after_hours,
        slotStatus,
        run,
        progressValue,
        progressTooltip: run !== null ? `${resolved} / ${run.totalItems} puzzles completed` : 'Not started yet',
        canStart: startableIdx === i && slotStatus !== 'active' && slotStatus !== 'completed',
        isStarting: startingIndex === i,
      }
    })
  }, [training, user, runs, startingIndex])

  const runColumns = useMemo<ColumnDef<RunSlotRow>[]>(() => {
    const canManage = !!training && !!user && training.ownerId === user.id && (training.status === 'not_started' || training.status === 'in_progress')
    return [
      {
        id: 'index',
        header: () => <span className="flex items-center gap-1.5"><ConceptIcon concept="Run" className="h-3.5 w-3.5 text-muted-foreground" />Run</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums text-sm text-muted-foreground">Run {row.original.index + 1}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => {
          const { slotStatus } = row.original
          const statusValue: StatusValue = slotStatus === 'not_started'
            ? 'not_started'
            : runStatusToStatusValue(slotStatus)
          return <StatusBadge status={statusValue} />
        },
      },
      {
        id: 'progress',
        header: 'Progress',
        enableSorting: false,
        cell: ({ row }) => (
          <ProgressBar value={row.original.progressValue} tooltipLabel={row.original.progressTooltip} className="w-28" />
        ),
      },
      {
        id: 'duration',
        header: 'Duration',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{formatDuration(row.original.targetHours)}</span>
        ),
      },
      {
        id: 'break',
        header: 'Break',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.breakAfterHours > 0
              ? formatDuration(row.original.breakAfterHours)
              : <span className="text-muted-foreground/40">—</span>}
          </span>
        ),
      },
      {
        id: 'startedAt',
        header: 'Started',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.run?.startedAt
              ? formatDate(row.original.run.startedAt)
              : <span className="text-muted-foreground/40">—</span>}
          </span>
        ),
      },
      {
        id: 'completedAt',
        header: 'Completed',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.run?.completedAt
              ? formatDate(row.original.run.completedAt)
              : <span className="text-muted-foreground/40">—</span>}
          </span>
        ),
      },
      ...(canManage ? [{
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { className: 'sticky right-0 bg-background w-0' },
        cell: ({ row }: { row: { original: RunSlotRow } }) => {
          const { canStart, isStarting, slotStatus, run, index } = row.original
          return (
            <div className="flex items-center justify-end gap-1.5">
              {canStart && (
                <Button
                  size="sm"
                  disabled={startingIndex !== null}
                  onClick={(e) => { e.stopPropagation(); void handleStartRun(index) }}
                  className="h-6 px-2 text-xs bg-foreground text-background hover:bg-foreground/90"
                >
                  {isStarting ? 'Starting…' : 'Start run'}
                </Button>
              )}
              {slotStatus === 'active' && run !== null && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void navigate({ to: '/app/runs/$runId/solve', params: { runId: String(run.id) } }) }}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Continue run"
                >
                  <Play className="h-3 w-3" />
                </button>
              )}
            </div>
          )
        },
      } as ColumnDef<RunSlotRow>] : []),
    ]
  }, [training, user, startingIndex, handleStartRun, navigate])

  if (authLoading || !user) return null

  if (pageLoading) {
    return (
      <PageWrapper>
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
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
  const isOwner = training.ownerId === user.id
  const completedRunCount = runs.filter((r) => r.status === 'completed').length

  return (
    <PageWrapper>

      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="flex items-center gap-2 text-xl font-semibold"><ConceptIcon concept="Training" />{schedule.name}</h1>
            <StatusBadge status={trainingStateToStatusValue(detailStatus?.state ?? training.status)} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            <UserAvatar displayName={training.ownerDisplayName} avatarUrl={training.ownerAvatarUrl} className="h-4 w-4" />
            <span>{training.ownerDisplayName}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>Started {formatStartedAt(training.startedAt)}</span>
          </div>
        </div>
        {isOwner && training.status === 'in_progress' && (
          <Button variant="destructive" size="sm" onClick={() => setShowAbortDialog(true)}>
            Abort training
          </Button>
        )}
      </div>

      {training.status === 'aborted' && training.abortedAt && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-amber-600/30 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
          <Ban className="mt-0.5 h-4 w-4 shrink-0" />
          <span>This training was aborted on {formatDate(training.abortedAt)}.{isOwner && (<> To train this schedule again, <Link to="/app/training/new" className="underline underline-offset-2 hover:opacity-75">start a new training</Link>.</>)}</span>
        </div>
      )}

      {training.status === 'completed' && training.completedAt && (
        <div className="mb-6 rounded-md border px-4 py-3 text-sm text-muted-foreground">
          Completed on {formatDate(training.completedAt)}.
        </div>
      )}

      {detailStatus && <CurrentTrainingStatus status={detailStatus} />}

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
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <ConceptIcon concept="Schedule" className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{schedule.name}</span>
          </span>
          <StatusBadge status="locked" />
          {schedule.totalHours > 0 && (
            <span className="hidden shrink-0 whitespace-nowrap text-sm text-muted-foreground sm:block">
              Total duration: {" "}
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
              <div className="mt-6">
                <DataTable
                  columns={runColumns}
                  data={runRows}
                  hideSearch={true}
                  pageSize={schedule.runCount}
                  onRowClick={(row) => {
                    if (row.run !== null) void navigate({ to: '/app/runs/$runId', params: { runId: String(row.run.id) } })
                  }}
                  getRowClassName={(row) => row.run !== null ? 'cursor-pointer' : ''}
                />
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
                  {progress ? (
                    <TrainingProgressCard progress={progress} />
                  ) : (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
                          <div className="flex justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {aborting ? 'Aborting…' : 'Abort training'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageWrapper>
  )
}
