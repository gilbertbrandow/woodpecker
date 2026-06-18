import * as React from 'react'
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, ReferenceDot } from 'recharts'
import type { DotProps } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { ChartContainer, ChartTooltip, type ChartConfig } from '../../components/ui/chart'
import { formatTimeRemaining } from './boardPage.helpers'
import type { PaceChartData } from '../../lib/api'

type RunPaceCardProps = {
  chartData: PaceChartData | null
  isRunActive: boolean
  stretch?: boolean
}

const CHART_CONFIG: ChartConfig = {
  actual: { label: 'Puzzles solved', color: 'hsl(var(--chart-1))' },
  projection: { label: 'Projected', color: 'hsl(var(--chart-1))' },
  target: { label: 'Required pace', color: 'hsl(var(--muted-foreground))' },
}

const MS_2D = 2 * 24 * 3_600_000

function formatPaceAxisTick(spanMs: number): (value: number) => string {
  return (value: number): string => {
    const d = new Date(value)
    if (spanMs <= MS_2D) {
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
}

type DotShapeProps = DotProps

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

export function RunPaceCard({ chartData, isRunActive, stretch = false }: RunPaceCardProps): React.ReactElement {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])

  const series = chartData?.series ?? []
  const labelTicks = chartData?.labelTicks ?? []
  const domainStartMs = chartData?.domainStartMs ?? 0
  const spanMs = chartData !== null ? chartData.deadlineMs - chartData.startMs : 0
  const tickFormatter = formatPaceAxisTick(spanMs)
  const totalItems = chartData?.totalItems ?? 0
  const lastActualArr = series.filter((t) => t.actual !== null)
  const lastActual = lastActualArr.length > 0 ? lastActualArr[lastActualArr.length - 1] : null

  return (
    <div className={`flex flex-col gap-2 rounded-lg border bg-card p-4${stretch ? ' flex-1 min-h-0' : ''}`}>
      <div>
        <span className="font-medium">Pace</span>
        <p className="text-xs text-muted-foreground">Actual vs. scheduled</p>
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
              domain={[domainStartMs, labelTicks[labelTicks.length - 1] ?? chartData.deadlineMs]}
              ticks={labelTicks}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={tickFormatter}
            />
            <YAxis hide width={0} domain={[0, totalItems]} />
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={1} />
            <ChartTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const d = new Date(label as number)
                const dateStr = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                const actualVal = payload.find((p) => p.dataKey === 'actual')?.value
                const projectionVal = payload.find((p) => p.dataKey === 'projection')?.value
                const targetVal = payload.find((p) => p.dataKey === 'target')?.value
                const actual = typeof actualVal === 'number' ? Math.round(actualVal) : null
                const projection = typeof projectionVal === 'number' ? Math.round(projectionVal) : null
                const target = typeof targetVal === 'number' ? Math.round(targetVal) : null
                const displaySolved = actual !== null ? actual : projection
                const isFuture = actual === null
                const delta = displaySolved !== null && target !== null ? displaySolved - target : null
                const deltaClass = delta === null ? '' : delta >= 0
                  ? 'border-green-600/30 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'border-red-600/30 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                const deltaLabel = delta === null ? null
                  : `${delta >= 0 ? '+' : '\u2212'}${Math.abs(delta)}`
                return (
                  <div className="rounded border bg-background px-3 py-2 text-xs shadow-md">
                    <p className="mb-1.5 font-medium text-foreground">{dateStr}</p>
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      {isFuture ? 'Projected: ' : 'Solved: '}<span className="tabular-nums text-foreground">{displaySolved !== null ? String(displaySolved) : '\u2014'}</span>
                      {deltaLabel !== null && (
                        <span className={`rounded border px-1 py-0.5 tabular-nums ${deltaClass}`}>{deltaLabel}</span>
                      )}
                    </p>
                    <p className="text-muted-foreground">
                      {'Target: '}<span className="tabular-nums text-foreground">{target !== null ? String(target) : '\u2014'}</span>
                    </p>
                  </div>
                )
              }}
            />
            <Line
              type="linear"
              dataKey="target"
              stroke="var(--color-target)"
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
            {lastActual !== null && (
              <ReferenceDot
                x={lastActual.timeMs}
                y={lastActual.actual as number}
                r={0}
                shape={(props: DotShapeProps) => {
                  const cx = typeof props.cx === 'number' ? props.cx : 0
                  const cy = typeof props.cy === 'number' ? props.cy : 0
                  return <PulsingDot cx={cx} cy={cy} active={isRunActive} />
                }}
              />
            )}
          </ComposedChart>
        </ChartContainer>
      )}

      {chartData !== null && isRunActive && (() => {
        const statusIcon = chartData.status === 'ahead'
          ? <TrendingUp className="h-4 w-4" />
          : chartData.status === 'behind'
            ? <TrendingDown className="h-4 w-4" />
            : <Minus className="h-4 w-4" />
        const statusLabel = chartData.status === 'ahead'
          ? `${chartData.itemDelta} puzzle${chartData.itemDelta === 1 ? '' : 's'} ahead of pace`
          : chartData.status === 'behind'
            ? `${chartData.itemDelta} puzzle${chartData.itemDelta === 1 ? '' : 's'} behind pace`
            : 'On pace'
        const timeLabel = chartData.timeRemainingMs > 0
          ? `Due in ${formatTimeRemaining(chartData.timeRemainingMs)}`
          : 'Overdue'
        return (
          <div className="flex w-full items-start gap-2 border-t pt-3 text-sm">
            <div className="grid gap-1">
              <div className="flex items-center gap-2 font-medium leading-none">
                {statusLabel}{statusIcon}
              </div>
              <div className="flex items-center gap-1 leading-none text-muted-foreground text-xs mt-1">
                {timeLabel}<span className="text-muted-foreground/50">·</span>{chartData.totalItems - (lastActual !== null ? (lastActual.actual as number) : 0)} puzzles left
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
