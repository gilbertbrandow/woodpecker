import {
  equalSplitAll,
  addSource,
  removeSource,
  addSubsetRef,
  removeSubsetRef,
  clearSubsetRefs,
  applySplit,
  updateSourceConfig,
  updateSubsetRefEntry,
} from '../sourceComposition'
import type { SourceEntry, SubsetRefEntry } from '../api'

// ── Helpers ──────────────────────────────────────────────────────────────────

function totalPct(v: { sources: SourceEntry[]; subsetRefs: SubsetRefEntry[] }): number {
  return (
    v.sources.reduce((s, e) => s + e.percentage, 0) +
    v.subsetRefs.reduce((s, r) => s + r.percentage, 0)
  )
}

const lichess = (pct: number): SourceEntry => ({
  source: 'LICHESS_TACTIC',
  percentage: pct,
  config: {},
})

const scraped = (pct: number): SourceEntry => ({
  source: 'SCRAPED_POSITIONAL',
  percentage: pct,
  config: {},
})

const decoy = (pct: number): SourceEntry => ({
  source: 'DECOY',
  percentage: pct,
  config: {},
})

const ref = (id: number, pct: number): SubsetRefEntry => ({ subsetId: id, percentage: pct })

// ── equalSplitAll ─────────────────────────────────────────────────────────────

describe('equalSplitAll', () => {
  it('returns empty array unchanged', () => {
    expect(equalSplitAll([])).toEqual([])
  })

  it('gives 100% to a single entry', () => {
    const result = equalSplitAll([lichess(0)])
    expect(result[0]!.percentage).toBe(100)
  })

  it('splits evenly across two entries', () => {
    const result = equalSplitAll([lichess(0), scraped(0)])
    expect(result[0]!.percentage).toBe(50)
    expect(result[1]!.percentage).toBe(50)
  })

  it('allocates remainder to the first entry for three entries', () => {
    const result = equalSplitAll([lichess(0), scraped(0), decoy(0)])
    expect(result[0]!.percentage).toBe(34) // 100 - 33 - 33
    expect(result[1]!.percentage).toBe(33)
    expect(result[2]!.percentage).toBe(33)
    expect(totalPct({ sources: result as SourceEntry[], subsetRefs: [] })).toBe(100)
  })

  it('always sums to 100 for four entries', () => {
    const entries = [lichess(0), scraped(0), decoy(0), ref(1, 0)]
    const result = equalSplitAll(entries)
    const sum = result.reduce((s, e) => s + e.percentage, 0)
    expect(sum).toBe(100)
  })

  it('preserves non-percentage fields', () => {
    const entry = lichess(0)
    const result = equalSplitAll([entry])
    expect(result[0]!.source).toBe('LICHESS_TACTIC')
  })
})

// ── addSource ─────────────────────────────────────────────────────────────────

describe('addSource', () => {
  it('adds a source and redistributes to 100', () => {
    const current = { sources: [lichess(100)], subsetRefs: [] }
    const result = addSource(current, 'SCRAPED_POSITIONAL', {})
    expect(totalPct(result)).toBe(100)
    expect(result.sources).toHaveLength(2)
  })

  it('respects ORDERED_SOURCES ordering (LICHESS before SCRAPED)', () => {
    const current = { sources: [scraped(100)], subsetRefs: [] }
    const result = addSource(current, 'LICHESS_TACTIC', {})
    expect(result.sources[0]!.source).toBe('LICHESS_TACTIC')
    expect(result.sources[1]!.source).toBe('SCRAPED_POSITIONAL')
  })

  it('redistributes subsetRefs into the 100% pool', () => {
    const current = { sources: [lichess(50)], subsetRefs: [ref(1, 50)] }
    const result = addSource(current, 'SCRAPED_POSITIONAL', {})
    expect(totalPct(result)).toBe(100)
    expect(result.sources).toHaveLength(2)
    expect(result.subsetRefs).toHaveLength(1)
  })

  it('does not mutate the current value', () => {
    const current = { sources: [lichess(100)], subsetRefs: [] }
    addSource(current, 'SCRAPED_POSITIONAL', {})
    expect(current.sources).toHaveLength(1)
  })
})

// ── removeSource ──────────────────────────────────────────────────────────────

describe('removeSource', () => {
  it('removes the source and redistributes to 100', () => {
    const current = { sources: [lichess(50), scraped(50)], subsetRefs: [] }
    const result = removeSource(current, 'SCRAPED_POSITIONAL')
    expect(totalPct(result)).toBe(100)
    expect(result.sources).toHaveLength(1)
    expect(result.sources[0]!.source).toBe('LICHESS_TACTIC')
  })

  it('redistributes remaining sources and subsetRefs to 100', () => {
    const current = { sources: [lichess(34), scraped(33)], subsetRefs: [ref(1, 33)] }
    const result = removeSource(current, 'SCRAPED_POSITIONAL')
    expect(totalPct(result)).toBe(100)
    expect(result.sources).toHaveLength(1)
    expect(result.subsetRefs).toHaveLength(1)
  })

  it('does not mutate the current value', () => {
    const current = { sources: [lichess(50), scraped(50)], subsetRefs: [] }
    removeSource(current, 'SCRAPED_POSITIONAL')
    expect(current.sources).toHaveLength(2)
  })
})

