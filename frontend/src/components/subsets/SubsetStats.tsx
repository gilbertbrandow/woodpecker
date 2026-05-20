import * as React from 'react'
import { useState, useEffect } from 'react'
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
import type {
  SubsetStats as SubsetStatsType,
  LichessTacticStats,
  ScrapedPositionalStats,
} from '../../lib/api'
import { formatNumber } from '../../lib/utils'

const THEME_LABEL_MAX_CHARS = 17
const THEME_BAR_LABEL_MAX_CHARS = 8

const CHART_COLOR = 'hsl(var(--chart-1))'
const CHART_CONFIG: ChartConfig = { count: { label: 'Puzzles', color: CHART_COLOR } }
const SLICE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-1) / 0.85)',
  'hsl(var(--chart-1) / 0.7)',
  'hsl(var(--chart-1) / 0.55)',
  'hsl(var(--chart-1) / 0.4)',
  'hsl(var(--chart-1) / 0.28)',
]
const OTHER_COLOR = 'hsl(var(--chart-1) / 0.15)'
const NO_OPENING_COLOR = 'hsl(var(--chart-1) / 0.2)'

type SubsetStatsProps = {
  stats: SubsetStatsType
  collapsible?: boolean
}

function StatCard({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function ThemeBarChart({
  themes,
}: {
  themes: { name: string; displayName: string; description?: string; count: number }[]
}): React.ReactElement | null {
  const topThemes = themes.slice(0, 20).map((t) => ({
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
  if (topThemes.length === 0) return null
  return (
    <div className="rounded-md border p-4">
      <div className="mb-4">
        <p className="text-sm font-semibold">Top themes</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The most common motifs across puzzles in this source
        </p>
      </div>
      <ChartContainer config={CHART_CONFIG} className="h-64 min-w-0 w-full">
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
                description?: string
                count: number
              }
              return (
                <div className="rounded border bg-background px-3 py-2 text-xs shadow-md">
                  <p className="font-medium text-foreground">{t.displayName}</p>
                  {t.description && (
                    <p className="mt-0.5 text-muted-foreground">{t.description}</p>
                  )}
                  <p className="mt-1.5 tabular-nums text-foreground">{t.count} puzzles</p>
                </div>
              )
            }}
          />
          <Bar dataKey="count" isAnimationActive={false} radius={[2, 2, 0, 0]}>
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
  )
}

function OpeningCharts({
  openings,
  totalForCoverage,
  noOpeningCount,
}: {
  openings: { name: string; displayName: string; count: number }[]
  totalForCoverage?: number
  noOpeningCount?: number
}): React.ReactElement | null {
  const openingBreakdownData = React.useMemo(() => {
    const top5 = openings.slice(0, 5)
    const otherCount = openings.slice(5).reduce((s, o) => s + o.count, 0)
    const result: { name: string; count: number; color: string }[] = top5.map((o, i) => ({
      name: o.displayName || o.name,
      count: o.count,
      color: SLICE_COLORS[i] ?? CHART_COLOR,
    }))
    if (otherCount > 0) result.push({ name: 'Other', count: otherCount, color: OTHER_COLOR })
    return result
  }, [openings])

  const openingPresenceData = React.useMemo(() => {
    if (totalForCoverage === undefined || noOpeningCount === undefined) return null
    const hasOpening = totalForCoverage - noOpeningCount
    return [
      { name: 'Opening (< 30 moves)', count: hasOpening, color: CHART_COLOR },
      { name: 'Not during opening', count: noOpeningCount, color: NO_OPENING_COLOR },
    ]
  }, [totalForCoverage, noOpeningCount])

  if (openings.length === 0) return null

  return (
    <div className={`grid grid-cols-1 gap-4 ${openingPresenceData ? 'sm:grid-cols-2' : ''}`}>
      {openingPresenceData && (
        <div className="rounded-md border p-4">
          <div className="mb-4">
            <p className="text-sm font-semibold">Opening coverage</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Share of puzzles arising during opening
            </p>
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
                  <span
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ background: entry.color }}
                  />
                  <span className="text-foreground">{entry.name}</span>
                  <span className="ml-1.5 tabular-nums text-muted-foreground">{entry.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="rounded-md border p-4">
        <div className="mb-4">
          <p className="text-sm font-semibold">Opening breakdown</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Distribution across the most common openings
          </p>
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
                <span
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ background: entry.color }}
                />
                <span className="text-foreground">{entry.name}</span>
                <span className="ml-1.5 tabular-nums text-muted-foreground">{entry.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function LichessTacticStatsSection({
  stats,
  chartsReady,
}: {
  stats: LichessTacticStats
  chartsReady: boolean
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Puzzles" value={String(stats.count)} />
        <StatCard label="Avg rating" value={String(stats.avgRating)} />
        <StatCard label="Avg popularity" value={formatNumber(stats.avgPopularity)} />
        <StatCard label="Avg plays" value={formatNumber(stats.avgNbPlays)} />
      </div>

      {chartsReady && (
        <div className="rounded-md border p-4">
          <div className="mb-4">
            <p className="text-sm font-semibold">Rating distribution</p>
            <p className="mt-1 text-xs text-muted-foreground">
              How puzzles are spread across rating ranges
            </p>
          </div>
          <ChartContainer config={CHART_CONFIG} className="h-56 min-w-0 w-full">
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
      )}

      {chartsReady && <ThemeBarChart themes={stats.themes} />}

      {stats.openings.length > 0 && (
        <OpeningCharts
          openings={stats.openings}
          totalForCoverage={stats.count}
          noOpeningCount={stats.noOpeningCount}
        />
      )}
    </div>
  )
}

function ScrapedPositionalStatsSection({
  stats,
  chartsReady,
}: {
  stats: ScrapedPositionalStats
  chartsReady: boolean
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Puzzles" value={String(stats.count)} />
      </div>

      {chartsReady && stats.difficultyDistribution.length > 0 && (
        <div className="rounded-md border p-4">
          <div className="mb-4">
            <p className="text-sm font-semibold">Difficulty distribution</p>
            <p className="mt-1 text-xs text-muted-foreground">
              How puzzles are spread across difficulty levels
            </p>
          </div>
          <ChartContainer config={CHART_CONFIG} className="h-56 min-w-0 w-full">
            <BarChart
              data={stats.difficultyDistribution}
              margin={{ top: 4, right: 4, left: 16, bottom: 8 }}
              barCategoryGap="20%"
            >
              <XAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
              />
              <YAxis hide />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload as { label: string; count: number }
                  return (
                    <div className="rounded border bg-background px-3 py-2 text-xs shadow-md">
                      <p className="font-medium text-foreground">{d.label}</p>
                      <p className="tabular-nums text-muted-foreground">{d.count} puzzles</p>
                    </div>
                  )
                }}
              />
              <Bar
                dataKey="count"
                isAnimationActive={false}
                radius={[2, 2, 0, 0]}
                fill={CHART_COLOR}
              />
            </BarChart>
          </ChartContainer>
        </div>
      )}

      {chartsReady && <ThemeBarChart themes={stats.themes} />}

      {stats.openings.length > 0 && <OpeningCharts openings={stats.openings} />}
    </div>
  )
}

export function SubsetStats({ stats, collapsible = true }: SubsetStatsProps): React.ReactElement {
  const [open, setOpen] = useState(true)
  const [chartsReady, setChartsReady] = useState(false)
  useEffect(() => {
    setChartsReady(true)
  }, [])

  const lichessStats = stats.sources.LICHESS_TACTIC
  const positionalStats = stats.sources.SCRAPED_POSITIONAL
  const hasMultipleSources =
    (lichessStats !== undefined ? 1 : 0) + (positionalStats !== undefined ? 1 : 0) > 1

  const inner = (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Active puzzles" value={String(stats.totalActive)} />
      </div>

      {lichessStats && (
        <div className="flex flex-col gap-4">
          {hasMultipleSources && (
            <p className="text-sm font-medium text-muted-foreground">Lichess Tactics</p>
          )}
          <LichessTacticStatsSection stats={lichessStats} chartsReady={chartsReady} />
        </div>
      )}

      {positionalStats && (
        <div className="flex flex-col gap-4">
          {hasMultipleSources && (
            <p className="text-sm font-medium text-muted-foreground">Scraped Positionals</p>
          )}
          <ScrapedPositionalStatsSection stats={positionalStats} chartsReady={chartsReady} />
        </div>
      )}
    </div>
  )

  if (!collapsible) {
    return inner
  }

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
        <div className="pt-4">{inner}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
