import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ReferenceDot, Customized } from 'recharts'
import type { DotProps } from 'recharts'
import type { ColumnDef, StockFeatures } from '@tanstack/react-table'
import { CheckSquare, Square, Plus, X, Trash2 } from 'lucide-react'
import { ChartContainer, ChartTooltip, type ChartConfig } from '../../components/ui/chart'
import { DeltaBadge } from './DeltaBadge'
import { formatSolveTimeMs } from '../../lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'
import { DefaultAvatar } from '../../components/DefaultAvatar'
import { parseAvatarValue, AVATAR_COLOR_VALUES, resolveAvatarDefaults } from '../../lib/avatar'
import { UserAvatar } from '../../components/UserAvatar'
import { ServerDataTable, type FetchParams } from '../../components/ServerDataTable'
import { col } from '../../components/DataTable'
import { getStored, setStored } from '../../lib/storage'
import { api } from '../../lib/api'
import { DATA_ICONS, CONCEPT_ICONS } from '../../lib/icons'
import { useUserFilterSpec } from '../../hooks/useUserFilterSpec'
import { useScheduleFilterSpec } from '../../hooks/useScheduleFilterSpec'
import type { AccuracyChartData, RunAccuracySeries, SubsetRunRow, RunTrainingItemOverview, UserRef } from '../../lib/api'
import { cn } from '../../lib/utils'

type AccuracyChartCardProps = {
  runId: number
  subsetId: number | null
  scheduleId: number | null
  scheduleName: string | null
  accuracyChart: AccuracyChartData
  accuracy: RunTrainingItemOverview['stats']['accuracy']
  averageSolveTime: RunTrainingItemOverview['stats']['averageSolveTime']
  currentUser: Pick<UserRef, 'avatarUrl' | 'displayName'>
}

const MAX_COMPETITORS = 5
const AV_SIZE = 22

const CUSTOM_AVATAR_FALLBACKS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899']

function resolveCompetitorColor(avatarUrl: string | null, displayName: string, runId: number): string {
  const av = parseAvatarValue(avatarUrl)
  if (av.type === 'default') return AVATAR_COLOR_VALUES[av.color]
  if (av.type === 'auto') return AVATAR_COLOR_VALUES[resolveAvatarDefaults(displayName).color]
  return CUSTOM_AVATAR_FALLBACKS[runId % CUSTOM_AVATAR_FALLBACKS.length]
}

function trunc(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s
}

function makeOverlayLabel(series: RunAccuracySeries, currentScheduleId: number | null): string {
  const name = trunc(series.user.displayName, 10)
  const run = `(${series.runIndex + 1})`
  if (series.scheduleId !== currentScheduleId) {
    return `${name}, ${trunc(series.scheduleName, 8)} ${run}`
  }
  return `${name} ${run}`
}

type TargetStatus =
  | { kind: 'exceeding'; deltaPct: number }
  | { kind: 'meeting' }
  | { kind: 'failing'; streak: number }
  | { kind: 'unreachable'; bestPct: number }

function computeTargetStatus(
  valuePct: number,
  solvedCount: number,
  resolvedCount: number,
  totalItems: number,
  targetAccuracy: number,
): TargetStatus {
  const diff = valuePct - targetAccuracy
  if (Math.abs(diff) < 0.01) return { kind: 'meeting' }
  if (diff > 0) return { kind: 'exceeding', deltaPct: diff }
  const t = targetAccuracy / 100
  const remaining = totalItems - resolvedCount
  const bestPct = totalItems > 0 ? ((solvedCount + remaining) / totalItems) * 100 : 0
  if (t >= 1) return { kind: 'unreachable', bestPct }
  const rawN = (t * resolvedCount - solvedCount) / (1 - t)
  const streak = Math.ceil(rawN)
  if (streak > remaining) return { kind: 'unreachable', bestPct }
  return { kind: 'failing', streak }
}

function TargetFooter({ status }: { status: TargetStatus }): React.ReactElement {
  let heading: string
  let subtext: string
  if (status.kind === 'exceeding') {
    heading = 'Exceeding target'
    subtext = `+${status.deltaPct.toFixed(1)}% above target`
  } else if (status.kind === 'meeting') {
    heading = 'Meeting target'
    subtext = 'Right at target'
  } else if (status.kind === 'failing') {
    heading = 'Below target'
    subtext = `Solve ${status.streak} in a row to meet target`
  } else {
    heading = 'Target not reachable'
    subtext = `Best possible finish: ${status.bestPct.toFixed(1)}%`
  }
  return (
    <div className="flex w-full items-start gap-2 border-t pt-3 text-sm">
      <div className="grid gap-1">
        <div className="font-medium leading-none">{heading}</div>
        <div className="text-xs text-muted-foreground mt-1">{subtext}</div>
      </div>
    </div>
  )
}

