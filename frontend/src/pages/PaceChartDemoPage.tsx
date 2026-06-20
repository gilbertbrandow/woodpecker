import * as React from 'react'
import { RunPaceCard } from '../features/board/RunPaceCard'
import type {
  PaceChartData,
  PaceChartLabelTick,
  PaceChartPoint,
  PaceChartSummary,
  PaceChartTickKind,
} from '../lib/api'

// ── time constants ────────────────────────────────────────────────────────────

const H = 3_600_000
const D = 24 * H
const W = 7 * D

const NOW = Date.now()

// ── label generation (mirrors backend logic) ──────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function shortLabel(timeMs: number, _kind: PaceChartTickKind, domainLenMs: number): string {
  const d = new Date(timeMs)
  if (domainLenMs <= 48 * H) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (domainLenMs <= 7 * D) return DAYS[d.getDay()]
  if (domainLenMs <= 30 * D) return `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return MONTHS[d.getMonth()]
}

function buildLabelTicks(
  domainStartMs: number,
  domainEndMs: number,
  deadlineMs: number,
  runStatus: 'active' | 'completed' | 'aborted',
  projectedFinishMs: number | null,
): PaceChartLabelTick[] {
  const domainLenMs = domainEndMs - domainStartMs
  const n = domainLenMs <= 7 * D ? 8 : 7

  const kindAt = (i: number): PaceChartTickKind => {
    if (i === 0) return 'start'
    if (i === n - 1) {
      if (runStatus === 'active' && projectedFinishMs !== null && domainEndMs > deadlineMs) return 'projected_finish'
      if (runStatus === 'completed' && domainEndMs > deadlineMs) return 'completed'
      if (runStatus === 'aborted' && domainEndMs > deadlineMs) return 'aborted'
      return 'deadline'
    }
    return 'calendar'
  }

  return Array.from({ length: n }, (_, i) => {
    const timeMs = domainStartMs + Math.round((i * domainLenMs) / (n - 1))
    const kind = kindAt(i)
    return { timeMs, kind, shortLabel: shortLabel(timeMs, kind, domainLenMs) }
  })
}

// Returns the actual resolved count at time t.
// Uses Math.floor of a strictly non-decreasing function — provably non-decreasing.
//   frac(t) = ((t - startMs) / span) is linear, so non-decreasing in t.
//   frac^1.25 is non-decreasing (power of non-decreasing positive input).
//   resolvedAtAsOf * frac^1.25 is non-decreasing.
//   Math.floor(...) of a non-decreasing function is non-decreasing.
function actualAt(t: number, startMs: number, asOfMs: number, resolvedAtAsOf: number): number | null {
  if (t > asOfMs) return null
  if (asOfMs <= startMs || resolvedAtAsOf === 0) return 0
  const frac = Math.min(1, Math.max(0, (t - startMs) / (asOfMs - startMs)))
  return Math.floor(resolvedAtAsOf * Math.pow(frac, 1.25))
}

function buildSeries(
  labelTicks: PaceChartLabelTick[],
  startMs: number,
  deadlineMs: number,
  asOfMs: number,
  resolvedAtAsOf: number,
  totalItems: number,
  scheduleRate: number,
  isActive: boolean,
  projectedFinishMs: number | null,
  completedAtMs: number | null,
  abortedAtMs: number | null,
  domainEndMs: number,
): PaceChartPoint[] {
  const specialKinds: Record<number, PaceChartTickKind> = {
    [startMs]: 'start',
    [deadlineMs]: 'deadline',
    [asOfMs]: 'as_of',
    [domainEndMs]: 'domain_end',
  }
  if (projectedFinishMs !== null) specialKinds[projectedFinishMs] = 'projected_finish'
  if (completedAtMs !== null) specialKinds[completedAtMs] = 'completed'
  if (abortedAtMs !== null) specialKinds[abortedAtMs] = 'aborted'

  // Extra sample points within [startMs, asOfMs] so the curve has shape
  // between sparse label ticks
  const span = asOfMs - startMs
  const SAMPLE_FRACS = [0.08, 0.17, 0.27, 0.38, 0.50, 0.62, 0.73, 0.83, 0.91]
  const extraTimes = span > 0
    ? SAMPLE_FRACS.map((f) => Math.round(startMs + f * span))
    : []

  const allTimes = [
    ...new Set([
      ...labelTicks.map((t) => t.timeMs),
      ...Object.keys(specialKinds).map(Number),
      ...extraTimes,
    ]),
  ].sort((a, b) => a - b)

  return allTimes.map((t) => {
    const actual = actualAt(t, startMs, asOfMs, resolvedAtAsOf)

    const required =
      t <= startMs ? 0
      : t >= deadlineMs ? totalItems
      : ((t - startMs) / (deadlineMs - startMs)) * totalItems

    let projection: number | null = null
    if (isActive && t >= asOfMs) {
      projection = Math.min(totalItems, resolvedAtAsOf + scheduleRate * (t - asOfMs))
    }

    const point: PaceChartPoint = { timeMs: t, actual, required, projection }
    const kind = specialKinds[t]
    if (kind !== undefined) point.kind = kind
    return point
  })
}

// ── main factory ──────────────────────────────────────────────────────────────

interface ScenarioOpts {
  durationMs: number
  totalItems: number
  nowFraction: number
  resolvedFraction: number
  runStatus: 'active' | 'completed' | 'aborted'
}

function makePaceData(opts: ScenarioOpts): PaceChartData {
  const { durationMs, totalItems, nowFraction, resolvedFraction, runStatus } = opts

  const startMs = NOW - Math.round(nowFraction * durationMs)
  const deadlineMs = startMs + durationMs
  const resolvedAtAsOf = Math.round(totalItems * resolvedFraction)
  const scheduleRate = totalItems / durationMs

  const completedAtMs = runStatus === 'completed' ? NOW - Math.round(0.05 * durationMs) : null
  const abortedAtMs = runStatus === 'aborted' ? NOW - Math.round(0.05 * durationMs) : null
  const asOfMs = completedAtMs ?? abortedAtMs ?? NOW

  const isActive = runStatus === 'active'
  const projectedFinishMs =
    isActive && resolvedAtAsOf < totalItems
      ? Math.round(asOfMs + (totalItems - resolvedAtAsOf) / scheduleRate)
      : null

  const domainEndMs =
    runStatus === 'active' ? Math.max(deadlineMs, projectedFinishMs ?? deadlineMs)
    : runStatus === 'completed' ? Math.max(deadlineMs, completedAtMs ?? deadlineMs)
    : Math.max(deadlineMs, abortedAtMs ?? deadlineMs)

  const requiredAtAsOf =
    asOfMs <= startMs ? 0
    : asOfMs >= deadlineMs ? totalItems
    : ((asOfMs - startMs) / (deadlineMs - startMs)) * totalItems

  const delta = resolvedAtAsOf - requiredAtAsOf
  const summaryState: PaceChartSummary['state'] =
    runStatus === 'completed' ? 'completed'
    : runStatus === 'aborted' ? 'aborted'
    : asOfMs > deadlineMs ? 'active_overdue'
    : Math.abs(delta) <= 1 ? 'active_on_pace'
    : delta > 0 ? 'active_ahead'
    : 'active_behind'

  const labelTicks = buildLabelTicks(startMs, domainEndMs, deadlineMs, runStatus, projectedFinishMs)
  const series = buildSeries(
    labelTicks, startMs, deadlineMs, asOfMs,
    resolvedAtAsOf, totalItems, scheduleRate, isActive,
    projectedFinishMs, completedAtMs, abortedAtMs, domainEndMs,
  )

  const summary: PaceChartSummary = {
    state: summaryState,
    resolvedItems: resolvedAtAsOf,
    totalItems,
    remainingItems: totalItems - resolvedAtAsOf,
    deltaItemsVsRequired: delta,
    deadlineDeltaMs: deadlineMs - asOfMs,
    projectedFinishMs,
    completedAtMs,
    abortedAtMs,
    completedDeltaMs: completedAtMs !== null ? deadlineMs - completedAtMs : null,
    abortedDeltaMs: abortedAtMs !== null ? deadlineMs - abortedAtMs : null,
  }

  return {
    runStatus,
    startMs,
    deadlineMs,
    asOfMs,
    domainStartMs: startMs,
    domainEndMs,
    totalItems,
    resolvedItems: resolvedAtAsOf,
    requiredResolvedAtAsOf: requiredAtAsOf,
    projectedFinishMs,
    labelTicks,
    series,
    summary,
  }
}

// ── scenarios ─────────────────────────────────────────────────────────────────

const SCENARIOS: { label: string; data: PaceChartData }[] = [
  {
    label: '1h — active, ahead (hourly ticks)',
    data: makePaceData({ durationMs: H, totalItems: 20, nowFraction: 0.5, resolvedFraction: 0.75, runStatus: 'active' }),
  },
  {
    label: '6h — active, behind (domain extends past deadline)',
    data: makePaceData({ durationMs: 6 * H, totalItems: 60, nowFraction: 0.4, resolvedFraction: 0.12, runStatus: 'active' }),
  },
  {
    label: '24h — active, on pace (4h ticks)',
    data: makePaceData({ durationMs: D, totalItems: 100, nowFraction: 0.5, resolvedFraction: 0.49, runStatus: 'active' }),
  },
  {
    label: '48h — active, overdue (past deadline)',
    data: makePaceData({ durationMs: 2 * D, totalItems: 80, nowFraction: 1.15, resolvedFraction: 0.7, runStatus: 'active' }),
  },
  {
    label: '1 week — active, ahead (daily ticks)',
    data: makePaceData({ durationMs: W, totalItems: 140, nowFraction: 0.5, resolvedFraction: 0.65, runStatus: 'active' }),
  },
  {
    label: '1 week — active, behind (domain > 7d → weekly ticks)',
    data: makePaceData({ durationMs: W, totalItems: 140, nowFraction: 0.3, resolvedFraction: 0.08, runStatus: 'active' }),
  },
  {
    label: '1 week — completed early',
    data: makePaceData({ durationMs: W, totalItems: 100, nowFraction: 0.78, resolvedFraction: 1.0, runStatus: 'completed' }),
  },
  {
    label: '1 week — completed late',
    data: makePaceData({ durationMs: W, totalItems: 100, nowFraction: 1.12, resolvedFraction: 1.0, runStatus: 'completed' }),
  },
  {
    label: '1 week — aborted midway',
    data: makePaceData({ durationMs: W, totalItems: 100, nowFraction: 0.48, resolvedFraction: 0.38, runStatus: 'aborted' }),
  },
  {
    label: '4 weeks — active, behind (weekly ticks)',
    data: makePaceData({ durationMs: 4 * W, totalItems: 400, nowFraction: 0.2, resolvedFraction: 0.06, runStatus: 'active' }),
  },
  {
    label: '4 weeks — active, on pace',
    data: makePaceData({ durationMs: 4 * W, totalItems: 300, nowFraction: 0.5, resolvedFraction: 0.5, runStatus: 'active' }),
  },
  {
    label: '3 months — active, ahead (monthly ticks)',
    data: makePaceData({ durationMs: 90 * D, totalItems: 600, nowFraction: 0.4, resolvedFraction: 0.55, runStatus: 'active' }),
  },
]

// ── page ──────────────────────────────────────────────────────────────────────

export function PaceChartDemoPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">RunPaceCard — scenarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dev-only · mock data · {SCENARIOS.length} cards
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6">
          {SCENARIOS.map(({ label, data }) => (
            <div key={label} className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <RunPaceCard chartData={data} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
