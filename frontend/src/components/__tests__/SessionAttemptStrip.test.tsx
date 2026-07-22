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

  it('renders all items regardless of count (jsdom: offsetWidth=0 disables overflow logic)', () => {
    const items = Array.from({ length: 25 }, (_, i) =>
      makeItem({ attemptId: i + 1, puzzlePosition: i + 1, status: 'solved', finishedAt: Date.now() }),
    )
    renderWithProvider(<SessionAttemptStrip items={items} runId="1" />)
    expect(screen.getAllByRole('link')).toHaveLength(25)
  })

  describe('overflow badge (offsetWidth mocked)', () => {
    function mockOffsetWidth(px: number) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => px })
    }

    afterEach(() => {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 0 })
    })

    it('shows no badge when items exactly fill the container', () => {
      // 100px → maxDots=5; 5 items fit exactly
      mockOffsetWidth(100)
      const items = Array.from({ length: 5 }, (_, i) =>
        makeItem({ attemptId: i + 1, puzzlePosition: i + 1, status: 'solved', finishedAt: Date.now() }),
      )
      renderWithProvider(<SessionAttemptStrip items={items} runId="1" />)
      expect(screen.getAllByRole('link')).toHaveLength(5)
      expect(screen.queryByRole('img', { name: /earlier attempt/ })).toBeNull()
    })

    it('shows badge with correct count on first overflow', () => {
      // 100px → maxDots=5; 6 items → overflowing=true, visibleDotCount=4, hiddenCount=2
      mockOffsetWidth(100)
      const items = Array.from({ length: 6 }, (_, i) =>
        makeItem({ attemptId: i + 1, puzzlePosition: i + 1, status: 'solved', finishedAt: Date.now() }),
      )
      renderWithProvider(<SessionAttemptStrip items={items} runId="1" />)
      expect(screen.getAllByRole('link')).toHaveLength(4)
      expect(screen.getByRole('img', { name: '2 earlier attempts not shown' })).toBeInTheDocument()
    })

    it('badge count grows correctly as more items are added', () => {
      // 100px → maxDots=5; 10 items → visibleDotCount=4, hiddenCount=6
      mockOffsetWidth(100)
      const items = Array.from({ length: 10 }, (_, i) =>
        makeItem({ attemptId: i + 1, puzzlePosition: i + 1, status: 'solved', finishedAt: Date.now() }),
      )
      renderWithProvider(<SessionAttemptStrip items={items} runId="1" />)
      expect(screen.getAllByRole('link')).toHaveLength(4)
      expect(screen.getByRole('img', { name: '6 earlier attempts not shown' })).toBeInTheDocument()
    })

    it('badge text caps at 99+ for very large hidden counts', () => {
      // 20px → maxDots=1; 200 items → visibleDotCount=0, hiddenCount=200
      mockOffsetWidth(20)
      const items = Array.from({ length: 200 }, (_, i) =>
        makeItem({ attemptId: i + 1, puzzlePosition: i + 1, status: 'solved', finishedAt: Date.now() }),
      )
      renderWithProvider(<SessionAttemptStrip items={items} runId="1" />)
      const badge = screen.getByRole('img', { name: '200 earlier attempts not shown' })
      expect(badge).toBeInTheDocument()
      expect(badge.textContent).toBe('99+')
    })

    it('newest items are kept visible; oldest are hidden behind the badge', () => {
      // 100px → maxDots=5; 7 items → visibleDotCount=4, newest 4 shown as dots
      mockOffsetWidth(100)
      const items = Array.from({ length: 7 }, (_, i) =>
        makeItem({ attemptId: i + 1, puzzlePosition: i + 1, status: 'solved', finishedAt: Date.now() }),
      )
      renderWithProvider(<SessionAttemptStrip items={items} runId="1" />)
      expect(screen.getByRole('link', { name: 'Attempt for puzzle 4: Solved' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Attempt for puzzle 7: Solved' })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Attempt for puzzle 1: Solved' })).toBeNull()
      expect(screen.queryByRole('link', { name: 'Attempt for puzzle 3: Solved' })).toBeNull()
    })
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
