import * as React from 'react'
import { useParams } from '@tanstack/react-router'
import { useBoardPageController } from '../features/board/useBoardPageController'
import { BoardFocusView } from '../features/board/BoardFocusView'
import { BoardFailedView } from '../features/board/BoardFailedView'
import { BoardOverviewView } from '../features/board/BoardOverviewView'

export function BoardPage(): React.ReactElement | null {
  const { runId: runIdStr, runPuzzleId: runPuzzleIdStr, attemptId: attemptIdStr } = useParams({
    from: '/app/solve-flow/runs/$runId/puzzles/$runPuzzleId/attempts/$attemptId',
  })
  const runId = parseInt(runIdStr, 10)
  const runPuzzleId = parseInt(runPuzzleIdStr, 10)
  const attemptId = parseInt(attemptIdStr, 10)

  const ctrl = useBoardPageController({ runId, runPuzzleId, attemptId, runIdStr })

  if (!ctrl.puzzle || ctrl.mode === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (ctrl.mode === 'focus') return <BoardFocusView puzzle={ctrl.puzzle} ctrl={ctrl} runIdStr={runIdStr} />
  if (ctrl.mode === 'failed') return <BoardFailedView puzzle={ctrl.puzzle} ctrl={ctrl} runIdStr={runIdStr} />
  return <BoardOverviewView puzzle={ctrl.puzzle} ctrl={ctrl} runIdStr={runIdStr} />
}
