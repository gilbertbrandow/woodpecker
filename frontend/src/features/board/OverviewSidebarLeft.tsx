import * as React from 'react'
import { ProgressBar } from '../../components/ProgressBar'
import type { RunPuzzleFull, Run, PuzzleRunReference } from '../../lib/api'
import type { StatsResult } from './boardPage.helpers'
import { formatNumber } from '../../lib/utils'
import { DeltaBadge } from './DeltaBadge'
import { BoardBreadcrumbs } from './BoardBreadcrumbs'
import { AttemptTable } from './AttemptTable'
import { OverviewStatsSection } from './OverviewStatsSection'

type OverviewSidebarLeftProps = {
  puzzle: RunPuzzleFull
  participationId: number | null
  runIdStr: string
  run: Run
  afterStats: StatsResult | null
  accuracyDelta: number | null
  timeDelta: number | null
  selectedAttemptId: number | null
  runProgressPct: number
  runProgressDelta: number | null
  onSelectAttempt: (id: number) => void
  boardSize: number
  crossRunRefs: PuzzleRunReference[]
  onSwitchRun: (targetRunId: number, targetRunPuzzleId: number) => void
}

export function OverviewSidebarLeft({
  puzzle,
  participationId,
  runIdStr,
  run,
  afterStats,
  accuracyDelta,
  timeDelta,
  selectedAttemptId,
  runProgressPct,
  runProgressDelta,
  onSelectAttempt,
  boardSize,
  crossRunRefs,
  onSwitchRun,
}: OverviewSidebarLeftProps): React.ReactElement {
  const resolvedCount = run.solvedCount + run.solvedWithRetriesCount + run.failedCount

  return (
    <aside className="hidden flex-1 flex-col gap-4 md:flex" style={{ height: boardSize }}>
      <BoardBreadcrumbs puzzle={puzzle} participationId={participationId} runIdStr={runIdStr} />
      {crossRunRefs.length > 1 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            View run
          </span>
          <select
            value={run.id}
            onChange={(e) => {
              const targetRunId = Number(e.target.value)
              const ref = crossRunRefs.find((r) => r.runId === targetRunId)
              if (ref) onSwitchRun(ref.runId, ref.runPuzzleId)
            }}
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {crossRunRefs.map((ref) => (
              <option key={ref.runId} value={ref.runId}>
                {`Run ${ref.runIndex + 1}${!ref.hasAttempts ? ' (no attempts)' : ''}`}
              </option>
            ))}
          </select>
        </div>
      )}
      <AttemptTable
        tries={puzzle.tries}
        maxTriesPerPuzzle={puzzle.maxTriesPerPuzzle}
        selectedAttemptId={selectedAttemptId}
        onSelect={onSelectAttempt}
      />
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Run progress
        </span>
        <ProgressBar
          value={runProgressPct}
          tooltipLabel={`${formatNumber(resolvedCount)} of ${formatNumber(run.totalPuzzles)} puzzles resolved`}
          className="w-full"
        />
        <DeltaBadge
          delta={runProgressDelta}
          goodWhenPositive={true}
          format={(n) => `${n.toFixed(1)}%`}
        />
      </div>
      {afterStats !== null && (
        <OverviewStatsSection
          afterStats={afterStats}
          accuracyDelta={accuracyDelta}
          timeDelta={timeDelta}
        />
      )}
    </aside>
  )
}
