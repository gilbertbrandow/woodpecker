import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { SessionAttemptStrip } from '../SessionAttemptStrip'
import type { SessionAttemptHistoryItem } from '../../context/solveSession'

function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

function makeItem(overrides: Partial<SessionAttemptHistoryItem>): SessionAttemptHistoryItem {
  return {
    attemptId: 1,
    runPuzzleId: 10,
    puzzlePosition: 1,
    status: 'ongoing',
    startedAt: Date.now(),
    ...overrides,
  }
}

describe('SessionAttemptStrip', () => {
  it('renders nothing when items is empty', () => {
    const { container } = render(<SessionAttemptStrip items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders one dot per item', () => {
    const items = [
      makeItem({ attemptId: 1, puzzlePosition: 1, status: 'solved', finishedAt: Date.now() }),
      makeItem({ attemptId: 2, puzzlePosition: 2, status: 'failed', finishedAt: Date.now() }),
      makeItem({ attemptId: 3, puzzlePosition: 3, status: 'ongoing' }),
    ]
    renderWithProvider(<SessionAttemptStrip items={items} />)
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('aria-label reflects puzzle position and status', () => {
    const items = [
      makeItem({ attemptId: 1, puzzlePosition: 5, status: 'solved', finishedAt: Date.now() }),
    ]
    renderWithProvider(<SessionAttemptStrip items={items} />)
    expect(screen.getByRole('button', { name: 'Attempt for puzzle 5: Solved' })).toBeInTheDocument()
  })

  it('caps visible items at maxVisible', () => {
    const items = Array.from({ length: 25 }, (_, i) =>
      makeItem({ attemptId: i + 1, puzzlePosition: i + 1, status: 'solved', finishedAt: Date.now() }),
    )
    renderWithProvider(<SessionAttemptStrip items={items} maxVisible={10} />)
    expect(screen.getAllByRole('button')).toHaveLength(10)
  })
})
