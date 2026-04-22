import * as React from 'react'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'
import type { RunPuzzleFull, Run, AttemptSummary } from '../../lib/api'
import { formatTimer } from './boardPage.helpers'
import { TimerCard } from './TimerCard'
import { PuzzleMetaCard } from './PuzzleMetaCard'
import { OverviewActionsSection } from './OverviewActionsSection'

type OverviewSidebarRightProps = {
  puzzle: RunPuzzleFull
  run: Run
  frozenTimerTenths: number
  selectedAttempt: AttemptSummary | null
  metTargetTime: boolean | null
  isLoadingNextPuzzle: boolean
  onNextPuzzle: () => void
  onRetake: () => void
  boardSize: number
}

export function OverviewSidebarRight({
  puzzle,
  run,
  frozenTimerTenths,
  selectedAttempt,
  metTargetTime,
  isLoadingNextPuzzle,
  onNextPuzzle,
  onRetake,
  boardSize,
}: OverviewSidebarRightProps): React.ReactElement {
  const isSolved = selectedAttempt?.status === 'solved'

  const timerRightSlot = (
    <>
      {metTargetTime !== null && (
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <span
              className={`inline-flex cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                metTargetTime
                  ? 'border-green-600/20 bg-green-500/15 text-green-700 dark:text-green-400'
                  : 'border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
              }`}
            >
              <Clock className="h-3 w-3" />
              Time
            </span>
          </TooltipTrigger>
          <TooltipContent>{metTargetTime ? 'Moved within target time' : 'Target time missed'}</TooltipContent>
        </Tooltip>
      )}
      {selectedAttempt !== null && (
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <span
              className={`inline-flex cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                isSolved
                  ? 'border-green-600/20 bg-green-500/15 text-green-700 dark:text-green-400'
                  : 'border-red-600/20 bg-red-500/15 text-red-700 dark:text-red-400'
              }`}
            >
              {isSolved ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {isSolved ? 'Solved' : 'Failed'}
            </span>
          </TooltipTrigger>
          <TooltipContent>{isSolved ? 'Correctly solved' : 'Not solved'}</TooltipContent>
        </Tooltip>
      )}
    </>
  )

  return (
    <aside className="hidden flex-1 flex-col gap-4 md:flex" style={{ height: boardSize }}>
      <div className="flex flex-col gap-2">
        <TimerCard
          timerText={formatTimer(frozenTimerTenths)}
          elapsedTenths={frozenTimerTenths}
          targetSolveTenths={null}
          rightSlot={timerRightSlot}
        />
        <PuzzleMetaCard
          puzzleId={puzzle.puzzleId}
          rating={puzzle.rating}
          themes={puzzle.themes}
          baseFen={puzzle.fen}
          solutionMoves={puzzle.solution}
          attemptMoves={selectedAttempt?.moves}
          attemptStatus={selectedAttempt?.status === 'solved' || selectedAttempt?.status === 'failed' ? selectedAttempt.status : undefined}
        />
      </div>
      <OverviewActionsSection
        run={run}
        isLoadingNextPuzzle={isLoadingNextPuzzle}
        gameUrl={puzzle.gameUrl}
        onNextPuzzle={onNextPuzzle}
        onRetake={onRetake}
      />
    </aside>
  )
}
