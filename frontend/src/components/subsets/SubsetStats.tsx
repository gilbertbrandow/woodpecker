import * as React from 'react'
import { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../ui/chart'
import type { SubsetStats as SubsetStatsType } from '../../lib/api'
import { formatNumber } from '../../lib/utils'

const THEME_LABEL_MAX_CHARS = 17
const THEME_BAR_LABEL_MAX_CHARS = 8

const CHART_COLOR = 'hsl(var(--chart-1))'
const CHART_CONFIG: ChartConfig = { count: { label: 'Puzzles', color: CHART_COLOR } }

const SLICE_COLORS = [
  CHART_COLOR,
  'hsl(var(--chart-1) / 0.75)',
  'hsl(var(--chart-1) / 0.55)',
  'hsl(var(--chart-1) / 0.4)',
  'hsl(var(--chart-1) / 0.28)',
]
const OTHER_COLOR = 'hsl(var(--chart-1) / 0.15)'
const NO_OPENING_COLOR = 'hsl(var(--chart-1) / 0.2)'
type SubsetStatsProps = {
  stats: SubsetStatsType
}

export function SubsetStats({ stats }: SubsetStatsProps): React.ReactElement {
  const [open, setOpen] = useState(true)
  const topThemes = stats.themes.slice(0, 20).map((t) => ({
    ...t,
    label:
      t.displayName.length > THEME_LABEL_MAX_CHARS
        ? t.displayName.slice(0, THEME_LABEL_MAX_CHARS - 1) + '…'
        : t.displayName,
    shortLabel:
      t.displayName.length > THEME_BAR_LABEL_MAX_CHARS
        ? t.displayName.slice(0, THEME_BAR_LABEL_MAX_CHARS - 1) + '…'
        : t.displayName,
  }))

  const openingPresenceData = React.useMemo(() => {
    const hasOpening = stats.totalActive - stats.noOpeningCount
    return [
      { name: 'Opening (< 30 moves)', count: hasOpening, color: CHART_COLOR },
      { name: 'Not during opening', count: stats.noOpeningCount, color: NO_OPENING_COLOR },
    ]
  }, [stats.totalActive, stats.noOpeningCount])

  const openingBreakdownData = React.useMemo(() => {
    const top5 = stats.openings.slice(0, 5)
    const otherCount = stats.openings.slice(5).reduce((s, o) => s + o.count, 0)
    const result: { name: string; count: number; color: string }[] = top5.map((o, i) => ({
      name: o.displayName || o.name,
      count: o.count,
      color: SLICE_COLORS[i] ?? CHART_COLOR,
    }))
    if (otherCount > 0) result.push({ name: 'Other', count: otherCount, color: OTHER_COLOR })
    return result
  }, [stats.openings])

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between border-b pb-2.5 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
              style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
            Stats
          </span>
          <span className="hidden text-xs text-muted-foreground sm:block">
            Statistics for the puzzles in this subset
          </span>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="flex flex-col gap-4 pt-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Active puzzles" value={String(stats.totalActive)} />
            <StatCard label="Avg rating" value={String(stats.avgRating)} />
            <StatCard label="Avg popularity" value={formatNumber(stats.avgPopularity)} />
            <StatCard label="Avg plays" value={formatNumber(stats.avgNbPlays)} />
          </div>

          <div className="rounded-md border p-4">
            <div className="mb-4">
              <p className="text-sm font-semibold">Rating distribution</p>
              <p className="mt-1 text-xs text-muted-foreground">How puzzles in this subset are spread across rating ranges</p>
            </div>
            <ChartContainer config={CHART_CONFIG} className="h-56 w-full">
              <AreaChart
                data={stats.ratingBuckets}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="ratingStatsGradient" x1="0" y1="0" x2="0" y2="1">
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
                  content={({ active, payload, label }) => (
                    <ChartTooltipContent
                      active={active}
                      payload={payload}
                      label={label}
                      hideLabel
                      formatter={(value: unknown, _name: string, item: unknown) => {
                        const b = (item as { payload?: { min: number; max: number } }).payload
                        return b ? `${b.min}–${b.max - 1}: ${String(value)} puzzles` : String(value)
                      }}
                    />
                  )}
                />
                <Area
                  dataKey="count"
                  type="monotone"
                  stroke="var(--color-count)"
                  fill="url(#ratingStatsGradient)"
                  fillOpacity={1}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
          </div>

          {topThemes.length > 0 && (
            <div className="rounded-md border p-4">
              <div className="mb-4">
                <p className="text-sm font-semibold">Top themes</p>
                <p className="mt-1 text-xs text-muted-foreground">The most common tactical motifs across puzzles in this subset</p>
              </div>
              <ChartContainer config={CHART_CONFIG} className="h-64 w-full">
                <BarChart
                  data={topThemes}
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
                          <p className="mt-1.5 tabular-nums text-foreground">{t.count} puzzles</p>
                        </div>
                      )
                    }}
                  />
                  <Bar
                    dataKey="count"
                    isAnimationActive={false}
                    radius={[2, 2, 0, 0]}
                  >
                    {topThemes.map((_, i) => (
                      <Cell
                        key={i}
                        fill="var(--color-count)"
                        fillOpacity={topThemes.length > 1 ? 1 - (i / (topThemes.length - 1)) * 0.75 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          )}

          {stats.openings.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-md border p-4">
                <div className="mb-4">
                  <p className="text-sm font-semibold">Opening coverage</p>
                  <p className="mt-1 text-xs text-muted-foreground">Share of puzzles arising during opening</p>
                </div>
                <div className="flex items-center gap-2">
                  <ChartContainer config={CHART_CONFIG} className="h-40 w-40 shrink-0">
                    <PieChart>
                      <ChartTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const e = payload[0]?.payload as { name: string; count: number }
                          return (
                            <div className="rounded border bg-background px-3 py-2 text-xs shadow-md">
                              <p className="font-medium text-foreground">{e.name}</p>
                              <p className="tabular-nums text-muted-foreground">{e.count} puzzles</p>
                            </div>
                          )
                        }}
                      />
                      <Pie
                        data={openingPresenceData}
                        dataKey="count"
                        nameKey="name"
                        outerRadius="88%"
                        isAnimationActive={false}
                        strokeWidth={0}
                      >
                        {openingPresenceData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <ul className="flex flex-col gap-1.5 text-[11px]">
                    {openingPresenceData.map((entry) => (
                      <li key={entry.name} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: entry.color }} />
                        <span className="text-foreground">{entry.name}</span>
                        <span className="ml-1.5 tabular-nums text-muted-foreground">{entry.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="rounded-md border p-4">
                <div className="mb-4">
                  <p className="text-sm font-semibold">Opening breakdown</p>
                  <p className="mt-1 text-xs text-muted-foreground">Distribution across the most common openings</p>
                </div>
                <div className="flex items-center gap-2">
                  <ChartContainer config={CHART_CONFIG} className="h-40 w-40 shrink-0">
                    <PieChart>
                      <ChartTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const e = payload[0]?.payload as { name: string; count: number }
                          return (
                            <div className="rounded border bg-background px-3 py-2 text-xs shadow-md">
                              <p className="font-medium text-foreground">{e.name}</p>
                              <p className="tabular-nums text-muted-foreground">{e.count} puzzles</p>
                            </div>
                          )
                        }}
                      />
                      <Pie
                        data={openingBreakdownData}
                        dataKey="count"
                        nameKey="name"
                        outerRadius="88%"
                        isAnimationActive={false}
                        strokeWidth={0}
                      >
                        {openingBreakdownData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <ul className="flex flex-col gap-1.5 text-[11px]">
                    {openingBreakdownData.map((entry) => (
                      <li key={entry.name} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: entry.color }} />
                        <span className="text-foreground">{entry.name}</span>
                        <span className="ml-1.5 tabular-nums text-muted-foreground">{entry.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function StatCard({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
