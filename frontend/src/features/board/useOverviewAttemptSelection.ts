import { useState, useEffect, useMemo, useCallback } from 'react'
import type { RunTrainingItemOverview, OverviewAttemptView } from '../../lib/api'
import type { OverviewAttemptHistoryRow } from './OverviewAttemptHistoryTable'

type UseOverviewAttemptSelectionParams = {
  overviewData: RunTrainingItemOverview | null
  runTrainingItemId: number
  requestedAttemptId: number | null
  onUrlAttemptChange: (attemptId: number | null, replace: boolean) => void
}

export type OverviewAttemptSelectionResult = {
  selectedAttemptId: number | null
  selectedAttempt: OverviewAttemptView | null
  allAttempts: OverviewAttemptView[]
  historyRows: OverviewAttemptHistoryRow[]
  handleSelectAttempt: (attemptId: number) => void
}

export function useOverviewAttemptSelection({
  overviewData,
  runTrainingItemId,
  requestedAttemptId,
  onUrlAttemptChange,
}: UseOverviewAttemptSelectionParams): OverviewAttemptSelectionResult {
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null)

  const allAttempts = useMemo((): OverviewAttemptView[] => {
    if (!overviewData) return []
    const result: OverviewAttemptView[] = []
    for (const attempt of overviewData.attempts) {
      if (attempt.status !== 'in_progress') result.push(attempt)
    }
    for (const samePuzzle of overviewData.sameTrainingItemAcrossRuns) {
      for (const attempt of samePuzzle.attempts) {
        if (attempt.status !== 'in_progress') result.push(attempt)
      }
    }
    return result
  }, [overviewData])

  const historyRows = useMemo((): OverviewAttemptHistoryRow[] => {
    return allAttempts.map((attempt) => ({
      attemptId: attempt.id,
      runId: attempt.runId,
      runLabel: `Run ${attempt.runIndex + 1}`,
      runOrder: attempt.runIndex,
      runTrainingItemId: attempt.runTrainingItemId,
      tryNumber: attempt.tryNumber,
      countsTowardsTraining: attempt.countsTowardsTraining,
      result: attempt.status as 'solved' | 'failed',
      timeSpentMs: attempt.timeSpentMs,
    }))
  }, [allAttempts])

  const selectedAttempt = useMemo(
    () => allAttempts.find((a) => a.id === selectedAttemptId) ?? null,
    [allAttempts, selectedAttemptId],
  )

  useEffect(() => {
    setSelectedAttemptId(null)
  }, [runTrainingItemId])

  useEffect(() => {
    if (!overviewData) return
    const allIds = new Set(allAttempts.map((a) => a.id))
    const validRequested =
      requestedAttemptId !== null && allIds.has(requestedAttemptId) ? requestedAttemptId : null
    const nextId = validRequested ?? overviewData.selectedAttemptId
    setSelectedAttemptId(nextId)
    if (validRequested !== null && nextId !== null && nextId !== requestedAttemptId) {
      onUrlAttemptChange(nextId, true)
    }
  }, [overviewData, allAttempts, requestedAttemptId, onUrlAttemptChange])

  const handleSelectAttempt = useCallback(
    (aId: number): void => {
      if (aId === selectedAttemptId) return
      setSelectedAttemptId(aId)
      onUrlAttemptChange(aId, false)
    },
    [selectedAttemptId, onUrlAttemptChange],
  )

  return { selectedAttemptId, selectedAttempt, allAttempts, historyRows, handleSelectAttempt }
}
