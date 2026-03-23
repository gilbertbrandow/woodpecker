import * as React from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import type { SubsetStats as SubsetStatsType } from '../../lib/api'

const CHART_BLUE = 'hsl(var(--chart-1))'
const SLICE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-1) / 0.75)',
  'hsl(var(--chart-1) / 0.55)',
  'hsl(var(--chart-1) / 0.4)',
  'hsl(var(--chart-1) / 0.28)',
]
const OTHER_COLOR = 'hsl(var(--chart-1) / 0.15)'
const NO_OPENING_COLOR = 'hsl(var(--muted-foreground) / 0.3)'

type SubsetStatsProps = {
  stats: SubsetStatsType
}

export function SubsetStats({ stats }: SubsetStatsProps): React.ReactElement {
  const topThemes = stats.themes.slice(0, 10)

  const openingPieData = React.useMemo(() => {
    const top5 = stats.openings.slice(0, 5)
    const otherCount = stats.openings.slice(5).reduce((s, o) => s + o.count, 0)
    const result: { name: string; count: number; color: string }[] = top5.map((o, i) => ({
      name: o.displayName || o.name,
      count: o.count,
      color: SLICE_COLORS[i] ?? CHART_BLUE,
    }))
    if (otherCount > 0) {
      result.push({ name: 'Other openings', count: otherCount, color: OTHER_COLOR })
    }
    if (stats.noOpeningCount > 0) {
      result.push({ name: 'No opening', count: stats.noOpeningCount, color: NO_OPENING_COLOR })
    }
    return result
  }, [stats.openings, stats.noOpeningCount])

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Active puzzles" value={String(stats.totalActive)} />
        <StatCard label="Avg rating" value={String(stats.avgRating)} />
        <StatCard label="Avg popularity" value={String(stats.avgPopularity)} />
        <StatCard label="Avg plays" value={stats.avgNbPlays.toLocaleString()} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Rating distribution</p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={stats.ratingBuckets}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              barCategoryGap={4}
            >
              <XAxis
                dataKey="min"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis hide />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const bucket = payload[0]?.payload as { min: number; max: number; count: number } | undefined
                  return (
                    <div className="rounded border bg-background px-2 py-1 text-xs shadow">
                      <p className="text-muted-foreground">{bucket?.min}–{(bucket?.max ?? 0) - 1}</p>
                      <p>{bucket?.count} puzzles</p>
                    </div>
                  )
                }}
              />
              <Bar
                dataKey="count"
                fill={CHART_BLUE}
                fillOpacity={0.75}
                isAnimationActive={false}
                barSize={14}
                radius={[2, 2, 0, 0]}
              />
              <Line
                dataKey="count"
                stroke={CHART_BLUE}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                type="monotone"
                strokeOpacity={0.8}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {topThemes.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Top themes</p>
          <div style={{ height: topThemes.length * 28 + 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topThemes}
                layout="vertical"
                margin={{ top: 0, right: 4, left: 0, bottom: 0 }}
                barCategoryGap={6}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="displayName"
                  tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  width={130}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const entry = payload[0]?.payload as { displayName: string; count: number } | undefined
                    return (
                      <div className="rounded border bg-background px-2 py-1 text-xs shadow">
                        <p>{entry?.displayName}</p>
                        <p className="text-muted-foreground">{entry?.count} puzzles</p>
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey="count"
                  fill={CHART_BLUE}
                  fillOpacity={0.8}
                  isAnimationActive={false}
                  barSize={14}
                  radius={[0, 2, 2, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {openingPieData.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Openings</p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const entry = payload[0]?.payload as { name: string; count: number } | undefined
                      return (
                        <div className="rounded border bg-background px-2 py-1 text-xs shadow">
                          <p>{entry?.name}</p>
                          <p className="text-muted-foreground">{entry?.count} puzzles</p>
                        </div>
                      )
                    }}
                  />
                  <Pie
                    data={openingPieData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="38%"
                    outerRadius="78%"
                    isAnimationActive={false}
                    strokeWidth={0}
                  >
                    {openingPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex flex-col gap-1.5 text-xs">
              {openingPieData.map((entry) => (
                <li key={entry.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: entry.color }} />
                  <span className="text-foreground">{entry.name}</span>
                  <span className="ml-2 tabular-nums text-muted-foreground">{entry.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
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
