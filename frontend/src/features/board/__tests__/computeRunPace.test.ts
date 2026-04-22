import { describe, it, expect } from 'vitest'
import { computeRunPace } from '../boardPage.helpers'

const START = '2026-01-01T00:00:00.000Z'
const START_MS = Date.parse(START)
const TARGET_HOURS = 100
const TOTAL_PUZZLES = 200

describe('computeRunPace', () => {
  it('exactly on pace at 50% elapsed with 50% resolved', () => {
    const nowMs = START_MS + TARGET_HOURS * 3_600_000 * 0.5
    const resolvedCount = Math.round(TOTAL_PUZZLES * 0.5)
    const result = computeRunPace({ startedAt: START, targetHours: TARGET_HOURS, totalPuzzles: TOTAL_PUZZLES, resolvedCount, nowMs })
    expect(result.status).toBe('on_pace')
    expect(result.expectedResolved).toBe(resolvedCount)
  })

  it('one off stays on_pace (dead zone)', () => {
    const nowMs = START_MS + TARGET_HOURS * 3_600_000 * 0.5
    const resolvedCount = Math.round(TOTAL_PUZZLES * 0.5) + 1
    const result = computeRunPace({ startedAt: START, targetHours: TARGET_HOURS, totalPuzzles: TOTAL_PUZZLES, resolvedCount, nowMs })
    expect(result.status).toBe('on_pace')
  })

  it('ahead when resolved is 60% at 50% elapsed', () => {
    const nowMs = START_MS + TARGET_HOURS * 3_600_000 * 0.5
    const resolvedCount = Math.round(TOTAL_PUZZLES * 0.6)
    const expectedResolved = Math.round(TOTAL_PUZZLES * 0.5)
    const result = computeRunPace({ startedAt: START, targetHours: TARGET_HOURS, totalPuzzles: TOTAL_PUZZLES, resolvedCount, nowMs })
    expect(result.status).toBe('ahead')
    expect(result.puzzleDelta).toBe(resolvedCount - expectedResolved)
  })

  it('behind when resolved is 40% at 50% elapsed', () => {
    const nowMs = START_MS + TARGET_HOURS * 3_600_000 * 0.5
    const resolvedCount = Math.round(TOTAL_PUZZLES * 0.4)
    const expectedResolved = Math.round(TOTAL_PUZZLES * 0.5)
    const result = computeRunPace({ startedAt: START, targetHours: TARGET_HOURS, totalPuzzles: TOTAL_PUZZLES, resolvedCount, nowMs })
    expect(result.status).toBe('behind')
    expect(result.puzzleDelta).toBe(expectedResolved - resolvedCount)
  })

  it('not yet started: expectedResolved is 0 and status is on_pace', () => {
    const nowMs = START_MS
    const result = computeRunPace({ startedAt: START, targetHours: TARGET_HOURS, totalPuzzles: TOTAL_PUZZLES, resolvedCount: 0, nowMs })
    expect(result.expectedResolved).toBe(0)
    expect(result.status).toBe('on_pace')
  })

  it('fully elapsed: expectedResolved equals totalPuzzles', () => {
    const nowMs = START_MS + TARGET_HOURS * 3_600_000
    const result = computeRunPace({ startedAt: START, targetHours: TARGET_HOURS, totalPuzzles: TOTAL_PUZZLES, resolvedCount: TOTAL_PUZZLES, nowMs })
    expect(result.expectedResolved).toBe(TOTAL_PUZZLES)
  })

  it('overdue: timeRemainingHours is negative', () => {
    const nowMs = START_MS + TARGET_HOURS * 3_600_000 * 1.2
    const result = computeRunPace({ startedAt: START, targetHours: TARGET_HOURS, totalPuzzles: TOTAL_PUZZLES, resolvedCount: TOTAL_PUZZLES, nowMs })
    expect(result.timeRemainingHours).toBeLessThan(0)
  })

  it('deadlineIso equals startedAt + targetHours', () => {
    const nowMs = START_MS + TARGET_HOURS * 3_600_000 * 0.5
    const result = computeRunPace({ startedAt: START, targetHours: TARGET_HOURS, totalPuzzles: TOTAL_PUZZLES, resolvedCount: 0, nowMs })
    const expectedDeadline = new Date(START_MS + TARGET_HOURS * 3_600_000).toISOString()
    expect(result.deadlineIso).toBe(expectedDeadline)
  })
})
