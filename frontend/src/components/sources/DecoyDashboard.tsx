import * as React from 'react'
import { useEffect, useState } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, type ChartConfig } from '../ui/chart'
import { formatNumber } from '../../lib/utils'
import type { DecoySourceRunMetadata } from '../../lib/api'

const OPENING_LABEL_MAX_CHARS = 10
const CHART_COLOR = 'hsl(var(--chart-1))'
const CHART_CONFIG: ChartConfig = { count: { label: 'Puzzles', color: CHART_COLOR } }

type StatCardProps = { label: string; value: string }

function StatCard({ label, value }: StatCardProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

type Props = { metadata: DecoySourceRunMetadata }

export function DecoyDashboard({ metadata }: Props): React.ReactElement {
  const [chartsReady, setChartsReady] = useState(false)
  useEffect(() => { setChartsReady(true) }, [])

  const openingBars = metadata.topOpenings.map((o) => ({
    ...o,
    shortLabel:
      o.displayName.length > OPENING_LABEL_MAX_CHARS
        ? o.displayName.slice(0, OPENING_LABEL_MAX_CHARS - 1) + '…'
        : o.displayName,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total decoys" value={formatNumber(metadata.totalDecoysAfterRun)} />
        <StatCard label="Last import" value={new Date(metadata.generatedAt).toLocaleDateString()} />
      </div>

      {chartsReady && openingBars.length > 0 && (
        <div className="rounded-md border p-4">
          <div className="mb-4">
            <p className="text-sm font-semibold">Most common openings</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Top openings represented across all imported decoy positions
            </p>
          </div>
          <ChartContainer config={CHART_CONFIG} className="h-64 min-w-0 w-full">
            <BarChart
              data={openingBars}
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
                  const o = payload[0]?.payload as { displayName: string; count: number }
                  return (
                    <div className="rounded border bg-background px-3 py-2 text-xs shadow-md">
                      <p className="font-medium text-foreground">{o.displayName}</p>
                      <p className="mt-1.5 tabular-nums text-foreground">
                        {formatNumber(o.count)} puzzles
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                {openingBars.map((_, i) => (
                  <Cell
                    key={i}
                    fill={CHART_COLOR}
                    fillOpacity={openingBars.length > 1 ? 1 - (i / (openingBars.length - 1)) * 0.75 : 1}
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
