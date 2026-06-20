import * as React from 'react'
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, ReferenceDot } from 'recharts'
import type { DotProps } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { ChartContainer, ChartTooltip, type ChartConfig } from '../../components/ui/chart'
import type { PaceChartData, PaceChartTickKind } from '../../lib/api'

type RunPaceCardProps = {
  chartData: PaceChartData | null
  stretch?: boolean
}

const CHART_CONFIG: ChartConfig = {
  actual: { color: 'hsl(var(--chart-1))' },
  projection: { color: 'hsl(var(--chart-1))' },
  required: { color: 'hsl(var(--muted-foreground))' },
}

const KIND_LABELS: Partial<Record<PaceChartTickKind, string>> = {
  start: 'Start',
  deadline: 'Deadline',
  projected_finish: 'Projected finish',
  completed: 'Completed',
  aborted: 'Aborted',
  as_of: 'Current',
}

function formatAbsoluteTime(ms: number): string {
  const d = new Date(ms)
  const day = d.toLocaleDateString('en-GB', { weekday: 'short' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${day} ${time}`
}

function formatDurationCompact(absMs: number): string {
  const totalHours = Math.floor(absMs / 3_600_000)
  const months = Math.floor(totalHours / 720)
  if (months >= 1) return `${months}mo`
  const weeks = Math.floor(totalHours / 168)
  if (weeks >= 1) return `${weeks}w`
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  if (days >= 1) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  const mins = Math.floor((absMs % 3_600_000) / 60_000)
  if (totalHours >= 1) return mins > 0 ? `${totalHours}h ${mins}m` : `${totalHours}h`
  return `${mins}m`
}

function PulsingDot({ cx = 0, cy = 0, active }: { cx?: number; cy?: number; active: boolean }): React.ReactElement {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {active && (
        <circle r={4} fill="none" stroke="var(--color-actual)" strokeOpacity={0.3}>
          <animate attributeName="r" from="4" to="14" dur="2s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" from="0.3" to="0" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
      <circle r={4} fill="hsl(var(--foreground))" stroke="var(--color-actual)" strokeWidth={2} />
    </g>
  )
}

function FooterContent({ data }: { data: PaceChartData }): React.ReactElement | null {
  const { summary, totalItems } = data
  const { state } = summary

  if (state === 'completed') {
    const delta = summary.completedDeltaMs ?? 0
    const absDuration = formatDurationCompact(Math.abs(delta))
    const timing = delta >= 0
      ? `Finished ${absDuration} before deadline`
      : `Finished ${absDuration} late`
    return (
      <div className="flex w-full items-start gap-2 border-t pt-3 text-sm">
        <div className="grid gap-1">
          <div className="font-medium leading-none">Completed</div>
          <div className="text-xs text-muted-foreground mt-1">
            {timing} · {summary.resolvedItems}/{totalItems} resolved
          </div>
        </div>
      </div>
    )
  }

  if (state === 'aborted') {
    const delta = summary.abortedDeltaMs ?? 0
    const absDuration = formatDurationCompact(Math.abs(delta))
    const timing = delta >= 0
      ? `stopped ${absDuration} before deadline`
      : `stopped ${absDuration} after deadline`
    return (
      <div className="flex w-full items-start gap-2 border-t pt-3 text-sm">
        <div className="grid gap-1">
          <div className="font-medium leading-none">Aborted</div>
          <div className="text-xs text-muted-foreground mt-1">
            {summary.resolvedItems}/{totalItems} resolved · {timing}
          </div>
        </div>
      </div>
    )
  }

  const delta = Math.round(Math.abs(summary.deltaItemsVsRequired))
  const projLabel = summary.projectedFinishMs !== null
    ? `projected finish ${formatAbsoluteTime(summary.projectedFinishMs)}`
    : null
  const dueLabel = summary.deadlineDeltaMs > 0
    ? `due in ${formatDurationCompact(summary.deadlineDeltaMs)}`
    : null

  const headingMap: Record<string, React.ReactNode> = {
    active_ahead: (
      <div className="flex items-center gap-2 font-medium leading-none">
        {delta} puzzle{delta === 1 ? '' : 's'} ahead of pace<TrendingUp className="h-4 w-4" />
      </div>
    ),
    active_on_pace: (
      <div className="flex items-center gap-2 font-medium leading-none">
        On pace<Minus className="h-4 w-4" />
      </div>
    ),
    active_behind: (
      <div className="flex items-center gap-2 font-medium leading-none">
        {delta} puzzle{delta === 1 ? '' : 's'} behind pace<TrendingDown className="h-4 w-4" />
      </div>
    ),
    active_overdue: (
      <div className="flex items-center gap-2 font-medium leading-none">
        Overdue<TrendingDown className="h-4 w-4" />
      </div>
    ),
  }

  const secondLine = state === 'active_on_pace'
    ? `${summary.remainingItems} left · ${dueLabel ?? 'Overdue'}`
    : `${summary.remainingItems} left · ${projLabel ?? '—'}`

  return (
    <div className="flex w-full items-start gap-2 border-t pt-3 text-sm">
      <div className="grid gap-1">
        {headingMap[state]}
        <div className="text-xs text-muted-foreground mt-1">{secondLine}</div>
      </div>
    </div>
  )
}

export function RunPaceCard({ chartData, stretch = false }: RunPaceCardProps): React.ReactElement {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])

  const series = chartData?.series ?? []
  const isActive = chartData?.runStatus === 'active'

  const tickTimeToLabel = React.useMemo(() => {
    const map = new Map<number, string>()
    if (chartData) {
      for (const t of chartData.labelTicks) map.set(t.timeMs, t.shortLabel)
    }
    return map
  }, [chartData])

  return (
    <div className={`flex flex-col gap-2 rounded-lg border bg-card p-4${stretch ? ' flex-1 min-h-0' : ''}`}>
      <div>
        <span className="font-medium">Run pace</span>
        <p className="text-xs text-muted-foreground">Actual vs required pace</p>
      </div>

      {!mounted || chartData === null ? (
        <div className={`${stretch ? 'flex-1 min-h-0' : 'h-48'} w-full animate-pulse rounded-md bg-muted`} />
      ) : (
        <ChartContainer config={CHART_CONFIG} className={`${stretch ? 'flex-1 min-h-0' : 'h-48'} min-w-0 w-full`}>
          <ComposedChart data={series} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="paceActualGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-actual)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-actual)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="timeMs"
              type="number"
              scale="linear"
              domain={[chartData.domainStartMs, chartData.domainEndMs]}
              ticks={chartData.labelTicks.map((t) => t.timeMs)}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={(value: number) => tickTimeToLabel.get(value) ?? ''}
            />
            <YAxis hide width={0} domain={[0, chartData.totalItems]} />
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={1} />
            <ChartTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const timeMs = label as number
                const point = series.find((p) => p.timeMs === timeMs)
                const kind = point?.kind as PaceChartTickKind | undefined
                const kindLabel = kind ? KIND_LABELS[kind] : undefined
                const d = new Date(timeMs)
                const dateStr = d.toLocaleString('en-GB', {
                  weekday: 'short', day: 'numeric', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                })
                const title = kindLabel ? `${kindLabel} · ${dateStr}` : dateStr

                const actualRaw = payload.find((p) => p.dataKey === 'actual')?.value
                const requiredRaw = payload.find((p) => p.dataKey === 'required')?.value
                const projRaw = payload.find((p) => p.dataKey === 'projection')?.value
                const actual = typeof actualRaw === 'number' ? Math.round(actualRaw) : null
                const required = typeof requiredRaw === 'number' ? Math.round(requiredRaw) : null
                const projection = typeof projRaw === 'number' ? Math.round(projRaw) : null

                return (
                  <div className="rounded border bg-background px-3 py-2 text-xs shadow-md">
                    <p className="mb-1.5 font-medium text-foreground">{title}</p>
                    <p className="text-muted-foreground">
                      Actual: <span className="tabular-nums text-foreground">{actual !== null ? actual : '—'}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Required: <span className="tabular-nums text-foreground">{required !== null ? required : '—'}</span>
                    </p>
                    {isActive && timeMs > chartData.asOfMs && (
                      <p className="text-muted-foreground">
                        Projected: <span className="tabular-nums text-foreground">{projection !== null ? projection : '—'}</span>
                      </p>
                    )}
                  </div>
                )
              }}
            />
            <Line
              type="linear"
              dataKey="required"
              stroke="var(--color-required)"
              strokeWidth={1}
              strokeOpacity={0.5}
              dot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="var(--color-actual)"
              fill="url(#paceActualGradient)"
              fillOpacity={1}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            {isActive && (
              <Line
                type="linear"
                dataKey="projection"
                stroke="var(--color-actual)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            <ReferenceDot
              x={chartData.asOfMs}
              y={chartData.resolvedItems}
              r={0}
              shape={(props: DotProps) => {
                const cx = typeof props.cx === 'number' ? props.cx : 0
                const cy = typeof props.cy === 'number' ? props.cy : 0
                return <PulsingDot cx={cx} cy={cy} active={isActive} />
              }}
            />
          </ComposedChart>
        </ChartContainer>
      )}

      {chartData !== null && <FooterContent data={chartData} />}
    </div>
  )
}
