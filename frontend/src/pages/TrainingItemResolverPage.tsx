import * as React from 'react'
import { useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { api } from '../lib/api'
import { BoardPageSkeleton } from '../features/board/BoardPageSkeleton'
import { useChessTheme } from '../hooks/useChessTheme'
import { useAuth } from '../context/auth'

const TERMINAL_STATUSES = new Set(['solved', 'solved_with_retries', 'failed'])

export function TrainingItemResolverPage(): React.ReactElement {
  const { user } = useAuth()
  useChessTheme(user?.boardTheme, user?.pieceTheme)
  const navigate = useNavigate()
  const { runId: runIdStr, runTrainingItemId: runTrainingItemIdStr } = useParams({
    from: '/app/solve-flow/runs/$runId/training-items/$runTrainingItemId',
  })
  const runId = parseInt(runIdStr, 10)
  const runTrainingItemId = parseInt(runTrainingItemIdStr, 10)

  useEffect(() => {
    api.runs
      .getTrainingItem(runId, runTrainingItemId)
      .then(async (item) => {
        const base = {
          runId: runIdStr,
          runTrainingItemId: runTrainingItemIdStr,
        }

        if (item.currentAttemptId !== null) {
          void navigate({
            to: '/app/runs/$runId/training-items/$runTrainingItemId/attempts/$attemptId',
            params: { ...base, attemptId: String(item.currentAttemptId) },
            replace: true,
          })
          return
        }

        if (!TERMINAL_STATUSES.has(item.positionStatus)) {
          const started = await api.runs.startTrainingItem(runId, runTrainingItemId)
          void navigate({
            to: '/app/runs/$runId/training-items/$runTrainingItemId/attempts/$attemptId',
            params: { ...base, attemptId: String(started.attempt.id) },
            replace: true,
          })
          return
        }

        void navigate({
          to: '/app/runs/$runId/training-items/$runTrainingItemId/overview',
          params: { runId: runIdStr, runTrainingItemId: runTrainingItemIdStr },
          replace: true,
        })
      })
      .catch(() => {
        void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
      })
  }, [runId, runTrainingItemId])

  return <BoardPageSkeleton />
}
