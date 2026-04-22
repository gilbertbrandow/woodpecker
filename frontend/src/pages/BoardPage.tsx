import * as React from 'react'
import { useLocation, useParams, useSearch } from '@tanstack/react-router'
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
  const params = useParams({ strict: false })
  const search = useSearch({ strict: false })
  const location = useLocation({
    select: (loc) => ({ pathname: loc.pathname, searchStr: loc.searchStr }),
  })

  const runIdStr = typeof params.runId === 'string' ? params.runId : ''
  const runPuzzleIdStr = typeof params.runPuzzleId === 'string' ? params.runPuzzleId : ''
  const isAttemptRoute = /\/attempts\//.test(location.pathname)
  const routeKind = isAttemptRoute ? 'attempt' : 'overview'
  const runId = parsePositiveInt(runIdStr) ?? Number.NaN
  const runPuzzleId = parsePositiveInt(runPuzzleIdStr) ?? Number.NaN
  const attemptId = routeKind === 'attempt' ? parsePositiveInt(params.attemptId) : null
  const requestedOverviewAttemptId = React.useMemo(() => {
    if (routeKind !== 'overview') return null
    return parsePositiveInt(search.attempt)
  }, [routeKind, search.attempt])

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
