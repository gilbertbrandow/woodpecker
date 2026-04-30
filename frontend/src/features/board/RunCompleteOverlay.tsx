import * as React from 'react'
import confetti from 'canvas-confetti'
import { X } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '../../components/ui/button'
import type { RunPuzzleOverview } from '../../lib/api'

type RunCompleteOverlayProps = {
  overlayData: NonNullable<RunPuzzleOverview['runCompleteOverlay']>
  onClose: () => void
}

export function RunCompleteOverlay({
  overlayData,
  onClose,
}: RunCompleteOverlayProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

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

  const title = overlayData.isTrainingComplete
    ? 'Training complete!'
    : `Run ${overlayData.runIndex + 1} complete!`

  const body = overlayData.isTrainingComplete
    ? "Congratulations on finishing the full training set. You've worked through every puzzle — well done."
    : overlayData.breakDuration !== null
      ? `You've earned your break. Take a ${overlayData.breakDuration} break now and come back after that.`
      : 'Ready to head back?'

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
        <p className="text-lg font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
        <Button
          size="sm"
          onClick={() => void navigate({ to: '/app' })}
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  )
}
