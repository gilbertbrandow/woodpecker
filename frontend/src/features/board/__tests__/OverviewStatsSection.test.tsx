import { render, screen } from '@testing-library/react'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { OverviewStatsSection } from '../OverviewStatsSection'

function renderStats(
  accuracyOverrides: Partial<{ valuePct: number | null; deltaPct: number | null; solvedCount: number; resolvedCount: number }> = {},
  avgTimeOverrides: Partial<{ valueMs: number | null; deltaMs: number | null; timeCount: number }> = {},
) {
  const accuracy = {
    valuePct: 73.5,
    deltaPct: null,
    solvedCount: 5,
    resolvedCount: 7,
    ...accuracyOverrides,
  }
  const averageSolveTime = {
    valueMs: 45000,
    deltaMs: null,
    timeCount: 5,
    ...avgTimeOverrides,
  }
  return render(
    <TooltipProvider>
      <OverviewStatsSection runIndex={0} accuracy={accuracy} averageSolveTime={averageSolveTime} />
    </TooltipProvider>,
  )
}

describe('OverviewStatsSection — delta badge visibility', () => {
  it('shows no accuracy delta badge when deltaPct is null (e.g. failed attempt selected)', () => {
    renderStats({ deltaPct: null })
    // DeltaBadge returns null for delta=null, so no ▲/▼ arrow should appear
    expect(screen.queryByText(/[▲▼]/)).not.toBeInTheDocument()
  })

  it('shows accuracy delta badge when deltaPct is a positive number', () => {
    renderStats({ deltaPct: 2.5 })
    expect(screen.getByText(/\+2\.5/)).toBeInTheDocument()
    expect(screen.getByText(/▲/)).toBeInTheDocument()
  })

  it('shows no solve-time delta badge when deltaMs is null', () => {
    renderStats({}, { deltaMs: null })
    expect(screen.queryByText(/[▲▼]/)).not.toBeInTheDocument()
  })

  it('shows solve-time delta badge when deltaMs is non-null (faster = green ▼)', () => {
    // Negative deltaMs means faster → goodWhenPositive=false so it renders green with ▼
    renderStats({}, { deltaMs: -30000 })
    expect(screen.getByText(/▼/)).toBeInTheDocument()
  })
})
