import * as React from 'react'
import { useRef, useEffect, useCallback } from 'react'
import { cn } from '../../lib/utils'
import { TrainingItemTypeBadge } from '../TrainingItemTypeBadge'
import type { TrainingItemSource } from '../../lib/api'

export type SliderSegment = { source: TrainingItemSource; percentage: number }

type SplitSliderProps = {
  segments: SliderSegment[]
  onChange: (segments: SliderSegment[]) => void
  disabled?: boolean
  className?: string
}

const MIN_LABEL_PCT = 14

const SEGMENT_BG: Partial<Record<TrainingItemSource, string>> = {
  LICHESS_TACTIC: 'bg-cyan-50 dark:bg-cyan-950/30',
  SCRAPED_POSITIONAL: 'bg-indigo-50 dark:bg-indigo-950/30',
}

export function SplitSlider({
  segments,
  onChange,
  disabled = false,
  className,
}: SplitSliderProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingHandle = useRef<number | null>(null)
  const onChangeRef = useRef(onChange)
  const segmentsRef = useRef(segments)

  useEffect(() => { onChangeRef.current = onChange })
  useEffect(() => { segmentsRef.current = segments })

  const pctFromClient = useCallback((clientX: number): number => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return 50
    return ((clientX - rect.left) / rect.width) * 100
  }, [])

  const applyDrag = useCallback((clientX: number): void => {
    const handleIdx = draggingHandle.current
    if (handleIdx === null) return
    const segs = segmentsRef.current
    let cumBefore = 0
    for (let i = 0; i < handleIdx; i++) cumBefore += segs[i]!.percentage
    const cumAfter = cumBefore + segs[handleIdx]!.percentage + segs[handleIdx + 1]!.percentage
    const rawPct = pctFromClient(clientX)
    const clamped = Math.round(Math.max(cumBefore + 1, Math.min(cumAfter - 1, rawPct)))
    const next = segs.map((s, i) => {
      if (i === handleIdx) return { ...s, percentage: clamped - cumBefore }
      if (i === handleIdx + 1) return { ...s, percentage: cumAfter - clamped }
      return s
    })
    onChangeRef.current(next)
  }, [pctFromClient])

  useEffect(() => {
    const onMove = (e: MouseEvent): void => { applyDrag(e.clientX) }
    const onUp = (): void => { draggingHandle.current = null }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [applyDrag])

  useEffect(() => {
    const onMove = (e: TouchEvent): void => {
      const touch = e.touches[0]
      if (touch) applyDrag(touch.clientX)
    }
    const onEnd = (): void => { draggingHandle.current = null }
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchend', onEnd)
    return () => {
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }
  }, [applyDrag])

  const startDrag = (clientX: number): void => {
    if (disabled || segments.length <= 1) return
    const clickPct = pctFromClient(clientX)
    let cum = 0
    let nearestIdx = 0
    let minDist = Infinity
    for (let i = 0; i < segments.length - 1; i++) {
      cum += segments[i]!.percentage
      const dist = Math.abs(cum - clickPct)
      if (dist < minDist) {
        minDist = dist
        nearestIdx = i
      }
    }
    draggingHandle.current = nearestIdx
    applyDrag(clientX)
  }

  const handlePositions: number[] = []
  {
    let cum = 0
    for (let i = 0; i < segments.length - 1; i++) {
      cum += segments[i]!.percentage
      handlePositions.push(cum)
    }
  }

  const isDraggable = !disabled && segments.length > 1

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-12 overflow-hidden rounded-lg select-none flex border border-border',
        isDraggable ? 'cursor-ew-resize' : 'cursor-default',
        className,
      )}
      onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX) }}
      onTouchStart={(e) => { const t = e.touches[0]; if (t) startDrag(t.clientX) }}
    >
      {segments.map((seg, i) => (
        <div
          key={seg.source}
          className={cn(
            'relative flex items-center justify-center overflow-hidden',
            SEGMENT_BG[seg.source],
            i > 0 && 'border-l border-border/40',
          )}
          style={{ width: `${seg.percentage}%` }}
        >
          {seg.percentage >= MIN_LABEL_PCT && (
            <div className="pointer-events-none">
              <TrainingItemTypeBadge source={seg.source} />
            </div>
          )}
          {seg.percentage > 0 && (
            <span className="absolute bottom-0.5 left-1.5 text-[9px] font-semibold tabular-nums text-foreground/60 dark:text-white dark:drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">
              {seg.percentage}%
            </span>
          )}
        </div>
      ))}

      {handlePositions.map((pos, i) => (
        <div
          key={i}
          className="pointer-events-none absolute top-0 bottom-0 z-10 flex w-3 -translate-x-1/2 items-center justify-center"
          style={{ left: `${pos}%` }}
        >
          <div className="h-full w-px bg-border/60" />
          <div className="absolute top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-background shadow border border-border/40">
            <div className="flex gap-0.5">
              <div className="h-2.5 w-px rounded-full bg-muted-foreground/40" />
              <div className="h-2.5 w-px rounded-full bg-muted-foreground/40" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
