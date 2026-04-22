import * as React from 'react'
import { RotateCcw, ExternalLink, SkipForward } from 'lucide-react'
import { Button, buttonVariants } from '../../components/ui/button'
import { cn } from '../../lib/utils'
import type { Run } from '../../lib/api'

type OverviewActionsSectionProps = {
  run: Run
  isLoadingNextPuzzle: boolean
  gameUrl: string
  onNextPuzzle: () => void
  onRetake: () => void
}

export function OverviewActionsSection({ run, isLoadingNextPuzzle, gameUrl, onNextPuzzle, onRetake }: OverviewActionsSectionProps): React.ReactElement {
  return (
    <div className="mt-auto flex flex-col gap-3">
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          disabled={run.status !== 'active' || isLoadingNextPuzzle}
          onClick={onRetake}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Retake
        </Button>
        <a
          href={gameUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Analyze
        </a>
      </div>
      {run.status === 'completed' && (
        <p className="text-center text-xs text-muted-foreground">Run complete</p>
      )}
      {run.status === 'aborted' && (
        <p className="text-center text-xs text-muted-foreground">Run aborted</p>
      )}
      <Button
        className="w-full bg-foreground text-background hover:bg-foreground/90"
        disabled={run.status !== 'active' || isLoadingNextPuzzle}
        onClick={onNextPuzzle}
      >
        <SkipForward className="mr-2 h-4 w-4" />
        Next puzzle
      </Button>
    </div>
  )
}