// ── addSubsetRef ──────────────────────────────────────────────────────────────

describe('addSubsetRef', () => {
  it('adds a ref and redistributes to 100', () => {
    const current = { sources: [lichess(100)], subsetRefs: [] }
    const result = addSubsetRef(current, 42)
    expect(totalPct(result)).toBe(100)
    expect(result.subsetRefs).toHaveLength(1)
    expect(result.subsetRefs[0]!.subsetId).toBe(42)
  })

  it('appends refs in insertion order', () => {
    const current = { sources: [lichess(50)], subsetRefs: [ref(1, 50)] }
    const result = addSubsetRef(current, 2)
    expect(result.subsetRefs[0]!.subsetId).toBe(1)
    expect(result.subsetRefs[1]!.subsetId).toBe(2)
    expect(totalPct(result)).toBe(100)
  })
})

// ── removeSubsetRef ───────────────────────────────────────────────────────────

describe('removeSubsetRef', () => {
  it('removes the ref and redistributes to 100', () => {
    const current = { sources: [lichess(50)], subsetRefs: [ref(1, 50)] }
    const result = removeSubsetRef(current, 1)
    expect(totalPct(result)).toBe(100)
    expect(result.subsetRefs).toHaveLength(0)
  })

  it('removes only the targeted ref when multiple exist', () => {
    const current = { sources: [lichess(34)], subsetRefs: [ref(1, 33), ref(2, 33)] }
    const result = removeSubsetRef(current, 1)
    expect(result.subsetRefs).toHaveLength(1)
    expect(result.subsetRefs[0]!.subsetId).toBe(2)
    expect(totalPct(result)).toBe(100)
  })
})

// ── clearSubsetRefs ───────────────────────────────────────────────────────────

describe('clearSubsetRefs', () => {
  it('removes all refs and gives sources 100%', () => {
    const current = { sources: [lichess(50)], subsetRefs: [ref(1, 50)] }
    const result = clearSubsetRefs(current)
    expect(result.subsetRefs).toHaveLength(0)
    expect(totalPct(result)).toBe(100)
    expect(result.sources[0]!.percentage).toBe(100)
  })
})

// ── applySplit ────────────────────────────────────────────────────────────────

describe('applySplit', () => {
  it('applies new percentages from slider segments', () => {
    const current = { sources: [lichess(50), scraped(50)], subsetRefs: [] }
    const result = applySplit(current, [
      { key: 'LICHESS_TACTIC', percentage: 70 },
      { key: 'SCRAPED_POSITIONAL', percentage: 30 },
    ])
    expect(result.sources[0]!.percentage).toBe(70)
    expect(result.sources[1]!.percentage).toBe(30)
  })

  it('applies percentages to subsetRefs via ref: key', () => {
    const current = { sources: [lichess(50)], subsetRefs: [ref(7, 50)] }
    const result = applySplit(current, [
      { key: 'LICHESS_TACTIC', percentage: 60 },
      { key: 'ref:7', percentage: 40 },
    ])
    expect(result.sources[0]!.percentage).toBe(60)
    expect(result.subsetRefs[0]!.percentage).toBe(40)
  })

  it('keeps existing percentage when key is absent from segments', () => {
    const current = { sources: [lichess(50), scraped(50)], subsetRefs: [] }
    const result = applySplit(current, [{ key: 'LICHESS_TACTIC', percentage: 70 }])
    expect(result.sources[1]!.percentage).toBe(50)
  })
})

// ── updateSourceConfig ────────────────────────────────────────────────────────

describe('updateSourceConfig', () => {
  it('replaces config at the given index', () => {
    const current = { sources: [lichess(100)], subsetRefs: [] }
    const newConfig = { rating: { min: 1200, max: 2000 } }
    const result = updateSourceConfig(current, 0, newConfig)
    expect(result.sources[0]!.config).toEqual(newConfig)
  })

  it('does not affect other sources', () => {
    const current = { sources: [lichess(50), scraped(50)], subsetRefs: [] }
    const result = updateSourceConfig(current, 0, { rating: { min: 1000 } })
    expect(result.sources[1]!.source).toBe('SCRAPED_POSITIONAL')
    expect(result.sources[1]!.percentage).toBe(50)
  })
})

// ── updateSubsetRefEntry ──────────────────────────────────────────────────────

describe('updateSubsetRefEntry', () => {
  it('replaces the matching ref', () => {
    const current = { sources: [lichess(50)], subsetRefs: [ref(1, 50)] }
    const updated: SubsetRefEntry = { subsetId: 1, percentage: 50, excludeSources: ['DECOY'] }
    const result = updateSubsetRefEntry(current, 1, updated)
    expect(result.subsetRefs[0]!.excludeSources).toEqual(['DECOY'])
  })

  it('does not affect other refs', () => {
    const current = {
      sources: [lichess(34)],
      subsetRefs: [ref(1, 33), ref(2, 33)],
    }
    const updated: SubsetRefEntry = { subsetId: 1, percentage: 33, excludeSources: ['DECOY'] }
    const result = updateSubsetRefEntry(current, 1, updated)
    expect(result.subsetRefs[1]!.excludeSources).toBeUndefined()
  })
})
