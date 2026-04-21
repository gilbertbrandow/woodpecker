import * as React from 'react'
import { useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '../lib/api'

const TERMINAL_STATUSES = new Set(['solved', 'solved_with_retries', 'failed'])

export function PuzzleResolverPage(): React.ReactElement {
  const navigate = useNavigate()
  const { runId: runIdStr, runPuzzleId: runPuzzleIdStr } = useParams({
    from: '/app/runs/$runId/puzzles/$runPuzzleId',
  })
  const runId = parseInt(runIdStr, 10)
  const runPuzzleId = parseInt(runPuzzleIdStr, 10)

  useEffect(() => {
    api.runs
      .getPuzzle(runId, runPuzzleId)
      .then(async (puzzle) => {
        const base = {
          runId: runIdStr,
          runPuzzleId: runPuzzleIdStr,
        }

        if (puzzle.currentAttemptId !== null) {
          void navigate({
            to: '/app/runs/$runId/puzzles/$runPuzzleId/attempts/$attemptId',
            params: { ...base, attemptId: String(puzzle.currentAttemptId) },
            replace: true,
          })
          return
        }

        if (!TERMINAL_STATUSES.has(puzzle.positionStatus)) {
          const started = await api.runs.startPuzzle(runId, runPuzzleId)
          if (started.currentAttemptId === null) {
            toast.error('Could not start puzzle', { description: 'Please try again.' })
            void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
            return
          }
          void navigate({
            to: '/app/runs/$runId/puzzles/$runPuzzleId/attempts/$attemptId',
            params: { ...base, attemptId: String(started.currentAttemptId) },
            replace: true,
          })
          return
        }

        void navigate({
          to: '/app/runs/$runId/puzzles/$runPuzzleId/overview',
          params: { runId: runIdStr, runPuzzleId: runPuzzleIdStr },
          replace: true,
        })
      })
      .catch(() => {
        toast.error('Failed to load puzzle', { description: 'Please try again.' })
        void navigate({ to: '/app/runs/$runId', params: { runId: runIdStr }, replace: true })
      })
  }, [runId, runPuzzleId])

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  )
}
