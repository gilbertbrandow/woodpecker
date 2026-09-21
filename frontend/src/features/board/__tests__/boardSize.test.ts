import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  BOARD_SCALE_STORAGE_KEY,
  MIN_BOARD_SCALE,
  MIN_BOARD_SIZE,
  clampBoardScale,
  computeBoardSize,
  computeMaxBoardSize,
  readBoardScale,
  writeBoardScale,
} from '../boardPage.helpers'

function setViewport(width: number, height: number): void {
  vi.stubGlobal('innerWidth', width)
  vi.stubGlobal('innerHeight', height)
}

describe('board sizing', () => {
  beforeEach(() => {
    localStorage.clear()
    setViewport(1800, 1300)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to the largest board that fits when no scale is stored', () => {
    expect(readBoardScale()).toBe(1)
    expect(computeBoardSize()).toBe(computeMaxBoardSize())
  })

  it('shrinks the desktop board by the stored scale', () => {
    writeBoardScale(0.5)
    expect(readBoardScale()).toBe(0.5)
    expect(computeBoardSize()).toBe(Math.round(computeMaxBoardSize() * 0.5))
  })

  it('clamps scales to the allowed range', () => {
    expect(clampBoardScale(2)).toBe(1)
    expect(clampBoardScale(0.01)).toBe(MIN_BOARD_SCALE)
    expect(clampBoardScale(Number.NaN)).toBe(1)
    expect(clampBoardScale(Number.POSITIVE_INFINITY)).toBe(1)
  })

  it('ignores a corrupt stored value', () => {
    localStorage.setItem(BOARD_SCALE_STORAGE_KEY, '"huge"')
    expect(readBoardScale()).toBe(1)
  })

  it('never goes below the minimum board size', () => {
    setViewport(1100, 500)
    expect(computeBoardSize(MIN_BOARD_SCALE)).toBe(MIN_BOARD_SIZE)
  })

  it('ignores the scale on the mobile layout', () => {
    setViewport(800, 1000)
    expect(computeBoardSize(0.5)).toBe(computeMaxBoardSize())
  })
})
