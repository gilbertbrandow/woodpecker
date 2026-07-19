import * as React from 'react'
import { useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { toast } from '../lib/toast'
import { api } from '../lib/api'
import { BoardPageSkeleton } from '../features/board/BoardPageSkeleton'
import { useChessTheme } from '../hooks/useChessTheme'
import { useAuth } from '../context/auth'

export function RunResolverPage(): React.ReactElement {
  const { user } = useAuth()
  useChessTheme(user?.boardTheme, user?.pieceTheme)
  const navigate = useNavigate()
  const { runId: runIdStr } = useParams({ from: '/app/solve-flow/runs/$runId/solve' })
  const runId = parseInt(runIdStr, 10)

  useEffect(() => {
    api.runs
      .continue(runId)
      .then((result) => {
        if (result.runCompleted || result.attemptView === null) {
          toast.error('Run is complete', { description: 'No more puzzles to solve.' })
          void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
          return
        }
        const av = result.attemptView
        void navigate({
          to: '/app/runs/$runId/training-items/$runTrainingItemId/attempts/$attemptId',
          params: {
            runId: runIdStr,
            runTrainingItemId: String(av.runTrainingItem.id),
            attemptId: String(av.attempt.id),
          },
          replace: true,
        })
      })
      .catch(() => {
        void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
      })
  }, [runId])

  return <BoardPageSkeleton />
}
