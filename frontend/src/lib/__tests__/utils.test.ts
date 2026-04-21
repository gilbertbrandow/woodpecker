import { formatNumber, formatSolveTime } from '../utils'

describe('formatNumber', () => {
  it('formats integers below 1000 without separator', () => {
    expect(formatNumber(999)).toBe('999')
  })

  it('inserts a thousands separator between 1 and 234', () => {
    expect(formatNumber(1234)).toMatch(/^1.234$/)
  })

  it('handles large numbers with two separators', () => {
    expect(formatNumber(1234567)).toMatch(/^1.234.567$/)
  })

  it('formats decimals with a dot as decimal separator', () => {
    expect(formatNumber(1234.56)).toMatch(/^1.234\.56$/)
  })

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0')
  })
})

describe('formatSolveTime', () => {
  it('formats seconds under a minute', () => {
    expect(formatSolveTime(45)).toBe('0:45')
  })

  it('pads seconds with a leading zero', () => {
    expect(formatSolveTime(65)).toBe('1:05')
  })

  it('formats exact minutes', () => {
    expect(formatSolveTime(120)).toBe('2:00')
  })
})
