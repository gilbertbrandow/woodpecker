import * as React from 'react'
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, ReferenceDot } from 'recharts'
import type { DotProps } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { ChartContainer, ChartTooltip, type ChartConfig } from '../../components/ui/chart'
import { buildChartSeries, formatTimeRemaining } from './boardPage.helpers'
import type { RunPaceResult } from './boardPage.helpers'
import type { PaceChartData } from '../../lib/api'

type RunPaceCardProps = {
  pace: RunPaceResult
  chartData: PaceChartData | null
  isRunActive: boolean
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

export function RunPaceCard({ pace, chartData, isRunActive }: RunPaceCardProps): React.ReactElement {
  const nowMs = Date.now()
  const { series, labelTicks, domainStartMs } = chartData !== null ? buildChartSeries(chartData, nowMs) : { series: [], labelTicks: [], domainStartMs: 0 }
  const spanMs = chartData !== null ? Math.max(nowMs, chartData.deadlineMs) - chartData.startMs : 0
  const tickFormatter = formatPaceAxisTick(spanMs)
  const totalPuzzles = chartData?.totalPuzzles ?? 0
  const lastActualArr = series.filter((t) => t.actual !== null)
  const lastActual = lastActualArr.length > 0 ? lastActualArr[lastActualArr.length - 1] : null

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <div>
        <span className="font-medium">Run pace</span>
        <p className="text-xs text-muted-foreground">Actual progress & required pace</p>
      </div>

      {chartData === null ? (
        <div className="h-48 w-full animate-pulse rounded-md bg-muted" />
      ) : (
        <ChartContainer config={CHART_CONFIG} className="h-48 w-full">
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
              domain={[domainStartMs, labelTicks[labelTicks.length - 1] ?? Math.max(nowMs, chartData.deadlineMs)]}
              ticks={labelTicks}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={tickFormatter}
            />
            <YAxis hide domain={[0, totalPuzzles]} />
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
        const statusIcon = pace.status === 'ahead'
          ? <TrendingUp className="h-4 w-4" />
          : pace.status === 'behind'
            ? <TrendingDown className="h-4 w-4" />
            : <Minus className="h-4 w-4" />
        const statusLabel = pace.status === 'ahead'
          ? `${pace.puzzleDelta} puzzle${pace.puzzleDelta === 1 ? '' : 's'} ahead of pace`
          : pace.status === 'behind'
            ? `${pace.puzzleDelta} puzzle${pace.puzzleDelta === 1 ? '' : 's'} behind pace`
            : 'On pace'
        const timeLabel = pace.timeRemainingHours > 0
          ? `Due in ${formatTimeRemaining(pace.timeRemainingHours)}`
          : 'Overdue'
        return (
          <div className="flex w-full items-start gap-2 border-t pt-3 text-sm">
            <div className="grid gap-1">
              <div className="flex items-center gap-2 font-medium leading-none">
                {statusLabel}{statusIcon}
              </div>
              <div className="flex items-center gap-1 leading-none text-muted-foreground text-xs mt-1">
                {timeLabel}<span className="text-muted-foreground/50">·</span>{chartData.totalPuzzles} puzzles total
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
