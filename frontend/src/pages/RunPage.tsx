import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { toast } from '../lib/toast'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '../context/auth'
import {
  api,
  type Run,
  type RunTrainingItemList,
  type Training,
} from '../lib/api'
import { formatNumber, formatSolveTime, formatSolveTimeMs, formatStartedAt } from '../lib/utils'
import { useSetBreadcrumbTitle } from '../hooks/useSetBreadcrumbTitle'
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
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '../components/ui/table'
import { RunTrainingItemTable } from '../components/runs/RunTrainingItemTable'
import { RunPaceCard } from '../features/board/RunPaceCard'
import { UserAvatar } from '../components/UserAvatar'
import { ConceptIcon } from '../components/ConceptIcon'

function InsightsTab({ run, puzzleList }: { run: Run; puzzleList: RunTrainingItemList }): React.ReactElement {
  const [breakdownOpen, setBreakdownOpen] = useState(true)
  const [paceOpen, setPaceOpen] = useState(true)

  const resolvedCount = run.solvedCount + run.solvedWithRetriesCount + run.failedCount
  const accuracyPct =
    resolvedCount > 0 ? ((run.solvedCount / resolvedCount) * 100).toFixed(1) : null
  const completionPct =
    run.totalItems > 0 ? ((resolvedCount / run.totalItems) * 100).toFixed(1) : null

  const solvedTimes = puzzleList.trainingItems
    .filter((p) => p.positionStatus === 'solved' || p.positionStatus === 'solved_with_retries')
    .map((p) => p.timeMs)
    .filter((ms): ms is number => ms !== null)

  const avgMs =
    solvedTimes.length > 0
      ? Math.round(solvedTimes.reduce((a, b) => a + b, 0) / solvedTimes.length)
      : null
  const fastestMs = solvedTimes.length > 0 ? Math.min(...solvedTimes) : null

  if (resolvedCount === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">No data yet.</div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Collapsible open={breakdownOpen} onOpenChange={setBreakdownOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between border-b pb-2.5 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                style={{ transform: breakdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
              Breakdown
            </span>
            <span className="hidden text-xs text-muted-foreground sm:block">
              Puzzle results for this run
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-4">
            <div className="rounded-md border">
              <Table>
                <TableBody>
                  {(
                    [
                      ['Solved', run.solvedCount],
                      ['Solved with retries', run.solvedWithRetriesCount],
                      ['Failed', run.failedCount],
                      ['Remaining', run.inProgressCount],
                      ['Total', run.totalItems],
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
        </CollapsibleContent>
      </Collapsible>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(
          [
            ['Accuracy', accuracyPct !== null ? `${accuracyPct}%` : '—'],
            ['Completion', completionPct !== null ? `${completionPct}%` : '—'],
            ['Avg solve time', avgMs !== null ? formatSolveTimeMs(avgMs) : '—'],
            ['Fastest', fastestMs !== null ? formatSolveTimeMs(fastestMs) : '—'],
          ] as [string, string][]
        ).map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5 rounded-md border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {run.paceChart !== null && (
        <Collapsible open={paceOpen} onOpenChange={setPaceOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between border-b pb-2.5 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                  style={{ transform: paceOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
                Run pace
              </span>
              <span className="hidden text-xs text-muted-foreground sm:block">
                Actual progress & required pace
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pt-4">
              <RunPaceCard chartData={run.paceChart} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

function ConfigureTab({
  run,
  participation,
  isOwner,
}: {
  run: Run
  participation: Training | null
  isOwner: boolean
}): React.ReactElement {
  const runTarget = participation?.runTargets.find((t) => t.runIndex === run.runIndex)
  const [accuracy, setAccuracy] = useState<number | null>(runTarget?.targetAccuracy ?? null)
  const [minSolveSeconds, setMinSolveSeconds] = useState<number | null>(runTarget?.targetMinSolveSeconds ?? null)
  const [maxSolveSeconds, setMaxSolveSeconds] = useState<number | null>(runTarget?.targetMaxSolveSeconds ?? null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setAccuracy(runTarget?.targetAccuracy ?? null)
    setMinSolveSeconds(runTarget?.targetMinSolveSeconds ?? null)
    setMaxSolveSeconds(runTarget?.targetMaxSolveSeconds ?? null)
  }, [runTarget])

  const isActive = run.status === 'active'

  const saveTarget = async (
    accuracyVal: number | null,
    minVal: number | null,
    maxVal: number | null,
  ): Promise<void> => {
    if (saving) return
    setSaving(true)
    try {
      await api.training.setRunTarget(run.trainingId, run.runIndex, {
        targetAccuracy: accuracyVal,
        targetMinSolveSeconds: minVal,
        targetMaxSolveSeconds: maxVal,
      })
      toast.success('Targets saved', { description: 'Your goals for this run have been updated.' })
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const solveTimeLabel = (() => {
    if (maxSolveSeconds === null || maxSolveSeconds === 0) return '—'
    if (minSolveSeconds === null || minSolveSeconds === 0) return `${formatSolveTime(maxSolveSeconds)} m:s`
    return `${formatSolveTime(minSolveSeconds)} – ${formatSolveTime(maxSolveSeconds)} m:s`
  })()

  const handleSolveTimeChange = ([v1, v2]: (number | undefined)[]) => {
    const newMax = v2 === 0 ? null : (v2 ?? null)
    const newMin = (!v1 || newMax === null || v1 >= (v2 ?? 0)) ? null : v1
    setMinSolveSeconds(newMin)
    setMaxSolveSeconds(newMax)
  }

  const handleSolveTimeCommit = ([v1, v2]: (number | undefined)[]) => {
    const newMax = v2 === 0 ? null : (v2 ?? null)
    const newMin = (!v1 || newMax === null || v1 >= (v2 ?? 0)) ? null : v1
    void saveTarget(accuracy, newMin, newMax)
  }

  return (
    <div className="flex flex-col gap-7">
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
          onValueCommit={([v]) => void saveTarget(v ?? 0, minSolveSeconds, maxSolveSeconds)}
          disabled={!isActive || saving || !isOwner}
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
              Target time window per puzzle — drag left thumb to set minimum, right for maximum
            </span>
          </div>
          <span className="shrink-0 tabular-nums text-sm font-medium">
            {solveTimeLabel}
          </span>
        </div>
        <Slider
          min={0}
          max={600}
          step={5}
          value={[minSolveSeconds ?? 0, maxSolveSeconds ?? 0]}
          onValueChange={handleSolveTimeChange}
          onValueCommit={handleSolveTimeCommit}
          disabled={!isActive || saving || !isOwner}
          className={(minSolveSeconds === null && maxSolveSeconds === null) ? 'opacity-40' : ''}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0:00</span>
          <span>10:00</span>
        </div>
      </div>
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
  const [puzzleList, setPuzzleList] = useState<RunTrainingItemList | null>(null)
  const [participation, setParticipation] = useState<Training | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const breadcrumbParents = useMemo(
    () =>
      participation && run
        ? [{ label: participation.schedule.name, to: `/app/training/${run.trainingId}` }]
        : undefined,
    [participation, run?.trainingId],
  )
  useSetBreadcrumbTitle(run ? `Run ${run.runIndex + 1}` : undefined, breadcrumbParents, 'Run')

  useEffect(() => {
    if (!authLoading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (!user) return
    Promise.all([api.runs.get(runId), api.runs.trainingItems(runId)])
      .then(([fetchedRun, fetchedPuzzles]) => {
        setRun(fetchedRun)
        setPuzzleList(fetchedPuzzles)
        api.training
          .get(fetchedRun.trainingId)
          .then(setParticipation)
          .catch(() => {})
      })
      .catch(() => {})
      .finally(() => setPageLoading(false))
  }, [runId, user])

  if (authLoading || !user) return null

  if (pageLoading) {
    return (
      <PageWrapper>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PageWrapper>
    )
  }

  if (!run || !puzzleList) {
    return (
      <PageWrapper>
        <p className="text-sm text-muted-foreground">Run not found.</p>
      </PageWrapper>
    )
  }

  const isOwner = !!participation && participation.ownerId === user.id

  const statsLine = `Started ${formatStartedAt(run.startedAt)}`

  return (
    <PageWrapper>
<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="flex items-center gap-2 text-xl font-semibold"><ConceptIcon concept="Run" />Run {run.runIndex + 1}</h1>
            <Badge variant="outline">{RUN_STATUS_LABELS[run.status]}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            {participation && (
              <>
                <UserAvatar displayName={participation.ownerDisplayName} avatarUrl={participation.ownerAvatarUrl} className="h-4 w-4" />
                <span>{participation.ownerDisplayName}</span>
                <span className="text-muted-foreground/40">·</span>
              </>
            )}
            <span>{statsLine}</span>
          </div>
        </div>
        {run.status === 'active' && isOwner && (
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
          </div>
        )}
      </div>

      <Tabs defaultValue="configure">
        <TabsList className="mb-6">
          <TabsTrigger value="configure">Configure</TabsTrigger>
          <TabsTrigger value="puzzles">
            Puzzles{puzzleList.trainingItems.length > 0 ? ` (${puzzleList.trainingItems.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>
        <TabsContent value="configure">
          <ConfigureTab run={run} participation={participation} isOwner={isOwner} />
        </TabsContent>
        <TabsContent value="puzzles">
          <RunTrainingItemTable
            trainingItems={puzzleList.trainingItems}
            runIdStr={runIdStr}
            isActive={run.status === 'active'}
          />
        </TabsContent>
        <TabsContent value="insights">
          <InsightsTab run={run} puzzleList={puzzleList} />
        </TabsContent>
      </Tabs>

    </PageWrapper>
  )
}