const CHART_CONFIG: ChartConfig = {
  self: { color: 'hsl(var(--chart-1))' },
}

type ChartPoint = { x: number; self: number | null } & { [key: string]: number | null | number }

function PulsingDot({ cx = 0, cy = 0 }: { cx?: number; cy?: number }): React.ReactElement {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <circle r={4} fill="none" stroke="var(--color-self)" strokeOpacity={0.3}>
        <animate attributeName="r" from="4" to="14" dur="2s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" from="0.3" to="0" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle r={4} fill="hsl(var(--foreground))" stroke="var(--color-self)" strokeWidth={2} />
    </g>
  )
}

function AvatarDot({
  cx, cy, avatarUrl, displayName, borderColor,
}: {
  cx: number
  cy: number
  avatarUrl: string | null
  displayName: string
  borderColor: string
}): React.ReactElement {
  const r = AV_SIZE / 2
  const av = parseAvatarValue(avatarUrl)
  return (
    <foreignObject x={cx - r} y={cy - r} width={AV_SIZE} height={AV_SIZE}>
      {av.type === 'custom' ? (
        <img
          src={av.url}
          width={AV_SIZE}
          height={AV_SIZE}
          style={{ borderRadius: '50%', border: `1.5px solid ${borderColor}`, objectFit: 'cover', display: 'block', boxSizing: 'border-box' }}
        />
      ) : (
        <div style={{ width: AV_SIZE, height: AV_SIZE, borderRadius: '50%', overflow: 'hidden', boxSizing: 'border-box' }}>
          <DefaultAvatar
            username={displayName}
            piece={av.type === 'default' ? av.piece : undefined}
            color={av.type === 'default' ? av.color : undefined}
            style={av.type === 'default' ? av.style : undefined}
            className="h-full w-full"
          />
        </div>
      )}
    </foreignObject>
  )
}

