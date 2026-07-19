import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getStored, setStored, removeStored } from '../storage'

function makeLocalStorageMock() {
  const store = new Map<string, string>()
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value) }),
    removeItem: vi.fn((key: string) => { store.delete(key) }),
    clear: vi.fn(() => store.clear()),
  }
}

let mock: ReturnType<typeof makeLocalStorageMock>

beforeEach(() => {
  mock = makeLocalStorageMock()
  vi.stubGlobal('localStorage', mock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getStored', () => {
  it('returns null when key is absent', () => {
    expect(getStored('missing')).toBeNull()
  })

  it('parses a stored JSON object', () => {
    mock.setItem('k', JSON.stringify({ a: 1 }))
    expect(getStored<{ a: number }>('k')).toEqual({ a: 1 })
  })

  it('parses a stored JSON array', () => {
    mock.setItem('k', JSON.stringify([1, 2, 3]))
    expect(getStored<number[]>('k')).toEqual([1, 2, 3])
  })

  it('returns null for corrupted (non-JSON) data without throwing', () => {
    mock.setItem('k', 'not-json{{{')
    expect(getStored('k')).toBeNull()
  })
})

describe('setStored', () => {
  it('writes a JSON-serialised value that getStored can round-trip', () => {
    setStored('k', { x: 42, y: ['a', 'b'] })
    expect(getStored<{ x: number; y: string[] }>('k')).toEqual({ x: 42, y: ['a', 'b'] })
  })

  it('overwrites an existing key', () => {
    setStored('k', 'first')
    setStored('k', 'second')
    expect(getStored<string>('k')).toBe('second')
  })

  it('does not throw when localStorage.setItem throws (e.g. quota exceeded)', () => {
    mock.setItem.mockImplementation(() => { throw new Error('QuotaExceededError') })
    expect(() => setStored('k', 'value')).not.toThrow()
  })
})

describe('removeStored', () => {
  it('deletes an existing key so getStored returns null', () => {
    setStored('k', 'value')
    removeStored('k')
    expect(getStored('k')).toBeNull()
  })

  it('does not throw when the key does not exist', () => {
    expect(() => removeStored('never-set')).not.toThrow()
  })

  it('does not throw when localStorage.removeItem throws', () => {
    mock.removeItem.mockImplementation(() => { throw new Error('SecurityError') })
    expect(() => removeStored('k')).not.toThrow()
  })
})
