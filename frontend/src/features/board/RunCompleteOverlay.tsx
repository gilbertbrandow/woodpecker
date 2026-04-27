import * as React from 'react'
import confetti from 'canvas-confetti'
import { X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import type { RunPuzzleOverview } from '../../lib/api'

type RunCompleteOverlayProps = {
  overlayData: NonNullable<RunPuzzleOverview['runCompleteOverlay']>
  onStartNextRun: () => Promise<void>
  isLoading: boolean
  onClose: () => void
}

export function RunCompleteOverlay({
  overlayData,
  onStartNextRun,
  isLoading,
  onClose,
}: RunCompleteOverlayProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = (rect.left + rect.width / 2) / window.innerWidth
    const cy = (rect.top + rect.height / 2) / window.innerHeight
    void confetti({
      origin: { x: cx, y: cy },
      disableForReducedMotion: true,
      particleCount: 300,
      spread: 120,
      startVelocity: 40,
      scalar: 1.4,
    })
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-30 flex items-center justify-center bg-background/80"
    >
      <button
        type="button"
        className="absolute top-2 right-2 rounded-md border border-border bg-background p-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <p className="text-lg font-semibold">Run {overlayData.runIndex + 1} complete!</p>
        <p className="text-sm text-muted-foreground">
          Ready for run {overlayData.runIndex + 2}?
        </p>
        <Button
          size="sm"
          onClick={() => void onStartNextRun()}
          disabled={isLoading}
        >
          {isLoading ? 'Starting…' : 'Start next run'}
        </Button>
      </div>
    </div>
  )
}
