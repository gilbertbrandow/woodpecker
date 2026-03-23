import * as React from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { SubsetStats as SubsetStatsType } from '../../lib/api'

type SubsetStatsProps = {
  stats: SubsetStatsType
}

export function SubsetStats({ stats }: SubsetStatsProps): React.ReactElement {
  const topThemes = stats.themes.slice(0, 10)
  const topOpenings = stats.openings.slice(0, 10)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Active puzzles" value={String(stats.totalActive)} />
        <StatCard label="Avg popularity" value={String(stats.avgPopularity)} />
        <StatCard label="Avg plays" value={stats.avgNbPlays.toLocaleString()} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Rating distribution</p>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.ratingBuckets} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
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
                  const entry = payload[0]
                  const bucket = entry?.payload as { min: number; max: number; count: number } | undefined
                  return (
                    <div className="rounded border bg-background px-2 py-1 text-xs shadow">
                      <p className="text-muted-foreground">
                        {bucket?.min} – {bucket?.max}
                      </p>
                      <p>{bucket?.count} puzzles</p>
                    </div>
                  )
                }}
              />
              <Bar
                dataKey="count"
                fill="hsl(var(--primary))"
                fillOpacity={0.8}
                isAnimationActive={false}
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {topThemes.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Top themes</p>
            <ul className="flex flex-col gap-1">
              {topThemes.map((t) => (
                <li key={t.name} className="flex items-center justify-between text-sm">
                  <span className="truncate text-foreground">{t.displayName}</span>
                  <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">{t.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {topOpenings.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Top openings</p>
            <ul className="flex flex-col gap-1">
              {topOpenings.map((o) => (
                <li key={o.name} className="flex items-center justify-between text-sm">
                  <span className="truncate text-foreground">{o.displayName}</span>
                  <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">{o.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
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
