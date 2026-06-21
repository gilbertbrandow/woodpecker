export type CalendarTick = { timeMs: number; shortLabel: string }

function formatCalendarLabel(ms: number, spanMs: number): string {
  const d = new Date(ms)
  const spansYears = new Date(ms - spanMs).getFullYear() !== new Date(ms).getFullYear()
  if (spansYears) {
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function buildCalendarTicks(startMs: number, endMs: number, n = 7): CalendarTick[] {
  const spanMs = endMs - startMs
  return Array.from({ length: n }, (_, i) => {
    const t = Math.round(startMs + (i * spanMs) / (n - 1))
    return { timeMs: t, shortLabel: formatCalendarLabel(t, spanMs) }
  })
}
