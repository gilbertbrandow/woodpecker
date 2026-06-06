import * as React from 'react'
import { useState, useEffect, useRef, useMemo } from 'react'
import { ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Drawer, DrawerContent, DrawerTrigger } from '../ui/drawer'
import { StatusBadge } from '../StatusBadge'
import { api, type DashboardTrainingItem, type DashboardRunSlot, type RunStatus } from '../../lib/api'
import { cn } from '../../lib/utils'
import { useIsMobile } from '../../hooks/use-mobile'

function trainingStatusBadge(status: DashboardTrainingItem['status']) {
  if (status === 'in_progress') return 'in_progress' as const
  return status
}

function runStatusBadge(status: RunStatus) {
  if (status === 'active') return 'in_progress' as const
  return status
}

interface Props {
  trainings: DashboardTrainingItem[]
  runSlots: DashboardRunSlot[]
  selectedTrainingId: number | null
  selectedRunIndex: number | null
  onSelect: (trainingId: number, runIndex?: number) => void
}

export function TrainingRunPicker({
  trainings,
  runSlots,
  selectedTrainingId,
  selectedRunIndex,
  onSelect,
}: Props): React.ReactElement {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [stagedId, setStagedId] = useState<number | null>(selectedTrainingId)
  const [stagedSlots, setStagedSlots] = useState<DashboardRunSlot[]>(runSlots)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [mobileStep, setMobileStep] = useState<'training' | 'run'>('training')

  // In-memory cache so hovering a seen training doesn't re-fetch on every open
  const slotsCache = useRef<Map<number, DashboardRunSlot[]>>(new Map())
  // Monotonic counter to discard stale responses from rapid hover
  const fetchSeq = useRef(0)
  // Track previous open state to detect the open transition
  const prevOpen = useRef(open)

  // Reset staged selection only on the open transition (not on every dep change)
  useEffect(() => {
    const wasOpen = prevOpen.current
    prevOpen.current = open
    if (open && !wasOpen) {
      setStagedId(selectedTrainingId)
      setStagedSlots(runSlots)
      setFetchError(false)
      setMobileStep('training')
    }
  }, [open, selectedTrainingId, runSlots])

  // Fetch run slots when a non-selected training is staged
  useEffect(() => {
    if (stagedId === null || stagedId === selectedTrainingId) return

    const cached = slotsCache.current.get(stagedId)
    if (cached) {
      setStagedSlots(cached)
      setFetchError(false)
      return
    }

    const seq = ++fetchSeq.current
    setLoadingSlots(true)
    setFetchError(false)
    const stagedTrainingData = trainings.find((t) => t.id === stagedId)
    const runCount = stagedTrainingData?.runCount ?? 0

    api.runs
      .list(stagedId)
      .then((runs) => {
        if (seq !== fetchSeq.current) return // superseded by a later hover
        const nonAborted = runs.filter((r) => r.status !== 'aborted')
        const byIndex = new Map(nonAborted.map((r) => [r.runIndex, r]))
        const hasNoRuns = nonAborted.length === 0
        const totalSlots = Math.max(runCount, hasNoRuns ? 1 : Math.max(...nonAborted.map(r => r.runIndex)) + 1)
        const slots: DashboardRunSlot[] = Array.from({ length: totalSlots }, (_, i) => {
          const run = byIndex.get(i)
          if (run) return { runIndex: i, selectable: true, runId: run.id, status: run.status as RunStatus }
          const isVirtualRun1 = hasNoRuns && i === 0
          return { runIndex: i, selectable: isVirtualRun1, runId: null, status: null }
        })
        slotsCache.current.set(stagedId, slots)
        setStagedSlots(slots)
      })
      .catch(() => {
        if (seq !== fetchSeq.current) return
        setFetchError(true)
      })
      .finally(() => {
        if (seq === fetchSeq.current) setLoadingSlots(false)
      })
  }, [stagedId, selectedTrainingId])

  // Keep slots in sync with props when the selected training is staged
  useEffect(() => {
    if (stagedId === selectedTrainingId) setStagedSlots(runSlots)
  }, [runSlots, stagedId, selectedTrainingId])

  const selectedTraining = useMemo(
    () => trainings.find((t) => t.id === selectedTrainingId),
    [trainings, selectedTrainingId],
  )
  const stagedTraining = useMemo(
    () => trainings.find((t) => t.id === stagedId),
    [trainings, stagedId],
  )

  const trigger = (
    <button
      type="button"
      className={cn(
        'flex h-8 w-full sm:w-auto sm:max-w-[400px] items-center gap-2 rounded-md border border-input bg-background pl-1 pr-3 text-sm',
        'hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring',
        open && 'ring-1 ring-ring',
      )}
    >
      {selectedTraining && (
        <StatusBadge status={trainingStatusBadge(selectedTraining.status)} className="shrink-0" />
      )}
      <span className="font-medium truncate min-w-0">{selectedTraining?.scheduleName ?? '…'}</span>
      {selectedRunIndex !== null && (
        <span className="flex shrink-0 items-center gap-2">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Run {selectedRunIndex + 1}</span>
        </span>
      )}
      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-0.5" />
    </button>
  )

  const trainingList = (
    <>
      {trainings.map((t) => (
        <button
          key={t.id}
          type="button"
          onMouseEnter={() => !isMobile && setStagedId(t.id)}
          onClick={() => {
            if (isMobile) {
              setStagedId(t.id)
              setMobileStep('run')
            } else {
              onSelect(t.id)
              setOpen(false)
            }
          }}
          className={cn(
            'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm',
            'hover:bg-accent hover:text-accent-foreground',
            !isMobile && stagedId === t.id && 'bg-accent text-accent-foreground',
          )}
        >
          <span className="flex-1 truncate">{t.scheduleName}</span>
          <StatusBadge status={trainingStatusBadge(t.status)} className="shrink-0" />
          {!isMobile && (
            <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-opacity', stagedId === t.id ? 'opacity-40' : 'opacity-0')} />
          )}
        </button>
      ))}
    </>
  )

  const runList = (
    <>
      {loadingSlots ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">Loading…</p>
      ) : fetchError ? (
        <p className="px-4 py-4 text-sm text-destructive">Failed to load runs</p>
      ) : stagedSlots.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">No runs</p>
      ) : (
        stagedSlots.map((slot) => (
          <button
            key={slot.runIndex}
            type="button"
            disabled={!slot.selectable}
            onClick={() => {
              if (!slot.selectable || stagedId === null) return
              onSelect(stagedId, slot.runIndex)
              setOpen(false)
            }}
            className={cn(
              'flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm',
              slot.selectable
                ? 'hover:bg-accent hover:text-accent-foreground cursor-pointer'
                : 'opacity-40 cursor-not-allowed',
              stagedId === selectedTrainingId &&
                slot.runIndex === selectedRunIndex &&
                'bg-accent text-accent-foreground font-medium',
            )}
          >
            <span>Run {slot.runIndex + 1}</span>
            <StatusBadge
              status={slot.status ? runStatusBadge(slot.status) : 'not_started'}
              className="shrink-0"
            />
          </button>
        ))
      )}
    </>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <div className="flex max-h-[70dvh] flex-col overflow-hidden">
            {/* Header */}
            <div className="shrink-0 border-b px-4 py-3">
              {mobileStep === 'training' ? (
                <p className="text-sm text-muted-foreground">Select training</p>
              ) : (
                <button
                  type="button"
                  onClick={() => setMobileStep('training')}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4 shrink-0" />
                  {stagedTraining?.scheduleName ?? 'Select run'}
                </button>
              )}
            </div>
            {/* Scrollable list */}
            <div className="flex flex-col overflow-y-auto pb-8">
              {mobileStep === 'training' ? trainingList : runList}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-auto p-0 overflow-hidden">
        <div className="flex divide-x divide-border">
          {/* Left panel — trainings */}
          <div className="flex flex-col w-80">
            <p className="px-4 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Training
            </p>
            <div className="flex flex-col pb-2 max-h-72 overflow-y-auto">
              {trainingList}
            </div>
          </div>
          {/* Right panel — runs */}
          <div className="flex flex-col w-64">
            <p className="px-4 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
              {stagedTraining
                ? stagedTraining.scheduleName.length > 22
                  ? stagedTraining.scheduleName.slice(0, 22) + '…'
                  : stagedTraining.scheduleName
                : 'Run'}
            </p>
            <div className="flex flex-col pb-2 max-h-72 overflow-y-auto">
              {runList}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
