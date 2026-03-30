import * as React from 'react'
import { useState, useEffect } from 'react'
import { useNavigate, Link, useParams } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '../context/auth'
import {
  api,
  type ScheduleParticipation,
  type RunTarget,
  type ParticipationStatus,
} from '../lib/api'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '../components/ui/breadcrumb'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../components/ui/tabs'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '../components/ui/collapsible'
import { Button } from '../components/ui/button'
import { UserAvatar } from '../components/UserAvatar'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { formatDuration } from '../components/schedules/DurationInput'
import { SolveTimeInput } from '../components/schedules/SolveTimeInput'
import { formatSolveTime } from '../lib/utils'

type RunStatus = 'not_started' | 'in_progress' | 'completed'

const STATUS_LABELS: Record<ParticipationStatus, string> = {
  draft: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  aborted: 'Aborted',
}

const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

type RunCardProps = {
  runIndex: number
  targetHours: number
  breakAfterHours: number
  runStatus: RunStatus
  runTarget: RunTarget | undefined
  participationId: number
  participationStatus: ParticipationStatus
  prevRunCompleted: boolean
  isOwner: boolean
  onTargetSaved: (target: RunTarget) => void
}

function RunCard({
  runIndex,
  targetHours,
  breakAfterHours,
  runStatus,
  runTarget,
  participationId,
  participationStatus,
  prevRunCompleted,
  isOwner,
  onTargetSaved,
}: RunCardProps): React.ReactElement {
  const [accuracy, setAccuracy] = useState<number | null>(runTarget?.targetAccuracy ?? null)
  const [solveSeconds, setSolveSeconds] = useState<number | null>(
    runTarget?.targetSolveSeconds ?? null,
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setAccuracy(runTarget?.targetAccuracy ?? null)
    setSolveSeconds(runTarget?.targetSolveSeconds ?? null)
  }, [runTarget])

  const isTerminal = participationStatus === 'completed' || participationStatus === 'aborted'
  const isEditable = isOwner && !isTerminal && runStatus !== 'completed'

  const saveTarget = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    try {
      const saved = await api.participations.setRunTarget(participationId, runIndex, {
        targetAccuracy: accuracy,
        targetSolveSeconds: solveSeconds,
      })
      onTargetSaved(saved)
    } catch {
      toast.error('Failed to save target', { description: 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`rounded-lg border p-4 ${runStatus === 'not_started' ? 'border-border/50' : ''}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">Run {runIndex + 1}</span>
        <span className="text-xs">{RUN_STATUS_LABELS[runStatus]}</span>
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        {formatDuration(targetHours)} target
        {breakAfterHours > 0 && <> · {formatDuration(breakAfterHours)} break</>}
      </p>

      <div className="flex items-center justify-between gap-4 border-t pt-3">
        {runStatus === 'completed' ? (
          <div className="flex items-center gap-6 text-sm">
            <span className="text-sm">
              Accuracy <span className="font-medium">{accuracy !== null ? `${accuracy}%` : '—'}</span>
            </span>
            <span className="text-sm">
              Solve time <span className="font-medium">{solveSeconds !== null ? formatSolveTime(solveSeconds) : '—'}</span>
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="shrink-0 whitespace-nowrap text-sm">Accuracy</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="—"
                  value={accuracy ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setAccuracy(v === '' ? null : Math.min(100, Math.max(0, parseFloat(v))))
                  }}
                  onBlur={() => void saveTarget()}
                  disabled={!isEditable || saving}
                  className="h-8 w-20 text-sm tabular-nums"
                />
                <span className="text-sm">%</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="shrink-0 whitespace-nowrap text-sm">Solve time</span>
              <SolveTimeInput
                value={solveSeconds}
                onChange={(s) => setSolveSeconds(s)}
                disabled={!isEditable || saving}
              />
            </div>
          </div>
        )}

        {isOwner && !isTerminal && (
          <div className="shrink-0">
            {runStatus === 'not_started' && (
              <Button size="sm" disabled={!prevRunCompleted} className="bg-foreground text-background hover:bg-foreground/90">Start run</Button>
            )}
            {runStatus === 'in_progress' && <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90">Continue</Button>}
            {runStatus === 'completed' && (
              <Button size="sm" variant="outline">View results</Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function ParticipationPage(): React.ReactElement | null {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { participationId } = useParams({ from: '/app/participations/$participationId' })
  const id = parseInt(participationId, 10)

  const [participation, setParticipation] = useState<ScheduleParticipation | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('configure')

  const [progressOpen, setProgressOpen] = useState(true)
  const [statsOpen, setStatsOpen] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (!user) return
    api.participations
      .get(id)
      .then((p) => setParticipation(p))
      .catch(() =>
        toast.error('Failed to load participation', {
          description: 'Could not fetch training data.',
        }),
      )
      .finally(() => setPageLoading(false))
  }, [id, user])

  const handleTargetSaved = (runIndex: number, target: RunTarget): void => {
    setParticipation((prev) => {
      if (!prev) return prev
      const existing = prev.runTargets.filter((t) => t.runIndex !== runIndex)
      return { ...prev, runTargets: [...existing, target] }
    })
  }

  if (authLoading || !user) return null

  if (pageLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!participation) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">Participation not found.</p>
      </div>
    )
  }

  const { schedule } = participation
  const runDefs = schedule.runs

  const isOwner = participation.ownerUsername === user.username
  const runsCompleted = 0

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
            <BreadcrumbPage>{schedule.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{schedule.name}</h1>
            <Badge variant="outline" className="text-xs">
              {STATUS_LABELS[participation.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Started {formatDate(participation.startedAt)}
          </p>
        </div>

      </div>

      {participation.status === 'aborted' && participation.abortedAt && (
        <div className="mb-6 rounded-md border border-amber-600/30 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
          This participation was aborted on {formatDate(participation.abortedAt)}.
        </div>
      )}

      {participation.status === 'completed' && participation.completedAt && (
        <div className="mb-6 rounded-md border px-4 py-3 text-sm text-muted-foreground">
          Completed on {formatDate(participation.completedAt)}.
        </div>
      )}

      <div className="mb-6 rounded-lg border bg-card">
        <div className="border-b px-4 py-2.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Schedule
          </span>
        </div>
        <div
          className="flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
          onClick={() => void navigate({ to: '/app/schedules/$scheduleId', params: { scheduleId: String(schedule.id) } })}
        >
          <UserAvatar username={schedule.createdBy.username} avatarUrl={schedule.createdBy.avatarUrl} />
          <span className="flex-1 font-medium">{schedule.name}</span>
          <Badge variant="outline" className="text-xs">Locked</Badge>
          <span className="text-sm tabular-nums text-muted-foreground">
            {schedule.runCount} runs
          </span>
          {schedule.totalHours > 0 && (
            <span className="hidden text-sm text-muted-foreground sm:block">
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
          <div className="flex flex-col gap-4">
            {Array.from({ length: schedule.runCount }, (_, i) => {
              const runDef = runDefs[i] ?? { target_hours: 0, break_after_hours: 0 }
              const runStatus: RunStatus = 'not_started'
              const runTarget = participation.runTargets.find((t) => t.runIndex === i)
              const prevCompleted = i === 0 || runsCompleted >= i
              return (
                <RunCard
                  key={i}
                  runIndex={i}
                  targetHours={runDef.target_hours}
                  breakAfterHours={runDef.break_after_hours}
                  runStatus={runStatus}
                  runTarget={runTarget}
                  participationId={participation.id}
                  participationStatus={participation.status}
                  prevRunCompleted={prevCompleted}
                  isOwner={isOwner}
                  onTargetSaved={(t) => handleTargetSaved(i, t)}
                />
              )
            })}
          </div>
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
                  Your overall progress through this training will be shown here — how far along you are across all runs.
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
                  Stats from your completed runs will appear here — accuracy and solve time per run, comparable across runs and other participants.
                </p>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
