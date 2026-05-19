import * as React from 'react'
import { useEffect, useState } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '../ui/chart'
import { formatNumber } from '../../lib/utils'
import type { ScrapedPositionalSourceRunMetadata } from '../../lib/api'

const THEME_BAR_LABEL_MAX_CHARS = 8
const CHART_COLOR = 'hsl(var(--chart-1))'
const CHART_CONFIG: ChartConfig = { count: { label: 'Puzzles', color: CHART_COLOR } }

type StatCardProps = {
  label: string
  value: string
}

function StatCard({ label, value }: StatCardProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

type Props = {
  metadata: ScrapedPositionalSourceRunMetadata
}

export function ScrapedPositionalDashboard({ metadata }: Props): React.ReactElement {
  const [chartsReady, setChartsReady] = useState(false)
  useEffect(() => { setChartsReady(true) }, [])

  const themeBars = metadata.themes.map((t) => ({
    ...t,
    shortLabel:
      t.displayName.length > THEME_BAR_LABEL_MAX_CHARS
        ? t.displayName.slice(0, THEME_BAR_LABEL_MAX_CHARS - 1) + '…'
        : t.displayName,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total puzzles" value={formatNumber(metadata.totalPositionalAfterRun)} />
        <StatCard label="Difficulty tiers" value={String(metadata.difficultyCounts.length)} />
      </div>

      {chartsReady && metadata.difficultyCounts.length > 0 && (
        <div className="rounded-md border p-4">
          <div className="mb-4">
            <p className="text-sm font-semibold">Difficulty distribution</p>
            <p className="mt-1 text-xs text-muted-foreground">
              How puzzles are spread across the four rating buckets
            </p>
          </div>
          <ChartContainer config={CHART_CONFIG} className="h-48 min-w-0 w-full">
            <BarChart
              data={metadata.difficultyCounts}
              margin={{ top: 4, right: 4, left: 16, bottom: 8 }}
              barCategoryGap="28%"
            >
              <XAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fontSize: 11 }}
              />
              <YAxis hide />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload as {
                    label: string
                    description: string
                    minRating: number | null
                    maxRating: number | null
                    count: number
                  }
                  return (
                    <div className="rounded border bg-background px-3 py-2 text-xs shadow-md">
                      <p className="font-medium text-foreground">{d.label}</p>
                      {d.minRating !== null && d.maxRating !== null && (
                        <p className="mt-0.5 text-muted-foreground">{d.minRating}–{d.maxRating} Elo</p>
                      )}
                      <p className="mt-1.5 tabular-nums text-foreground">
                        {formatNumber(d.count)} puzzles
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" isAnimationActive={false} radius={[2, 2, 0, 0]} fill={CHART_COLOR} />
            </BarChart>
          </ChartContainer>
        </div>
      )}

      {chartsReady && themeBars.length > 0 && (
        <div className="rounded-md border p-4">
          <div className="mb-4">
            <p className="text-sm font-semibold">Most common themes</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The most frequent positional motifs across all imported puzzles
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
                      <p className="mt-1.5 tabular-nums text-foreground">
                        {formatNumber(t.count)} puzzles
                      </p>
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
