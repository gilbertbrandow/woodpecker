import * as React from 'react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { BoardBreadcrumbs } from './BoardBreadcrumbs'
import { BoardCenterColumn } from './BoardCenterColumn'
import { OverviewAttemptHistory } from './OverviewAttemptHistory'
import { OverviewStatsSection } from './OverviewStatsSection'
import { OverviewActionsSection } from './OverviewActionsSection'
import { POSITION_STATUS_CLASS, positionStatusLabel } from './boardPage.helpers'
import type { BoardPageControllerResult } from './useBoardPageController'
import type { RunPuzzleFull } from '../../lib/api'

type BoardOverviewViewProps = {
  puzzle: RunPuzzleFull
  ctrl: BoardPageControllerResult
  runIdStr: string
}

export function BoardOverviewView({ puzzle, ctrl, runIdStr }: BoardOverviewViewProps): React.ReactElement {
  const { board, session, participationId, overview, isLoadingNextPuzzle, actions } = ctrl
  const { freshPuzzle, run, afterStats, accuracyDelta, timeDelta } = overview

  const mobileHeader = (
    <>
      <BoardBreadcrumbs puzzle={puzzle} participationId={participationId} runIdStr={runIdStr} />
      {freshPuzzle && (
        <div className="mt-1">
          <Badge
            variant="outline"
            className={`text-xs ${POSITION_STATUS_CLASS[freshPuzzle.positionStatus]}`}
          >
            {positionStatusLabel(freshPuzzle.positionStatus)}
          </Badge>
        </div>
      )}
    </>
  )

  const mobileExtras = freshPuzzle && afterStats && run ? (
    <div className="mt-4 flex flex-col gap-6">
      <OverviewStatsSection
        afterStats={afterStats}
        accuracyDelta={accuracyDelta}
        timeDelta={timeDelta}
      />
      <div className="flex flex-col gap-3">
        <Button
          className="w-full bg-foreground text-background hover:bg-foreground/90"
          disabled={run.status !== 'active' || isLoadingNextPuzzle}
          onClick={() => void actions.handleNextPuzzle()}
        >
          Next puzzle
        </Button>
        {run.status === 'completed' && (
          <p className="text-center text-xs text-muted-foreground">Run complete</p>
        )}
        {run.status === 'aborted' && (
          <p className="text-center text-xs text-muted-foreground">Run aborted</p>
        )}
        <Button
          variant="outline"
          className="w-full"
          disabled={run.status !== 'active' || isLoadingNextPuzzle}
          onClick={() => void actions.handleRetake()}
        >
          Retake
        </Button>
      </div>
    </div>
  ) : null

  return (
    <div className="flex flex-1 items-center justify-center overflow-hidden px-6">
      <div className="flex w-full items-start gap-6">
        <aside className="hidden flex-1 flex-col md:flex" style={{ height: board.boardSize }}>
          <div className="mb-6">
            <BoardBreadcrumbs puzzle={puzzle} participationId={participationId} runIdStr={runIdStr} />
          </div>
          {freshPuzzle ? (
            <div className="flex flex-col gap-4">
              <Badge
                variant="outline"
                className={`w-fit ${POSITION_STATUS_CLASS[freshPuzzle.positionStatus]}`}
              >
                {positionStatusLabel(freshPuzzle.positionStatus)}
              </Badge>
              <OverviewAttemptHistory freshPuzzle={freshPuzzle} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </aside>

        <BoardCenterColumn
          board={board}
          actions={actions}
          attemptHistory={session.attemptHistory}
          mobileHeader={mobileHeader}
          mobileExtras={mobileExtras}
        />

        <aside className="hidden flex-1 flex-col md:flex" style={{ height: board.boardSize }}>
          {afterStats && run ? (
            <>
              <OverviewStatsSection
                afterStats={afterStats}
                accuracyDelta={accuracyDelta}
                timeDelta={timeDelta}
              />
              <OverviewActionsSection
                run={run}
                isLoadingNextPuzzle={isLoadingNextPuzzle}
                onNextPuzzle={() => void actions.handleNextPuzzle()}
                onRetake={() => void actions.handleRetake()}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </aside>
      </div>
    </div>
  )
}
