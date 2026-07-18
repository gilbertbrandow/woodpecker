import * as React from 'react'
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { SessionAttemptStrip } from '../SessionAttemptStrip'
import type { SessionAttemptHistoryItem } from '../../context/solveSession'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, className, 'aria-label': ariaLabel }: { children?: React.ReactNode; className?: string; 'aria-label'?: string }) => (
      <a href="#" className={className} aria-label={ariaLabel}>{children}</a>
    ),
  }
})

function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

function makeItem(overrides: Partial<SessionAttemptHistoryItem>): SessionAttemptHistoryItem {
  return {
    attemptId: 1,
    runTrainingItemId: 10,
    puzzlePosition: 1,
    status: 'ongoing',
    startedAt: Date.now(),
    ...overrides,
  }
}

describe('SessionAttemptStrip', () => {
  it('renders nothing when items is empty', () => {
    const { container } = render(<SessionAttemptStrip items={[]} runId="1" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders solved/failed as links and ongoing as non-interactive', () => {
    const items = [
      makeItem({ attemptId: 1, puzzlePosition: 1, status: 'solved', finishedAt: Date.now() }),
      makeItem({ attemptId: 2, puzzlePosition: 2, status: 'failed', finishedAt: Date.now() }),
      makeItem({ attemptId: 3, puzzlePosition: 3, status: 'ongoing' }),
    ]
    renderWithProvider(<SessionAttemptStrip items={items} runId="1" />)
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('aria-label reflects puzzle position and status', () => {
    const items = [
      makeItem({ attemptId: 1, puzzlePosition: 5, status: 'solved', finishedAt: Date.now() }),
    ]
    renderWithProvider(<SessionAttemptStrip items={items} runId="1" />)
    expect(screen.getByRole('link', { name: 'Attempt for puzzle 5: Solved' })).toBeInTheDocument()
  })

  it('renders all items regardless of count', () => {
    const items = Array.from({ length: 25 }, (_, i) =>
      makeItem({ attemptId: i + 1, puzzlePosition: i + 1, status: 'solved', finishedAt: Date.now() }),
    )
    renderWithProvider(<SessionAttemptStrip items={items} runId="1" />)
    expect(screen.getAllByRole('link')).toHaveLength(25)
  })

  it('renders dots for attempts across multiple runTrainingItemIds without filtering', () => {
    // Regression guard: the strip must render ALL items it receives regardless of runTrainingItemId.
    // If someone adds a per-puzzle filter before passing items, this test fails.
    const items = [
      makeItem({ attemptId: 1, runTrainingItemId: 10, puzzlePosition: 1, status: 'solved', finishedAt: Date.now() }),
      makeItem({ attemptId: 2, runTrainingItemId: 11, puzzlePosition: 2, status: 'failed', finishedAt: Date.now() }),
      makeItem({ attemptId: 3, runTrainingItemId: 12, puzzlePosition: 3, status: 'ongoing' }),
    ]
    renderWithProvider(<SessionAttemptStrip items={items} runId="1" />)
    // solved + failed are interactive links; ongoing is a non-interactive span — 3 dots total
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getAllByRole('img', { hidden: true })).toHaveLength(1)
    // All three dots carry an aria-label regardless of element type
    expect(screen.getAllByLabelText(/Attempt for puzzle/)).toHaveLength(3)
  })
})
