import * as React from 'react'
import { useState, useEffect } from 'react'
import { useNavigate, Link, useParams } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '../context/auth'
import {
  api,
  type Run,
  type RunPuzzleList,
  type Training,
} from '../lib/api'
import { formatNumber, formatSolveTime, formatSolveTimeMs, formatStartedAt } from '../lib/utils'
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
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Slider } from '../components/ui/slider'
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
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '../components/ui/table'
import { RunPuzzleTable } from '../components/runs/RunPuzzleTable'

function InsightsTab({ run, puzzleList }: { run: Run; puzzleList: RunPuzzleList }): React.ReactElement {
  const resolvedCount = run.solvedCount + run.solvedWithRetriesCount + run.failedCount
  const accuracy =
    resolvedCount > 0
      ? ((run.solvedCount / resolvedCount) * 100).toFixed(1)
      : null

  const solvedTimes = puzzleList.puzzles
    .filter((p) => p.positionStatus === 'solved' || p.positionStatus === 'solved_with_retries')
    .map((p) => p.timeMs)
    .filter((ms): ms is number => ms !== null)

  const avgMs =
    solvedTimes.length > 0
      ? Math.round(solvedTimes.reduce((a, b) => a + b, 0) / solvedTimes.length)
      : null
  const fastestMs = solvedTimes.length > 0 ? Math.min(...solvedTimes) : null
  const slowestMs = solvedTimes.length > 0 ? Math.max(...solvedTimes) : null

  if (resolvedCount === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">No data yet.</div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Accuracy
        </span>
        <span className="text-2xl font-semibold tabular-nums">
          {accuracy !== null ? `${accuracy}%` : '—'}
        </span>
        <span className="text-xs text-muted-foreground">
          based on {resolvedCount} resolved puzzle{resolvedCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Solve times
        </span>
        <div className="grid grid-cols-3 gap-4">
          {(
            [
              ['Average', avgMs],
              ['Fastest', fastestMs],
              ['Slowest', slowestMs],
            ] as [string, number | null][]
          ).map(([label, ms]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="tabular-nums font-medium">
                {ms !== null ? formatSolveTimeMs(ms) : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Breakdown
        </span>
        <Table>
          <TableBody>
            {(
              [
                ['Solved', run.solvedCount],
                ['Solved with retries', run.solvedWithRetriesCount],
                ['Failed', run.failedCount],
                ['Remaining', run.inProgressCount],
                ['Total', run.totalPuzzles],
              ] as [string, number][]
            ).map(([label, count]) => (
              <TableRow key={label}>
                <TableCell className="text-sm">{label}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{formatNumber(count)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function ConfigureTab({
  run,
  puzzleList,
  runIdStr,
  participation,
}: {
  run: Run
  puzzleList: RunPuzzleList
  runIdStr: string
  participation: Training | null
}): React.ReactElement {
  const [targetsOpen, setTargetsOpen] = useState(true)
  const [puzzlesOpen, setPuzzlesOpen] = useState(false)

  const runTarget = participation?.runTargets.find((t) => t.runIndex === run.runIndex)
  const [accuracy, setAccuracy] = useState<number | null>(runTarget?.targetAccuracy ?? null)
  const [solveSeconds, setSolveSeconds] = useState<number | null>(runTarget?.targetSolveSeconds ?? null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setAccuracy(runTarget?.targetAccuracy ?? null)
    setSolveSeconds(runTarget?.targetSolveSeconds ?? null)
  }, [runTarget])

  const isActive = run.status === 'active'

  const saveTarget = async (accuracyVal: number | null, solveSecondsVal: number | null): Promise<void> => {
    if (saving) return
    setSaving(true)
    try {
      await api.training.setRunTarget(run.trainingId, run.runIndex, {
        targetAccuracy: accuracyVal,
        targetSolveSeconds: solveSecondsVal,
      })
      toast('Targets saved', { description: 'Your goals for this run have been updated.' })
    } catch {
      toast.error('Failed to save targets', { description: 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Collapsible open={targetsOpen} onOpenChange={setTargetsOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between border-b pb-2.5 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                style={{ transform: targetsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
              Targets
            </span>
            <span className="hidden text-xs text-muted-foreground sm:block">
              Personal goals for this run
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-7 pt-5 pb-3">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Accuracy</span>
                  <span className="text-xs text-muted-foreground">
                    % of puzzles solved on the first attempt without failures
                  </span>
                </div>
                <span className="shrink-0 tabular-nums text-sm font-medium">
                  {accuracy !== null ? `${accuracy} %` : '—'}
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[accuracy ?? 0]}
                onValueChange={([v]) => setAccuracy(v ?? 0)}
                onValueCommit={([v]) => void saveTarget(v ?? 0, solveSeconds)}
                disabled={!isActive || saving}
                className={accuracy === null ? 'opacity-40' : ''}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Solve time</span>
                  <span className="text-xs text-muted-foreground">
                    Target average time to solve each puzzle
                  </span>
                </div>
                <span className="shrink-0 tabular-nums text-sm font-medium">
                  {solveSeconds !== null ? `${formatSolveTime(solveSeconds)} m:s` : '—'}
                </span>
              </div>
              <Slider
                min={0}
                max={600}
                step={5}
                value={[solveSeconds ?? 0]}
                onValueChange={([v]) => setSolveSeconds(v ?? 0)}
                onValueCommit={([v]) => void saveTarget(accuracy, v ?? 0)}
                disabled={!isActive || saving}
                className={solveSeconds === null ? 'opacity-40' : ''}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0:00</span>
                <span>10:00</span>
              </div>
            </div>


          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={puzzlesOpen} onOpenChange={setPuzzlesOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between border-b pb-2.5 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                style={{ transform: puzzlesOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
              Puzzles{puzzleList.puzzles.length > 0 ? ` (${puzzleList.puzzles.length})` : ''}
            </span>
            <span className="hidden text-xs text-muted-foreground sm:block">
              All puzzles in this run
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-6">
            <RunPuzzleTable
              puzzles={puzzleList.puzzles}
              runIdStr={runIdStr}
              isActive={isActive}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

const RUN_STATUS_LABELS: Record<Run['status'], string> = {
  active: 'In progress',
  completed: 'Completed',
  aborted: 'Aborted',
}

export function RunPage(): React.ReactElement | null {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { runId: runIdStr } = useParams({ from: '/app/app-shell/runs/$runId' })
  const runId = parseInt(runIdStr, 10)

  const [run, setRun] = useState<Run | null>(null)
  const [puzzleList, setPuzzleList] = useState<RunPuzzleList | null>(null)
  const [participation, setParticipation] = useState<Training | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [showAbortDialog, setShowAbortDialog] = useState(false)
  const [aborting, setAborting] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (!user) return
    Promise.all([api.runs.get(runId), api.runs.puzzles(runId)])
      .then(([fetchedRun, fetchedPuzzles]) => {
        setRun(fetchedRun)
        setPuzzleList(fetchedPuzzles)
        api.training
          .get(fetchedRun.trainingId)
          .then(setParticipation)
          .catch(() => {})
      })
      .catch(() =>
        toast.error('Failed to load run', { description: 'Could not fetch run data.' }),
      )
      .finally(() => setPageLoading(false))
  }, [runId, user])

  const handleAbort = async (): Promise<void> => {
    if (!run || aborting) return
    setAborting(true)
    try {
      const updated = await api.runs.abort(run.id)
      setRun(updated)
      toast('Run aborted', { description: 'You can restart this run slot at any time.' })
    } catch {
      toast.error('Failed to abort run', { description: 'Please try again.' })
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

  if (!run || !puzzleList) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">Run not found.</p>
      </div>
    )
  }

  const scheduleName = participation?.schedule.name ?? '…'
  const trainingId = run.trainingId

  const statsLine = `Started ${formatStartedAt(run.startedAt)}`

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/app">Training</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link
                to="/app/training/$trainingId"
                params={{ trainingId: String(trainingId) }}
              >
                {scheduleName}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Run {run.runIndex + 1}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Run {run.runIndex + 1}</h1>
            <Badge variant="outline">{RUN_STATUS_LABELS[run.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{statsLine}</p>
        </div>
        {run.status === 'active' && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() =>
                void navigate({
                  to: '/app/runs/$runId/solve',
                  params: { runId: runIdStr },
                })
              }
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Continue
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowAbortDialog(true)}
            >
              Abort
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="configure">
        <TabsList className="mb-6">
          <TabsTrigger value="configure">Configure</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>
        <TabsContent value="configure">
          <ConfigureTab run={run} puzzleList={puzzleList} runIdStr={runIdStr} participation={participation} />
        </TabsContent>
        <TabsContent value="insights">
          <InsightsTab run={run} puzzleList={puzzleList} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={showAbortDialog} onOpenChange={setShowAbortDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abort run?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Your progress so far will be preserved but the run must be
              restarted from scratch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleAbort()} disabled={aborting}>
              {aborting ? 'Aborting…' : 'Abort run'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
