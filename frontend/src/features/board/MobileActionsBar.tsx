import * as React from 'react'
import { Clock, CheckCircle2, XCircle, RotateCcw, ExternalLink, SkipForward, ClockArrowUp, ClockArrowDown } from 'lucide-react'
import { Button, buttonVariants } from '../../components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'
import { cn } from '../../lib/utils'
import { MoveStatusCard } from './MoveStatusCard'
import type { Orientation } from './boardPage.helpers'
import type { MoveFeedbackResult } from './boardPage.helpers'
import type { OverviewAttemptView } from '../../lib/api'

type FocusModeProps = {
  mode: 'focus'
  timerText: string
  lastMoveResult: MoveFeedbackResult | null
  turnToMove: Orientation
  kingPieceUrl: string
}

type FailedModeProps = {
  mode: 'failed'
  timerText: string
  timeTargetState: 'fast' | 'in_window' | 'missed' | null
  inputBlocked: boolean
  onHint: () => void
  onSolution: () => void
  lastMoveResult: MoveFeedbackResult | null
  turnToMove: Orientation
  kingPieceUrl: string
}

type OverviewModeProps = {
  mode: 'overview'
  timerText: string
  timeTargetState: 'fast' | 'in_window' | 'missed' | null
  displayedAttempt: OverviewAttemptView | null
  analyzeUrl: string | null
  nextDisabledReason: string | null
  isLoadingNextPuzzle: boolean
  onRetake: () => void
  onNextPuzzle: () => void
}

export type MobileActionsBarProps = FocusModeProps | FailedModeProps | OverviewModeProps

export function MobileActionsBar(props: MobileActionsBarProps): React.ReactElement | null {
  if (props.mode === 'focus') {
    return (
      <div className="mt-3 flex items-center justify-between">
        <span className="tabular-nums text-sm font-medium">{props.timerText}</span>
        <MoveStatusCard
          lastMoveResult={props.lastMoveResult}
          turnToMove={props.turnToMove}
          kingPieceUrl={props.kingPieceUrl}
          compact={true}
        />
      </div>
    )
  }

  if (props.mode === 'failed') {
    const { timerText, timeTargetState, inputBlocked, onHint, onSolution, lastMoveResult, turnToMove, kingPieceUrl } = props
    const timeClasses =
      timeTargetState === 'fast'
        ? 'border-stone-400/30 bg-stone-500/10 text-stone-600 dark:text-stone-400'
        : timeTargetState === 'in_window'
          ? 'border-green-600/20 bg-green-500/15 text-green-700 dark:text-green-400'
          : 'border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
    const timeLabel = timeTargetState === 'fast' ? 'Hasty' : timeTargetState === 'in_window' ? 'Time' : 'Too slow'
    const TimeIcon = timeTargetState === 'fast' ? ClockArrowUp : timeTargetState === 'missed' ? ClockArrowDown : Clock
    return (
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-sm font-medium">{timerText}</span>
          {timeTargetState !== null && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${timeClasses}`}>
              <TimeIcon className="h-3 w-3" />
              {timeLabel}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-red-600/20 bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onHint} disabled={inputBlocked}>
            Hint
          </Button>
          <Button variant="outline" className="flex-1" onClick={onSolution} disabled={inputBlocked}>
            Solution
          </Button>
        </div>
        <MoveStatusCard
          lastMoveResult={lastMoveResult}
          turnToMove={turnToMove}
          kingPieceUrl={kingPieceUrl}
          compact={true}
        />
      </div>
    )
  }

  // overview mode
  const { timerText, timeTargetState, displayedAttempt, analyzeUrl, nextDisabledReason, isLoadingNextPuzzle, onRetake, onNextPuzzle } = props
  const isSolved = displayedAttempt?.status === 'solved'
  const timeClasses =
    timeTargetState === 'fast'
      ? 'border-stone-400/30 bg-stone-500/10 text-stone-600 dark:text-stone-400'
      : timeTargetState === 'in_window'
        ? 'border-green-600/20 bg-green-500/15 text-green-700 dark:text-green-400'
        : 'border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
  const timeLabel = timeTargetState === 'fast' ? 'Hasty' : timeTargetState === 'in_window' ? 'Time' : 'Too slow'
  const TimeIcon = timeTargetState === 'fast' ? ClockArrowUp : timeTargetState === 'missed' ? ClockArrowDown : Clock
  const timeTooltip =
    timeTargetState === 'fast'
      ? 'Solved puzzle faster than target'
      : timeTargetState === 'in_window'
        ? 'Completed within target time'
        : 'Solved puzzle slower than target'
  return (
    <div className="mt-3 flex flex-col gap-2 pb-3">
      <div className="flex items-center gap-2">
        <span className="tabular-nums text-sm font-medium">{timerText}</span>
        {timeTargetState !== null && (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <span className={`inline-flex cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${timeClasses}`}>
                <TimeIcon className="h-3 w-3" />
                {timeLabel}
              </span>
            </TooltipTrigger>
            <TooltipContent>{timeTooltip}</TooltipContent>
          </Tooltip>
        )}
        {displayedAttempt !== null && (
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
        <div className="ml-auto flex items-center gap-1">
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={isLoadingNextPuzzle}
                onClick={onRetake}
              >
                <RotateCcw className="h-4 w-4" />
                <span className="sr-only">Retake</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Retake</TooltipContent>
          </Tooltip>
          {analyzeUrl !== null && (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <a
                  href={analyzeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-8 w-8')}
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="sr-only">Analyze</span>
                </a>
              </TooltipTrigger>
              <TooltipContent>Analyze</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <span className="w-full">
            <Button
              className="w-full bg-foreground text-background hover:bg-foreground/90"
              disabled={nextDisabledReason !== null || isLoadingNextPuzzle}
              onClick={onNextPuzzle}
            >
              <SkipForward className="mr-2 h-4 w-4" />
              Next puzzle
            </Button>
          </span>
        </TooltipTrigger>
        {nextDisabledReason !== null && (
          <TooltipContent>{nextDisabledReason}</TooltipContent>
        )}
      </Tooltip>
    </div>
  )
}
