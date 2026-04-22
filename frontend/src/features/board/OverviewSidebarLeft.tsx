import * as React from 'react'
import { Badge } from '../../components/ui/badge'
import { ProgressBar } from '../../components/ProgressBar'
import type { RunPuzzleFull, Run } from '../../lib/api'
import type { StatsResult } from './boardPage.helpers'
import { POSITION_STATUS_CLASS, positionStatusLabel } from './boardPage.helpers'
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
}: OverviewSidebarLeftProps): React.ReactElement {
  const resolvedCount = run.solvedCount + run.solvedWithRetriesCount + run.failedCount

  return (
    <aside className="hidden flex-1 flex-col gap-4 md:flex" style={{ height: boardSize }}>
      <BoardBreadcrumbs puzzle={puzzle} participationId={participationId} runIdStr={runIdStr} />
      <Badge
        variant="outline"
        className={`w-fit text-xs ${POSITION_STATUS_CLASS[puzzle.positionStatus] ?? ''}`}
      >
        {positionStatusLabel(puzzle.positionStatus)}
      </Badge>
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