function MiniAvatar({ user, borderColor }: { user: Pick<UserRef, 'avatarUrl' | 'displayName'>; borderColor: string }): React.ReactElement {
  const size = 16
  const av = parseAvatarValue(user.avatarUrl)
  if (av.type === 'custom') {
    return (
      <img
        src={av.url}
        width={size}
        height={size}
        style={{ borderRadius: '50%', border: `1.5px solid ${borderColor}`, objectFit: 'cover', flexShrink: 0, display: 'block', boxSizing: 'border-box' }}
      />
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, boxSizing: 'border-box' }}>
      <DefaultAvatar
        username={user.displayName}
        piece={av.type === 'default' ? av.piece : undefined}
        color={av.type === 'default' ? av.color : undefined}
        style={av.type === 'default' ? av.style : undefined}
        className="h-full w-full"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Series localStorage cache
// ---------------------------------------------------------------------------

const SERIES_CACHE_PREFIX = 'run-series:'

function readCachedSeries(runId: number): RunAccuracySeries | null {
  return getStored<RunAccuracySeries>(`${SERIES_CACHE_PREFIX}${runId}`)
}

function writeCachedSeries(series: RunAccuracySeries): void {
  if (series.isCompleted) {
    setStored(`${SERIES_CACHE_PREFIX}${series.runId}`, series)
  }
}

// ---------------------------------------------------------------------------
// Picker table
// ---------------------------------------------------------------------------

const PICKER_SEARCH_FILTER = { type: 'search' as const, key: 'q' }

type SubsetRunPickerTableProps = {
  subsetId: number
  selectedRunIds: number[]
  currentRunId: number
  onToggleRun: (runId: number) => void
}

function SubsetRunPickerTable({ subsetId, selectedRunIds, currentRunId, onToggleRun }: SubsetRunPickerTableProps): React.ReactElement {
  const userFilterSpec = useUserFilterSpec('userId')
  const scheduleFilterSpec = useScheduleFilterSpec('scheduleId')

  const filters = React.useMemo(() => [PICKER_SEARCH_FILTER, userFilterSpec, scheduleFilterSpec], [userFilterSpec, scheduleFilterSpec])

  const columns = React.useMemo<ColumnDef<StockFeatures, SubsetRunRow>[]>(() => [
    col({
      id: 'select',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const isCurrent = row.original.runId === currentRunId
        const isSelected = selectedRunIds.includes(row.original.runId)
        if (isCurrent) return <span className="text-[10px] text-muted-foreground/50 font-medium">you</span>
        return isSelected
          ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
          : <Square className="h-3.5 w-3.5 text-muted-foreground/40" />
      },
      meta: { className: 'px-2 py-1 w-8', icon: CheckSquare, iconOnly: true },
    }),
    col({
      id: 'user',
      header: 'User',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <UserAvatar user={row.original.user} className="h-4 w-4 shrink-0" />
          <span className="truncate max-w-[6rem]">{row.original.user.displayName}</span>
        </div>
      ),
      meta: { className: 'px-2 py-1', icon: DATA_ICONS.user },
    }),
    col({
      id: 'run',
      header: 'Run',
      enableSorting: false,
      cell: ({ row }) => `Run ${row.original.runIndex + 1}`,
      meta: { className: 'px-2 py-1', icon: CONCEPT_ICONS.Run },
    }),
    col({
      id: 'schedule',
      header: 'Schedule',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="block max-w-[7rem] truncate" title={row.original.scheduleName}>
          {row.original.scheduleName}
        </span>
      ),
      meta: { className: 'px-2 py-1', icon: CONCEPT_ICONS.Schedule },
    }),
    col({
      id: 'accuracy',
      header: 'Accuracy',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.accuracyPct !== null ? `${row.original.accuracyPct.toFixed(1)}%` : '—',
      meta: { className: 'px-2 py-1 tabular-nums', icon: DATA_ICONS.accuracy },
    }),
    col({
      id: 'progress',
      header: 'Progress',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.totalItems > 0
          ? `${row.original.resolvedCount} / ${row.original.totalItems}`
          : '—',
      meta: { className: 'px-2 py-1 tabular-nums', icon: DATA_ICONS.progress },
    }),
    col({
      accessorKey: 'startedAt',
      header: 'Date',
      enableSorting: true,
      cell: ({ row }) => row.original.startedAt.slice(0, 10),
      meta: { className: 'px-2 py-1', icon: DATA_ICONS.started },
    }),
  ], [selectedRunIds, currentRunId])

  const fetchData = React.useCallback(
    async (params: FetchParams): Promise<{ items: SubsetRunRow[]; total: number }> =>
      api.subsets.listRuns(subsetId, params),
    [subsetId],
  )

  const getRowClassName = React.useCallback((row: SubsetRunRow) => {
    if (row.runId === currentRunId) return 'opacity-40 cursor-default'
    if (selectedRunIds.includes(row.runId)) return 'bg-primary/5 dark:bg-primary/5'
    if (selectedRunIds.length >= MAX_COMPETITORS) return 'opacity-40 cursor-not-allowed'
    return ''
  }, [selectedRunIds, currentRunId])

  const handleRowClick = React.useCallback((row: SubsetRunRow) => {
    if (row.runId === currentRunId) return
    if (!selectedRunIds.includes(row.runId) && selectedRunIds.length >= MAX_COMPETITORS) return
    onToggleRun(row.runId)
  }, [selectedRunIds, onToggleRun, currentRunId])

  return (
    <ServerDataTable
      tableId={false}
      columns={columns}
      filters={filters}
      pageSize={10}
      fetchData={fetchData}
      instanceKey={subsetId}
      initialSorting={[{ id: 'startedAt', desc: true }]}
      onRowClick={handleRowClick}
      getRowClassName={getRowClassName}
      emptyMessage="No runs found for this subset."
      compact
    />
  )
}

// ---------------------------------------------------------------------------
// Picker dialog
// ---------------------------------------------------------------------------

type ComparisonPickerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  subsetId: number
  selectedRunIds: number[]
  currentRunId: number
  onToggleRun: (runId: number) => void
  onClearAll: () => void
}

