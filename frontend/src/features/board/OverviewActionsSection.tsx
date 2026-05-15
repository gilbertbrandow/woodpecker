import * as React from 'react'
import { RotateCcw, ExternalLink, SkipForward } from 'lucide-react'
import { Button, buttonVariants } from '../../components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'
import { cn } from '../../lib/utils'

type OverviewActionsSectionProps = {
  nextPuzzleDisabledReason: string | null
  isLoadingNextPuzzle: boolean
  gameUrl: string | null
  onNextPuzzle: () => void
  onRetake: () => void
}

export function OverviewActionsSection({ nextPuzzleDisabledReason, isLoadingNextPuzzle, gameUrl, onNextPuzzle, onRetake }: OverviewActionsSectionProps): React.ReactElement {

  return (
    <div className="mt-auto flex flex-col gap-3">
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          disabled={isLoadingNextPuzzle}
          onClick={onRetake}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Retake
        </Button>
        {gameUrl !== null && (
          <a
            href={gameUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Analyze
          </a>
        )}
      </div>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <span className="w-full">
            <Button
              className="w-full bg-foreground text-background hover:bg-foreground/90"
              disabled={nextPuzzleDisabledReason !== null || isLoadingNextPuzzle}
              onClick={onNextPuzzle}
            >
              <SkipForward className="mr-2 h-4 w-4" />
              Next puzzle
            </Button>
          </span>
        </TooltipTrigger>
        {nextPuzzleDisabledReason !== null && (
          <TooltipContent>{nextPuzzleDisabledReason}</TooltipContent>
        )}
      </Tooltip>
    </div>
  )
}
