import * as React from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { type TrainingProgressData, type TrainingProgressPoint } from '../lib/api'
import { ChartContainer, ChartTooltip, type ChartConfig } from './ui/chart'

const PROGRESS_CONFIG: ChartConfig = {
  actual: { label: 'Actual', color: 'hsl(var(--chart-1))' },
  updatedExpected: { label: 'Updated target', color: 'hsl(var(--chart-1))' },
  originalExpected: { label: 'Original target', color: 'hsl(var(--muted-foreground))' },
}

function formatTickDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function buildTicks(startMs: number, endMs: number): number[] {
  const totalMs = endMs - startMs
  const DAY_MS = 86_400_000
  const WEEK_MS = 7 * DAY_MS
  const interval =
    totalMs <= 14 * DAY_MS ? DAY_MS : totalMs <= 60 * DAY_MS ? WEEK_MS : 4 * WEEK_MS
  const ticks: number[] = []
  let t = startMs
  while (t <= endMs) {
    ticks.push(t)
    t += interval
  }
  if (ticks[ticks.length - 1] !== endMs) ticks.push(endMs)
  return ticks
}

interface TrainingProgressCardProps {
  progress: TrainingProgressData
  grow?: boolean
}

export function TrainingProgressCard({
  progress,
  grow = false,
}: TrainingProgressCardProps): React.ReactElement {
  const { points, totalExpectedPuzzles } = progress

  const startMs = points[0]?.timeMs ?? Date.now()
  const endMs = points[points.length - 1]?.timeMs ?? Date.now()
  const ticks = React.useMemo(() => buildTicks(startMs, endMs), [startMs, endMs])

  const showUpdated = React.useMemo(
    () => points.some((p) => p.updatedExpected !== p.originalExpected),
    [points],
  )

  return (
    <div className={grow ? 'rounded-md border p-4 flex-1 min-h-72 flex flex-col' : 'rounded-md border p-4'}>
      <div className="mb-4">
        <p className="text-sm font-semibold">Training progress</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Cumulative puzzles completed vs schedule targets
        </p>
      </div>
      <ChartContainer config={PROGRESS_CONFIG} className={grow ? 'flex-1 min-h-0 min-w-0 w-full' : 'h-64 min-w-0 w-full'}>
        <ComposedChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={1} />
          <XAxis
            dataKey="timeMs"
            type="number"
            scale="linear"
            domain={[startMs, endMs]}
            ticks={ticks}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            tickFormatter={formatTickDate}
          />
          <YAxis hide domain={[0, totalExpectedPuzzles]} />
          <ChartTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const point = payload[0]?.payload as TrainingProgressPoint
              return (
                <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
                  <p className="font-medium">{formatTickDate(point.timeMs)}</p>
                  {point.actual !== null && (
                    <p className="text-muted-foreground">Actual: {Math.round(point.actual)}</p>
                  )}
                  {showUpdated && point.updatedExpected !== null && (
                    <p className="text-muted-foreground">
                      Updated target: {Math.round(point.updatedExpected)}
                    </p>
                  )}
                  {point.originalExpected !== null && (
                    <p className="text-muted-foreground">
                      Original target: {Math.round(point.originalExpected)}
                    </p>
                  )}
                </div>
              )
            }}
          />
          <Line
            dataKey="originalExpected"
            stroke="var(--color-originalExpected)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Area
            dataKey="actual"
            stroke="var(--color-actual)"
            strokeWidth={2}
            fill="var(--color-actual)"
            fillOpacity={0.15}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          {showUpdated && (
            <Line
              dataKey="updatedExpected"
              stroke="var(--color-updatedExpected)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ChartContainer>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {showUpdated && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[hsl(var(--chart-1))]" />
            Updated target
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[hsl(var(--muted-foreground))]" />
          {showUpdated ? 'Original target' : 'Target'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t-2 border-[hsl(var(--chart-1))]" />
          Actual
        </span>
      </div>
    </div>
  )
}
