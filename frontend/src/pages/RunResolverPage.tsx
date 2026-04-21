import * as React from 'react'
import { useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '../lib/api'

export function RunResolverPage(): React.ReactElement {
  const navigate = useNavigate()
  const { runId: runIdStr } = useParams({ from: '/app/solve-flow/runs/$runId/solve' })
  const runId = parseInt(runIdStr, 10)

  useEffect(() => {
    api.runs
      .continue(runId)
      .then((puzzle) => {
        if (puzzle.currentAttemptId === null) {
          toast.error('Run is complete', { description: 'No more puzzles to solve.' })
          void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
          return
        }
        void navigate({
          to: '/app/runs/$runId/puzzles/$runPuzzleId/attempts/$attemptId',
          params: {
            runId: runIdStr,
            runPuzzleId: String(puzzle.runPuzzleId),
            attemptId: String(puzzle.currentAttemptId),
          },
          replace: true,
        })
      })
      .catch(() => {
        toast.error('Failed to load next puzzle', { description: 'Please try again.' })
        void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
      })
  }, [runId])

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  )
}
