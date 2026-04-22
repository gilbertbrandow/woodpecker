import { useMemo } from 'react'
import type { RunPuzzleFull, Run, ScheduleParticipation, AttemptSummary } from '../../lib/api'
import {
  computeQualifyingAttemptId,
  computeFrozenTimerTenths,
  computeMetTargetTime,
  computeRunProgressPct,
  computeRunProgressDelta,
} from './boardPage.helpers'

export type OverviewSelectionModel = {
  selectedAttempt: AttemptSummary | null
  qualifyingAttemptId: number | null
  frozenTimerTenths: number
  metTargetTime: boolean | null
  isQualifying: boolean
  runProgressPct: number
  runProgressDelta: number | null
  trainingProgressPct: number | null
  trainingProgressDelta: number | null
  displayedAccuracyDelta: number | null
  displayedTimeDelta: number | null
}

export function useOverviewSelectionModel(
  freshPuzzle: RunPuzzleFull | null,
  run: Run | null,
  _participation: ScheduleParticipation | null,
  selectedAttemptId: number | null,
  targetSolveTenths: number | null,
  accuracyDelta: number | null,
  timeDelta: number | null,
): OverviewSelectionModel | null {
  return useMemo(() => {
    if (!freshPuzzle || !run) return null

    const selectedAttempt = freshPuzzle.tries.find((a) => a.id === selectedAttemptId) ?? null
    const qualifyingAttemptId = computeQualifyingAttemptId(freshPuzzle.tries, freshPuzzle.maxTriesPerPuzzle)
    const frozen = selectedAttempt ? computeFrozenTimerTenths(selectedAttempt) : 0
    const met = selectedAttempt ? computeMetTargetTime(selectedAttempt, targetSolveTenths) : null
    const isQualifying = selectedAttemptId !== null && selectedAttemptId === qualifyingAttemptId
    const runPct = computeRunProgressPct(run)
    const runDelta = selectedAttemptId !== null
      ? computeRunProgressDelta(selectedAttemptId, qualifyingAttemptId, freshPuzzle.totalPuzzles)
      : null

    return {
      selectedAttempt,
      qualifyingAttemptId,
      frozenTimerTenths: frozen,
      metTargetTime: met,
      isQualifying,
      runProgressPct: runPct,
      runProgressDelta: runDelta,
      trainingProgressPct: null,   // Phase 2: deferred until training progress semantics confirmed
      trainingProgressDelta: null, // Phase 2: deferred until training progress semantics confirmed
      displayedAccuracyDelta: isQualifying ? accuracyDelta : null,
      displayedTimeDelta: isQualifying ? timeDelta : null,
    }
  }, [freshPuzzle, run, selectedAttemptId, targetSolveTenths, accuracyDelta, timeDelta])
}
