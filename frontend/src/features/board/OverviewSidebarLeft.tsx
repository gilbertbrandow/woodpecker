import * as React from 'react'
import { RunPaceCard } from './RunPaceCard'
import { AccuracyChartCard } from './AccuracyChartCard'
import type { RunTrainingItemOverview, UserRef } from '../../lib/api'

type OverviewSidebarLeftProps = {
  paceChart: RunTrainingItemOverview['runPace']['chartData']
  accuracyChart: RunTrainingItemOverview['accuracyChart']
  accuracy: RunTrainingItemOverview['stats']['accuracy']
  averageSolveTime: RunTrainingItemOverview['stats']['averageSolveTime']
  runProgress: RunTrainingItemOverview['progress']['runProgress']
  trainingProgress: RunTrainingItemOverview['progress']['trainingProgress']
  runId: number
  subsetId: number | null
  scheduleId: number | null
  scheduleName: string | null
  currentUser: Pick<UserRef, 'avatarUrl' | 'displayName'>
}

export function OverviewSidebarLeft({
  paceChart,
  accuracyChart,
  accuracy,
  averageSolveTime,
  runProgress,
  trainingProgress,
  runId,
  subsetId,
  scheduleId,
  scheduleName,
  currentUser,
}: OverviewSidebarLeftProps): React.ReactElement {
  return (
    <>
      <RunPaceCard
        chartData={paceChart}
        runProgress={runProgress}
        trainingProgress={trainingProgress}
        stretch
      />
      <AccuracyChartCard
        runId={runId}
        subsetId={subsetId}
        scheduleId={scheduleId}
        scheduleName={scheduleName}
        accuracyChart={accuracyChart}
        accuracy={accuracy}
        averageSolveTime={averageSolveTime}
        currentUser={currentUser}
      />
    </>
  )
}
