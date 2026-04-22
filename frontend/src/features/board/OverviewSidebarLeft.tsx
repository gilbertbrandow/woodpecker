import * as React from 'react'
import { ProgressCard } from './ProgressCard'
import type { RunPuzzleFull, Run } from '../../lib/api'
import type { StatsResult } from './boardPage.helpers'
import { computeTrainingProgressPct } from './boardPage.helpers'
import { formatNumber } from '../../lib/utils'
import { BoardBreadcrumbs } from './BoardBreadcrumbs'
import { OverviewStatsSection } from './OverviewStatsSection'

type OverviewSidebarLeftProps = {
  puzzle: RunPuzzleFull
  participationId: number | null
  runIdStr: string
  run: Run
  afterStats: StatsResult | null
  accuracyDelta: number | null
  timeDelta: number | null
  runProgressPct: number
  runProgressDelta: number | null
  allRuns: Run[] | null
  trainingProgressDelta: number | null
  scheduleName: string | null
  boardSize: number
}

export function OverviewSidebarLeft({
  puzzle,
  participationId,
  runIdStr,
  run,
  afterStats,
  accuracyDelta,
  timeDelta,
  runProgressPct,
  runProgressDelta,
  allRuns,
  trainingProgressDelta,
  scheduleName,
  boardSize,
}: OverviewSidebarLeftProps): React.ReactElement {
  const resolvedCount = run.solvedCount + run.solvedWithRetriesCount + run.failedCount

  const trainingResolved = allRuns !== null
    ? allRuns.reduce((s, r) => s + r.solvedCount + r.solvedWithRetriesCount + r.failedCount, 0)
    : 0
  const trainingTotal = allRuns !== null
    ? allRuns.reduce((s, r) => s + r.totalPuzzles, 0)
    : 0

  return (
    <aside className="hidden flex-1 flex-col gap-4 md:flex" style={{ height: boardSize }}>
      <BoardBreadcrumbs puzzle={puzzle} participationId={participationId} runIdStr={runIdStr} />
      <ProgressCard
        runProgress={{
          label: `Run ${run.runIndex + 1}`,
          value: runProgressPct,
          tooltipLabel: `${formatNumber(resolvedCount)} of ${formatNumber(run.totalPuzzles)} puzzles completed`,
          delta: runProgressDelta,
        }}
        trainingProgress={allRuns !== null ? {
          label: scheduleName ?? 'Training',
          value: computeTrainingProgressPct(allRuns),
          tooltipLabel: `${formatNumber(trainingResolved)} of ${formatNumber(trainingTotal)} puzzles completed across all runs`,
          delta: trainingProgressDelta,
        } : null}
      />
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

