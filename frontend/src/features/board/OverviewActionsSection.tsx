import * as React from 'react'
import { Button } from '../../components/ui/button'
import type { Run } from '../../lib/api'

type OverviewActionsSectionProps = {
  run: Run
  isLoadingNextPuzzle: boolean
  onNextPuzzle: () => void
  onRetake: () => void
}

export function OverviewActionsSection({ run, isLoadingNextPuzzle, onNextPuzzle, onRetake }: OverviewActionsSectionProps): React.ReactElement {
  return (
    <div className="mt-auto flex flex-col gap-3">
      <Button
        className="w-full bg-foreground text-background hover:bg-foreground/90"
        disabled={run.status !== 'active' || isLoadingNextPuzzle}
        onClick={onNextPuzzle}
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
        onClick={onRetake}
      >
        Retake
      </Button>
    </div>
  )
}