function ComparisonPickerDialog({
  open, onOpenChange, subsetId, selectedRunIds, currentRunId, onToggleRun, onClearAll,
}: ComparisonPickerDialogProps): React.ReactElement {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-[calc(100vw-2rem)] max-w-3xl translate-x-[-50%] translate-y-[-50%] rounded-lg border bg-background shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <DialogPrimitive.Title className="text-sm font-semibold">Compare accuracy</DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-xs text-muted-foreground mt-0.5">
                Click a run to overlay it on the chart. Up to {MAX_COMPETITORS} at a time.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ml-4">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
          {selectedRunIds.length > 0 && (
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="text-xs text-muted-foreground tabular-nums">{selectedRunIds.length} selected</span>
              <button
                type="button"
                onClick={onClearAll}
                className="flex h-6 items-center gap-1.5 rounded-md bg-destructive px-2 text-xs text-destructive-foreground transition-colors hover:bg-destructive/90"
              >
                <Trash2 className="h-3 w-3" />
                Clear all
              </button>
            </div>
          )}
          <div className="px-4 py-3">
            <SubsetRunPickerTable
              subsetId={subsetId}
              selectedRunIds={selectedRunIds}
              currentRunId={currentRunId}
              onToggleRun={onToggleRun}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

export function AccuracyChartCard({
  runId,
  subsetId,
  scheduleId,
  scheduleName: _scheduleName,
  accuracyChart,
  accuracy,
  averageSolveTime,
  currentUser,
}: AccuracyChartCardProps): React.ReactElement {
  const [mounted, setMounted] = React.useState(false)
  const [pickerOpen, setPickerOpen] = React.useState(false)

  const storageKey = `accuracy-overlays:${runId}`

  const [selectedRunIds, setSelectedRunIds] = React.useState<number[]>(() =>
    getStored<number[]>(storageKey) ?? []
  )

  const [overlayCache, setOverlayCache] = React.useState<Map<number, RunAccuracySeries>>(() => {
    const cache = new Map<number, RunAccuracySeries>()
    const saved = getStored<number[]>(`accuracy-overlays:${runId}`) ?? []
    for (const id of saved) {
      const cached = readCachedSeries(id)
      if (cached !== null) cache.set(id, cached)
    }
    return cache
  })

  React.useEffect(() => { setMounted(true) }, [])

  React.useEffect(() => {
    setStored(storageKey, selectedRunIds)
  }, [storageKey, selectedRunIds])

  React.useEffect(() => {
    const toFetch = selectedRunIds.filter(id => !overlayCache.has(id))
    if (toFetch.length === 0) return
    api.runs.getAccuracySeriesBatch(toFetch)
      .then(results => {
        setOverlayCache(prev => {
          const next = new Map(prev)
          for (const series of results) {
            next.set(series.runId, series)
            writeCachedSeries(series)
          }
          return next
        })
      })
      .catch(() => {})
  // overlayCache intentionally omitted — cache only grows, no need to re-run when it changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRunIds])

  const handleToggleRun = React.useCallback((toggledRunId: number) => {
    setSelectedRunIds(prev => {
      if (prev.includes(toggledRunId)) return prev.filter(id => id !== toggledRunId)
      if (prev.length >= MAX_COMPETITORS) return prev
      return [...prev, toggledRunId]
    })
  }, [])

  const handleClearAll = React.useCallback(() => setSelectedRunIds([]), [])

  const { points, totalItems, targetAccuracy } = accuracyChart

  const competitors = React.useMemo(
    () => selectedRunIds.map(id => overlayCache.get(id)).filter((s): s is RunAccuracySeries => s !== undefined),
    [selectedRunIds, overlayCache],
  )

  const sharedData = React.useMemo((): ChartPoint[] => {
    return Array.from({ length: totalItems }, (_, i) => {
      const point: ChartPoint = { x: i + 1, self: points[i] ?? null }
      for (let ci = 0; ci < MAX_COMPETITORS; ci++) {
        point[`c${ci}`] = competitors[ci]?.points[i] ?? null
      }
      return point
    })
  }, [points, competitors, totalItems])

  const yDomain = React.useMemo((): [number, number] => {
    const allValues = [
      ...points,
      ...competitors.flatMap((c) => c.points),
      ...(targetAccuracy !== null ? [targetAccuracy] : []),
    ]
    if (allValues.length === 0) return [0, 100]
    const min = Math.floor(Math.min(...allValues) / 5) * 5 - 5
    const max = Math.ceil(Math.max(...allValues) / 5) * 5 + 5
    return [Math.max(0, min), Math.min(100, max)]
  }, [points, competitors, targetAccuracy])

  const xTicks = React.useMemo((): number[] => {
    if (totalItems <= 0) return []
    const rough = totalItems / 5
    const mag = Math.pow(10, Math.floor(Math.log10(rough)))
    const frac = rough / mag
    const step = frac <= 1 ? mag : frac <= 2 ? 2 * mag : frac <= 5 ? 5 * mag : 10 * mag
    const ticks: number[] = []
    for (let t = step; t < totalItems; t += step) ticks.push(t)
    ticks.push(totalItems)
    return ticks
  }, [totalItems])

  const competitorColors = React.useMemo(
    () => competitors.map((c) => resolveCompetitorColor(c.user.avatarUrl, c.user.displayName, c.runId)),
    [competitors],
  )

  const avatarLayer = React.useCallback((rechartsProps: Record<string, unknown>) => {
    const xAxisMap = rechartsProps.xAxisMap as Record<string, { scale: (v: number) => number }> | undefined
    const yAxisMap = rechartsProps.yAxisMap as Record<string, { scale: (v: number) => number; range: () => number[] }> | undefined
    if (!xAxisMap || !yAxisMap) return null
    const xScale = Object.values(xAxisMap)[0]?.scale
    const yScale = Object.values(yAxisMap)[0]?.scale
    const yRange = Object.values(yAxisMap)[0]?.range()
    if (!xScale || !yScale || !yRange) return null
    const [yRangeMin, yRangeMax] = [Math.min(...yRange), Math.max(...yRange)]

    const positions = competitors
      .map((c, i) => (c.points.length > 0 ? {
        user: c.user,
        borderColor: competitorColors[i],
        cx: xScale(c.points.length),
        cy: yScale(c.points[c.points.length - 1]),
      } : null))
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => a.cy - b.cy)

    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1]
      const curr = positions[i]
      if (curr.cy - prev.cy < AV_SIZE + 2) curr.cy = prev.cy + AV_SIZE + 2
    }
    for (const p of positions) {
      p.cy = Math.max(yRangeMin + AV_SIZE / 2, Math.min(yRangeMax - AV_SIZE / 2, p.cy))
    }

    return (
      <>
        {positions.map((p) => (
          <AvatarDot
            key={p.user.id}
            cx={p.cx}
            cy={p.cy}
            avatarUrl={p.user.avatarUrl}
            displayName={p.user.displayName}
            borderColor={p.borderColor}
          />
        ))}
      </>
    )
  }, [competitors, competitorColors])

  const canCompare = subsetId !== null

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 flex-1 min-h-0">
      <div className="flex items-start justify-between">
        <div>
          <span className="font-medium">Accuracy</span>
          <p className="text-xs text-muted-foreground">Cumulative run accuracy</p>
        </div>
        {canCompare && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className={cn(
              'flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-accent',
              selectedRunIds.length > 0 ? 'border-primary/40 text-primary' : 'text-muted-foreground',
            )}
            title="Compare with other runs"
          >
            <Plus className="h-3 w-3" />
            {selectedRunIds.length > 0 ? (
              <span className="tabular-nums">{selectedRunIds.length} selected</span>
            ) : (
              <span>Compare</span>
            )}
          </button>
        )}
      </div>

      {!mounted ? (
        <div className="flex-1 min-h-[200px] w-full animate-pulse rounded-md bg-muted" />
      ) : (
        <div className="relative flex-1 min-h-[200px] w-full">
          <ChartContainer config={CHART_CONFIG} className="absolute inset-0 min-w-0">
          <ComposedChart data={sharedData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="x"
              type="number"
              scale="linear"
              domain={[1, totalItems]}
              ticks={xTicks}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => String(Math.round(v))}
            />
            <YAxis
              domain={yDomain}
              width={28}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => `${v}`}
            />
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={1} />
            <ChartTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const x = label as number
                const visible = payload
                  .filter((p) => p.value !== null && p.value !== undefined)
                  .sort((a, b) => (b.value as number) - (a.value as number))
                return (
                  <div className="rounded border bg-background px-3 py-2 text-xs shadow-md">
                    <p className="mb-1.5 font-medium text-foreground">Puzzle {Math.round(x)}</p>
                    {visible.map((p) => {
                      const key = p.dataKey as string
                      const ci = key.startsWith('c') ? parseInt(key.slice(1)) : -1
                      const competitor = ci >= 0 ? competitors[ci] : null
                      const borderColor = ci >= 0 ? competitorColors[ci] : undefined
                      const label = competitor
                        ? makeOverlayLabel(competitor, scheduleId)
                        : 'You'
                      return (
                        <div key={key} className="flex items-center gap-1.5 py-0.5 text-muted-foreground">
                          {competitor && borderColor ? (
                            <MiniAvatar user={competitor.user} borderColor={borderColor} />
                          ) : (
                            <MiniAvatar user={currentUser} borderColor="var(--color-self)" />
                          )}
                          <span>
                            {label}:{' '}
                            <span className="tabular-nums text-foreground">
                              {(p.value as number).toFixed(1)}%
                            </span>
                          </span>
                        </div>
                      )
                    })}
                    {targetAccuracy !== null && (
                      <p className="mt-1 text-muted-foreground">
                        Target: <span className="tabular-nums text-foreground">{targetAccuracy}%</span>
                      </p>
                    )}
                  </div>
                )
              }}
            />

            {targetAccuracy !== null && (
              <ReferenceLine
                y={targetAccuracy}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1}
                strokeDasharray="4 4"
                strokeOpacity={0.7}
              />
            )}

            {competitors.map((c, i) => (
              <Line
                key={c.runId}
                dataKey={`c${i}`}
                name={makeOverlayLabel(c, scheduleId)}
                type="monotone"
                stroke={competitorColors[i]}
                strokeWidth={1.5}
                strokeOpacity={0.5}
                dot={false}
                activeDot={{ r: 3, fill: competitorColors[i] }}
                isAnimationActive={false}
                connectNulls={false}
              />
            ))}

            <Line
              dataKey="self"
              name="You"
              type="monotone"
              stroke="var(--color-self)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
              connectNulls={false}
            />

            {points.length > 0 && (
              <ReferenceDot
                x={points.length}
                y={points[points.length - 1] ?? 0}
                r={0}
                shape={(props: DotProps) => (
                  <PulsingDot
                    cx={typeof props.cx === 'number' ? props.cx : 0}
                    cy={typeof props.cy === 'number' ? props.cy : 0}
                  />
                )}
              />
            )}

            <Customized component={avatarLayer} />
          </ComposedChart>
          </ChartContainer>
        </div>
      )}

      {targetAccuracy !== null && accuracy.resolvedCount > 0 && accuracy.valuePct !== null && (
        <TargetFooter
          status={computeTargetStatus(
            accuracy.valuePct,
            accuracy.solvedCount,
            accuracy.resolvedCount,
            totalItems,
            targetAccuracy,
          )}
        />
      )}

      <div className="flex flex-row justify-between border-t pt-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex cursor-default flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Accuracy (%)</span>
              <div className="flex items-baseline gap-2">
                <span className="tabular-nums text-2xl font-semibold">
                  {accuracy.valuePct !== null ? `${accuracy.valuePct.toFixed(2)}` : '—'}
                </span>
                <DeltaBadge delta={accuracy.deltaPct} goodWhenPositive={true} format={(n) => `${n.toFixed(2)}`} />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {accuracy.resolvedCount > 0
              ? `${accuracy.solvedCount} of ${accuracy.resolvedCount} resolved`
              : null}
          </TooltipContent>
        </Tooltip>
        <div className="flex cursor-default flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Solve time (mm:ss)</span>
          <div className="flex items-baseline gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="tabular-nums text-2xl font-semibold">
                  {averageSolveTime.valueMs !== null ? formatSolveTimeMs(averageSolveTime.valueMs) : '—'}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {averageSolveTime.timeCount > 0
                  ? `across ${averageSolveTime.timeCount} solved puzzle${averageSolveTime.timeCount !== 1 ? 's' : ''}`
                  : null}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <DeltaBadge delta={averageSolveTime.deltaMs} goodWhenPositive={false} format={formatSolveTimeMs} />
                </span>
              </TooltipTrigger>
              <TooltipContent>Solve time compared to your average for this run</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {canCompare && (
        <ComparisonPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          subsetId={subsetId}
          selectedRunIds={selectedRunIds}
          currentRunId={runId}
          onToggleRun={handleToggleRun}
          onClearAll={handleClearAll}
        />
      )}
    </div>
  )
}
