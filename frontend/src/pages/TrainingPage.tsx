import * as React from 'react'
import { useState, useEffect } from 'react'
import { useNavigate, Link, useParams } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '../context/auth'
import {
  api,
  type Run,
  type Training,
  type TrainingStatus,
} from '../lib/api'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '../components/ui/breadcrumb'
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

const STATUS_LABELS: Record<TrainingStatus, string> = {
  draft: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  aborted: 'Aborted',
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

  useEffect(() => {
    if (!authLoading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (!user) return
    Promise.all([api.training.get(id), api.runs.list(id)])
      .then(([t, fetchedRuns]) => {
        setTraining(t)
        setRuns(fetchedRuns)
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

  if (authLoading || !user) return null

  if (pageLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!training) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">Training not found.</p>
      </div>
    )
  }

  const { schedule } = training
  const runDefs = schedule.runs
  const isOwner = training.ownerUsername === user.username
  const canManageRuns = isOwner && (training.status === 'draft' || training.status === 'in_progress')
  const completedRunCount = runs.filter((r) => r.status === 'completed').length
  const hasActiveRun = runs.some((r) => r.status === 'active')
  const startableRunIndex = (
    canManageRuns &&
    !hasActiveRun &&
    completedRunCount < schedule.runCount
  ) ? completedRunCount : null

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/app/training">Training</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{schedule.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-xl font-semibold">{schedule.name}</h1>
            <Badge variant="outline" className="text-xs">
              {STATUS_LABELS[training.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Started {formatStartedAt(training.startedAt)}
          </p>
        </div>
        {isOwner && training.status === 'in_progress' && (
          <Button variant="ghost" size="sm" onClick={() => setShowAbortDialog(true)}>
            Abort training
          </Button>
        )}
      </div>

      {training.status === 'aborted' && training.abortedAt && (
        <div className="mb-6 rounded-md border border-amber-600/30 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
          This training was aborted on {formatDate(training.abortedAt)}.
        </div>
      )}

      {training.status === 'completed' && training.completedAt && (
        <div className="mb-6 rounded-md border px-4 py-3 text-sm text-muted-foreground">
          Completed on {formatDate(training.completedAt)}.
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
            username={schedule.createdBy.username}
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
                  const progressValue = run !== null && run.totalPuzzles > 0 ? (resolved / run.totalPuzzles) * 100 : 0
                  const progressTooltip = run !== null
                    ? `${resolved} / ${run.totalPuzzles} puzzles completed`
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
                              <Button
                                size="sm"
                                className="bg-foreground text-background hover:bg-foreground/90"
                                onClick={(e) => { e.stopPropagation(); void navigate({ to: '/app/runs/$runId/solve', params: { runId: String(run.id) } }) }}
                              >
                                Continue
                              </Button>
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
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="pt-4 text-sm text-muted-foreground">
                  Your overall progress through this training will be shown here — how far along
                  you are across all runs.
                </p>
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
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="pt-4 text-sm text-muted-foreground">
                  Stats from your completed runs will appear here — accuracy and solve time per
                  run, comparable across runs and other participants.
                </p>
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
    </div>
  )
}
