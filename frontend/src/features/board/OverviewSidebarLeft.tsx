import * as React from 'react'
import { ProgressCard } from './ProgressCard'
import type { RunTrainingItemOverview, PaceChartData } from '../../lib/api'
import { OverviewStatsSection } from './OverviewStatsSection'
import { RunPaceCard } from './RunPaceCard'

type OverviewSidebarLeftProps = {
  runIndex: number
  paceChart: PaceChartData | null
  isRunActive: boolean
  accuracy: RunTrainingItemOverview['stats']['accuracy']
  averageSolveTime: RunTrainingItemOverview['stats']['averageSolveTime']
  runProgress: RunTrainingItemOverview['progress']['runProgress']
  trainingProgress: RunTrainingItemOverview['progress']['trainingProgress']
}

export function OverviewSidebarLeft({
  runIndex,
  paceChart,
  isRunActive,
  accuracy,
  averageSolveTime,
  runProgress,
  trainingProgress,
}: OverviewSidebarLeftProps): React.ReactElement {
  return (
    <>
      {paceChart !== null && <RunPaceCard chartData={paceChart} isRunActive={isRunActive} stretch />}
      <OverviewStatsSection
        runIndex={runIndex}
        accuracy={accuracy}
        averageSolveTime={averageSolveTime}
      />
      <ProgressCard
        runProgress={runProgress}
        trainingProgress={trainingProgress}
      />
    </>
  )
}


