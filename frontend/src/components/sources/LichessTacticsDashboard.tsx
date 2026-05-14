import * as React from 'react'
import { useMemo, useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, BarChart, Bar, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../ui/chart'
import { formatNumber } from '../../lib/utils'
import type { LichessTacticsSourceRunMetadata } from '../../lib/api'

const THEME_BAR_LABEL_MAX_CHARS = 8
const CHART_COLOR = 'hsl(var(--chart-1))'
const CHART_CONFIG: ChartConfig = { count: { label: 'Tactics', color: CHART_COLOR } }

type StatCardProps = {
  label: string
  value: string
  secondary?: string
  tag?: string
}

function StatCard({ label, value, secondary, tag }: StatCardProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        {tag && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {tag}
          </span>
        )}
      </div>
      {secondary && <p className="text-xs text-muted-foreground">{secondary}</p>}
    </div>
  )
}

type Props = {
  metadata: LichessTacticsSourceRunMetadata
}

export function LichessTacticsDashboard({ metadata }: Props): React.ReactElement {
  const [chartsReady, setChartsReady] = useState(false)
  useEffect(() => { setChartsReady(true) }, [])

  const ratingBuckets = useMemo(() => {
    const entries = Object.entries(metadata.ratingBucketCounts)
      .map(([k, count]) => ({ min: Number(k), count }))
      .sort((a, b) => a.min - b.min)
    return entries.map((b, i) => ({
      min: b.min,
      max: entries[i + 1]?.min ?? b.min + 50,
      count: b.count,
    }))
  }, [metadata.ratingBucketCounts])

  const withOpeningsPct =
    metadata.totalTacticsAfterRun > 0
      ? Math.round((metadata.tacticsWithOpeningsCount / metadata.totalTacticsAfterRun) * 1000) / 10
      : 0

  const themeBars = (metadata.themes ?? []).map((t) => ({
    ...t,
    shortLabel:
      t.displayName.length > THEME_BAR_LABEL_MAX_CHARS
        ? t.displayName.slice(0, THEME_BAR_LABEL_MAX_CHARS - 1) + '…'
        : t.displayName,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Total tactics"
          value={formatNumber(metadata.totalTacticsAfterRun)}
        />
        <StatCard
          label="With openings"
          value={formatNumber(metadata.tacticsWithOpeningsCount)}
          tag={metadata.totalTacticsAfterRun > 0 ? `${withOpeningsPct}%` : undefined}
        />
      </div>

      {chartsReady && (
        <div className="rounded-md border p-4">
          <div className="mb-4">
            <p className="text-sm font-semibold">Rating distribution</p>
            <p className="mt-1 text-xs text-muted-foreground">
              How imported tactics are spread across rating ranges
            </p>
          </div>
          {ratingBuckets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rating data available.</p>
          ) : (
            <ChartContainer config={CHART_CONFIG} className="h-56 min-w-0 w-full">
              <AreaChart
                data={ratingBuckets}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="ratingSourceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="min"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tick={{ fontSize: 10 }}
                />
                <YAxis hide />
                <ChartTooltip
                  content={({ active, payload }) => (
                    <ChartTooltipContent
                      active={active}
                      payload={payload}
                      hideLabel
                      formatter={(value: unknown, _name: string, item: unknown) => {
                        const b = (item as { payload?: { min: number; max: number } }).payload
                        return b
                          ? `${b.min}–${b.max - 1}: ${formatNumber(Number(value))} tactics`
                          : String(value)
                      }}
                    />
                  )}
                />
                <Area
                  dataKey="count"
                  type="monotone"
                  stroke="var(--color-count)"
                  fill="url(#ratingSourceGradient)"
                  fillOpacity={1}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </div>
      )}

      {chartsReady && themeBars.length > 0 && (
        <div className="rounded-md border p-4">
          <div className="mb-4">
            <p className="text-sm font-semibold">Most common themes</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The most frequent tactical motifs across all imported tactics
            </p>
          </div>
          <ChartContainer config={CHART_CONFIG} className="h-64 min-w-0 w-full">
            <BarChart
              data={themeBars}
              margin={{ top: 4, right: 4, left: 16, bottom: 8 }}
              barCategoryGap="20%"
            >
              <XAxis
                type="category"
                dataKey="shortLabel"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fontSize: 10, angle: -45, textAnchor: 'end' }}
                height={52}
              />
              <YAxis hide />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const t = payload[0]?.payload as {
                    displayName: string
                    description: string
                    count: number
                  }
                  return (
                    <div className="rounded border bg-background px-3 py-2 text-xs shadow-md">
                      <p className="font-medium text-foreground">{t.displayName}</p>
                      <p className="mt-0.5 text-muted-foreground">{t.description}</p>
                      <p className="mt-1.5 tabular-nums text-foreground">{formatNumber(t.count)} tactics</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                {themeBars.map((_, i) => (
                  <Cell
                    key={i}
                    fill={CHART_COLOR}
                    fillOpacity={themeBars.length > 1 ? 1 - (i / (themeBars.length - 1)) * 0.75 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </div>
  )
}
