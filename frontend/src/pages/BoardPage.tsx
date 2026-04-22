import * as React from 'react'
import { useLocation } from '@tanstack/react-router'
import { useBoardPageController } from '../features/board/useBoardPageController'
import { BoardFocusView } from '../features/board/BoardFocusView'
import { BoardFailedView } from '../features/board/BoardFailedView'
import { BoardOverviewView } from '../features/board/BoardOverviewView'

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }

  return null
}

export function BoardPage(): React.ReactElement | null {
  const location = useLocation({
    select: (loc) => ({ pathname: loc.pathname, searchStr: loc.searchStr }),
  })

  const attemptMatch = location.pathname.match(/^\/app\/runs\/(\d+)\/puzzles\/(\d+)\/attempts\/(\d+)$/)
  const overviewMatch = location.pathname.match(/^\/app\/runs\/(\d+)\/puzzles\/(\d+)\/overview$/)

  const routeKind = attemptMatch ? 'attempt' : 'overview'
  const runIdStr = attemptMatch?.[1] ?? overviewMatch?.[1] ?? ''
  const runPuzzleIdStr = attemptMatch?.[2] ?? overviewMatch?.[2] ?? ''
  const runId = parsePositiveInt(runIdStr) ?? Number.NaN
  const runPuzzleId = parsePositiveInt(runPuzzleIdStr) ?? Number.NaN
  const attemptId = parsePositiveInt(attemptMatch?.[3])
  const requestedOverviewAttemptId = React.useMemo(() => {
    if (routeKind !== 'overview') return null
    const searchParams = new URLSearchParams(location.searchStr)
    return parsePositiveInt(searchParams.get('attempt'))
  }, [location.searchStr, routeKind])

  const ctrl = useBoardPageController({
    runId,
    runPuzzleId,
    attemptId,
    runIdStr,
    runPuzzleIdStr,
    routeKind,
  })

  if (!ctrl.puzzle || ctrl.mode === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (ctrl.mode === 'focus') return <BoardFocusView puzzle={ctrl.puzzle} ctrl={ctrl} runIdStr={runIdStr} />
  if (ctrl.mode === 'failed') return <BoardFailedView puzzle={ctrl.puzzle} ctrl={ctrl} runIdStr={runIdStr} />
  return (
    <BoardOverviewView
      puzzle={ctrl.puzzle}
      ctrl={ctrl}
      runIdStr={runIdStr}
      runPuzzleIdStr={runPuzzleIdStr}
      requestedAttemptId={requestedOverviewAttemptId}
    />
  )
}
