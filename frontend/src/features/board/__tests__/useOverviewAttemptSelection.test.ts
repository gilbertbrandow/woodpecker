import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOverviewAttemptSelection } from '../useOverviewAttemptSelection'
import type { RunTrainingItemOverview, OverviewAttemptView } from '../../../lib/api'

function makeAttempt(id: number, runId: number, runTrainingItemId: number, status: 'solved' | 'failed' | 'in_progress'): OverviewAttemptView {
  return {
    id, runId, runIndex: 0, runTrainingItemId, tryNumber: 1,
    status, startedAt: '', completedAt: null, timeSpentMs: null,
    moves: [], attemptType: 'scored', isQualifying: false,
    countsTowardsTraining: true, countsTowardsProgress: true,
    countsTowardsAccuracy: true, countsTowardsAverageTime: true,
    board: null, pgnDisplay: null,
    impact: { runProgressDeltaPct: null, trainingProgressDeltaPct: null, accuracyDeltaPct: null, averageSolveTimeDeltaMs: null },
  }
}

function makeOverviewData(attempts: OverviewAttemptView[], selectedAttemptId: number | null = null): RunTrainingItemOverview {
  return {
    runTrainingItem: {
      id: 10, trainingItemId: 1, runId: 1, runIndex: 0, position: 0,
      status: 'solved', triesRemaining: 3, maxTriesPerItem: 3,
      qualifyingAttemptId: null, trainingId: null, scheduleName: null,
    },
    trainingItem: { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', solution: ['e2e4'], source: { sourceType: 'SCRAPED_POSITIONAL', internalId: 1, lichessUrl: 'https://lichess.org/training/1', difficulty: { value: 1, label: 'Easy', minRating: null, maxRating: null }, themes: [], opening: null } },
    selectedAttemptId,
    attempts,
    sameTrainingItemAcrossRuns: [],
    runPace: { chartData: null, isRunActive: true },
    stats: { runIndex: 0, accuracy: { valuePct: null, deltaPct: null, solvedCount: 0, resolvedCount: 0 }, averageSolveTime: { valueMs: null, deltaMs: null, timeCount: 0 } },
    progress: { runProgress: { label: '', value: 0, tooltipLabel: '', delta: null }, trainingProgress: null },
    actions: { runStatus: 'active', retake: { enabled: true }, analyze: { enabled: false, url: null }, nextTrainingItem: { enabled: true, disabledReason: null } },
    timer: { targetMinSolveTenths: null, targetMaxSolveTenths: null },
    runCompleteOverlay: null,
  } as RunTrainingItemOverview
}

describe('useOverviewAttemptSelection', () => {
  it('returns empty allAttempts when overviewData is null', () => {
    const { result } = renderHook(() =>
      useOverviewAttemptSelection({
        overviewData: null,
        runTrainingItemId: 1,
        requestedAttemptId: null,
        onUrlAttemptChange: vi.fn(),
      }),
    )
    expect(result.current.allAttempts).toHaveLength(0)
    expect(result.current.selectedAttemptId).toBeNull()
  })

  it('filters out in_progress attempts', () => {
    const overviewData = makeOverviewData([
      makeAttempt(1, 1, 10, 'solved'),
      makeAttempt(2, 1, 10, 'in_progress'),
      makeAttempt(3, 1, 10, 'failed'),
    ])
    const { result } = renderHook(() =>
      useOverviewAttemptSelection({
        overviewData,
        runTrainingItemId: 10,
        requestedAttemptId: null,
        onUrlAttemptChange: vi.fn(),
      }),
    )
    expect(result.current.allAttempts).toHaveLength(2)
    expect(result.current.allAttempts.map((a) => a.id)).toEqual([1, 3])
  })

  it('selects overviewData.selectedAttemptId when no requestedAttemptId', () => {
    const overviewData = makeOverviewData([makeAttempt(1, 1, 10, 'solved')], 1)
    const { result } = renderHook(() =>
      useOverviewAttemptSelection({
        overviewData,
        runTrainingItemId: 10,
        requestedAttemptId: null,
        onUrlAttemptChange: vi.fn(),
      }),
    )
    expect(result.current.selectedAttemptId).toBe(1)
  })

  it('uses requestedAttemptId when it exists in allAttempts', () => {
    const overviewData = makeOverviewData([
      makeAttempt(1, 1, 10, 'solved'),
      makeAttempt(2, 1, 10, 'failed'),
    ], 1)
    const { result } = renderHook(() =>
      useOverviewAttemptSelection({
        overviewData,
        runTrainingItemId: 10,
        requestedAttemptId: 2,
        onUrlAttemptChange: vi.fn(),
      }),
    )
    expect(result.current.selectedAttemptId).toBe(2)
  })

  it('falls back to selectedAttemptId when requestedAttemptId is not in allAttempts', () => {
    const overviewData = makeOverviewData([makeAttempt(1, 1, 10, 'solved')], 1)
    const { result } = renderHook(() =>
      useOverviewAttemptSelection({
        overviewData,
        runTrainingItemId: 10,
        requestedAttemptId: 999,
        onUrlAttemptChange: vi.fn(),
      }),
    )
    expect(result.current.selectedAttemptId).toBe(1)
  })

  it('calls onUrlAttemptChange when handleSelectAttempt is called', () => {
    const onUrlAttemptChange = vi.fn()
    const overviewData = makeOverviewData([
      makeAttempt(1, 1, 10, 'solved'),
      makeAttempt(2, 1, 10, 'failed'),
    ], 1)
    const { result } = renderHook(() =>
      useOverviewAttemptSelection({
        overviewData,
        runTrainingItemId: 10,
        requestedAttemptId: null,
        onUrlAttemptChange,
      }),
    )
    act(() => { result.current.handleSelectAttempt(2) })
    expect(result.current.selectedAttemptId).toBe(2)
    expect(onUrlAttemptChange).toHaveBeenCalledWith(2, false)
  })

  it('handleSelectAttempt is a no-op when the same attempt is already selected', () => {
    const onUrlAttemptChange = vi.fn()
    const overviewData = makeOverviewData([makeAttempt(1, 1, 10, 'solved')], 1)
    const { result } = renderHook(() =>
      useOverviewAttemptSelection({
        overviewData,
        runTrainingItemId: 10,
        requestedAttemptId: null,
        onUrlAttemptChange,
      }),
    )
    const initialCallCount = onUrlAttemptChange.mock.calls.length
    act(() => { result.current.handleSelectAttempt(1) })
    expect(onUrlAttemptChange.mock.calls.length).toBe(initialCallCount)
  })

  it('resets selectedAttemptId when runTrainingItemId changes', () => {
    const overviewData = makeOverviewData([makeAttempt(1, 1, 10, 'solved')], 1)
    let rtid = 10
    const { result, rerender } = renderHook(() =>
      useOverviewAttemptSelection({
        overviewData: rtid === 10 ? overviewData : null,
        runTrainingItemId: rtid,
        requestedAttemptId: null,
        onUrlAttemptChange: vi.fn(),
      }),
    )
    expect(result.current.selectedAttemptId).toBe(1)
    act(() => { rtid = 11 })
    rerender()
    expect(result.current.selectedAttemptId).toBeNull()
  })
})
