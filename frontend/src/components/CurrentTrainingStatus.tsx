import * as React from 'react'
import { type TrainingDetailStatus } from '../lib/api'
import { StatusBadge } from './StatusBadge'

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  if (days >= 1) return `${days} day${days !== 1 ? 's' : ''}${hours > 0 ? ` ${hours}h` : ''}`
  const mins = Math.floor((totalSeconds % 3600) / 60)
  if (hours >= 1) return `${hours} hour${hours !== 1 ? 's' : ''}${mins > 0 ? ` ${mins}m` : ''}`
  return `${mins} min${mins !== 1 ? 's' : ''}`
}


interface CurrentTrainingStatusProps {
  status: TrainingDetailStatus
}

export function CurrentTrainingStatus({
  status,
}: CurrentTrainingStatusProps): React.ReactElement | null {
  const { state } = status

  if (state === 'completed' || state === 'aborted') return null

  if (state === 'not_started') {
    return (
      <div className="mb-6 rounded-md border bg-muted/30 px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div>
            <p className="font-medium text-foreground">Ready to start</p>
            <p className="mt-0.5 text-muted-foreground">
              {status.totalRuns} run{status.totalRuns !== 1 ? 's' : ''} in this training
            </p>
          </div>
          <StatusBadge status="not_started" />
        </div>
      </div>
    )
  }

  if (state === 'scheduled_break') {
    return (
      <div className="mb-6 rounded-md border bg-muted/50 px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div>
            <p className="font-medium text-foreground">Scheduled break</p>
            <p className="mt-0.5 text-muted-foreground">
              {formatMs(status.breakRemainingMs!)} remaining before you should start run #{status.nextRunIndex! + 1}
            </p>
          </div>
          <StatusBadge status="scheduled_break" />
        </div>
      </div>
    )
  }

  if (state === 'overdue_to_start_next_run') {
    return (
      <div className="mb-6 rounded-md border bg-muted/30 px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div>
            <p className="font-medium text-foreground">Ready for Run #{status.nextRunIndex! + 1}</p>
            <p className="mt-0.5 text-muted-foreground">
              Break ended {formatMs(status.elapsedSinceBreakEndMs!)} ago
            </p>
          </div>
          <StatusBadge status="overdue" />
        </div>
      </div>
    )
  }

  // active_run_overdue — dedicated layout
  if (state === 'active_run_overdue') {
    const deadline = status.runDeadlineAt
      ? new Date(status.runDeadlineAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      : null
    return (
      <div className="mb-6 rounded-md border px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div>
            <p className="font-medium text-foreground">Run #{(status.runIndex ?? 0) + 1} overdue</p>
            {deadline && (
              <p className="mt-0.5 text-muted-foreground">Should have been completed {deadline}</p>
            )}
          </div>
          <StatusBadge status="run_overdue" />
        </div>
      </div>
    )
  }

  // active_run_behind / on_track / ahead — shared layout
  const badgeStatus =
    state === 'active_run_behind' ? 'behind'
    : state === 'active_run_ahead' ? 'ahead'
    : 'on_track'

  const resolved = status.resolvedCount ?? 0
  const total = status.totalItems ?? 0
  const puzzlesBefore = status.puzzlesToSolveBeforeTomorrow ?? 0

  return (
    <div className="mb-6 rounded-md border px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          <p className="font-medium text-foreground">Run #{(status.runIndex ?? 0) + 1}</p>
          <p className="mt-0.5 text-muted-foreground">
            {resolved} / {total} puzzles resolved
            {puzzlesBefore > 0 && `, expect ${puzzlesBefore} more before tomorrow`}
          </p>
        </div>
        <StatusBadge status={badgeStatus} />
      </div>
    </div>
  )
}
