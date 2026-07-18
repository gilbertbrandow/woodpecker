import { useState, useEffect, useMemo, useCallback } from 'react'
import type { RunTrainingItemOverview, OverviewAttemptView } from '../../lib/api'

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
    return overviewData.attempts.filter((a) => a.status !== 'in_progress')
  }, [overviewData])

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

  return { selectedAttemptId, selectedAttempt, allAttempts, handleSelectAttempt }
}
