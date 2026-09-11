import { describe, it, expect } from 'vitest'
import { computePgnLayout } from '../TrainingItemMetaCard'
import type { PgnLayout } from '../TrainingItemMetaCard'

type M = Parameters<typeof computePgnLayout>[0]['mainline'][number]

function m(moveNumber: number, isWhite: boolean, san: string, status: M['moveStatus'] = null): M {
  return { san, moveNumber, isWhite, moveStatus: status }
}

describe('computePgnLayout — rows', () => {
  it('returns empty rows for an empty mainline', () => {
    const layout = computePgnLayout({ mainline: [], subvariations: null })
    expect(layout.rows).toHaveLength(0)
  })

  it('single White move creates one row with white filled, black null', () => {
    const layout = computePgnLayout({ mainline: [m(1, true, 'e4')], subvariations: null })
    expect(layout.rows).toHaveLength(1)
    expect(layout.rows[0].white?.move.san).toBe('e4')
    expect(layout.rows[0].black).toBeNull()
  })

  it('White then Black at same move number go in one row', () => {
    const layout = computePgnLayout({ mainline: [m(1, true, 'e4'), m(1, false, 'd5')], subvariations: null })
    expect(layout.rows).toHaveLength(1)
    expect(layout.rows[0].white?.move.san).toBe('e4')
    expect(layout.rows[0].black?.move.san).toBe('d5')
  })

  it('Black-first move (player is White) creates a row with white null', () => {
    // Opponent moves Black first (move 5), then player plays White (move 6)
    const layout = computePgnLayout({ mainline: [m(5, false, 'd5'), m(6, true, 'Nc3')], subvariations: null })
    expect(layout.rows).toHaveLength(2)
    expect(layout.rows[0].white).toBeNull()
    expect(layout.rows[0].black?.move.san).toBe('d5')
    expect(layout.rows[1].white?.move.san).toBe('Nc3')
    expect(layout.rows[1].black).toBeNull()
  })

  it('assigns correct idx values matching mainline position', () => {
    const layout = computePgnLayout({
      mainline: [m(1, true, 'e4'), m(1, false, 'd5'), m(2, true, 'Nc3')],
      subvariations: null,
    })
    expect(layout.rows[0].white?.idx).toBe(0)
    expect(layout.rows[0].black?.idx).toBe(1)
    expect(layout.rows[1].white?.idx).toBe(2)
  })
})

describe('computePgnLayout — subvariation placement', () => {
  it('returns empty maps when there are no subvariations', () => {
    const layout = computePgnLayout({ mainline: [m(1, true, 'e4'), m(1, false, 'd5')], subvariations: null })
    expect(layout.svAfterWhite.size).toBe(0)
    expect(layout.svAfterBlack.size).toBe(0)
  })

  it('returns empty maps when mainline has only one move (no branching possible)', () => {
    const layout = computePgnLayout({
      mainline: [m(1, true, 'e4')],
      subvariations: [[m(1, true, 'e3', 'wrong')]],
    })
    expect(layout.svAfterWhite.size).toBe(0)
    expect(layout.svAfterBlack.size).toBe(0)
  })

  it('Black wrong move branches at Black cell → svAfterBlack', () => {
    // Standard 2-ply: opponent (White) e4, player (Black) d5. Wrong move: d6.
    const layout: PgnLayout = computePgnLayout({
      mainline: [m(1, true, 'e4', 'opponent'), m(1, false, 'd5', 'correct')],
      subvariations: [[m(1, false, 'd6', 'wrong')]],
    })
    expect(layout.svAfterBlack.size).toBe(1)
    expect(layout.svAfterWhite.size).toBe(0)
    // The subvariation is attached to row 0 (the only row)
    const entries = layout.svAfterBlack.get(0)
    expect(entries).toHaveLength(1)
    expect(entries![0].moves[0].san).toBe('d6')
    expect(entries![0].si).toBe(0)
  })

  it('White wrong move (player is White) branches at White cell → svAfterWhite', () => {
    // Opponent (Black) plays at move 5, player (White) should play at move 6.
    // Mainline: 5...d5 (opp), 6. Nc3 (correct). Wrong: 6. c3.
    const layout: PgnLayout = computePgnLayout({
      mainline: [m(5, false, 'd5', 'opponent'), m(6, true, 'Nc3', 'correct')],
      subvariations: [[m(6, true, 'c3', 'wrong')]],
    })
    expect(layout.svAfterWhite.size).toBe(1)
    expect(layout.svAfterBlack.size).toBe(0)
    const entries = layout.svAfterWhite.get(1)  // row 1 holds the White move at move 6
    expect(entries).toHaveLength(1)
    expect(entries![0].moves[0].san).toBe('c3')
  })

  it('multiple wrong moves at the same position are grouped in the same entry list', () => {
    const layout = computePgnLayout({
      mainline: [m(1, true, 'e4', 'opponent'), m(1, false, 'd5', 'correct')],
      subvariations: [
        [m(1, false, 'd6', 'wrong')],
        [m(1, false, 'c5', 'wrong')],
      ],
    })
    const entries = layout.svAfterBlack.get(0)
    expect(entries).toHaveLength(2)
    expect(entries![0].si).toBe(0)
    expect(entries![1].si).toBe(1)
  })

  it('wrong move at a later position is placed at the correct row', () => {
    // 4-ply: opp e4, player d5, opp exd5, player Qd7 (wrong; correct is Qxd5)
    const layout = computePgnLayout({
      mainline: [
        m(1, true, 'e4', 'opponent'),
        m(1, false, 'd5', 'correct'),
        m(2, true, 'exd5', 'opponent'),
        m(2, false, 'Qxd5', 'correct'),
      ],
      subvariations: [[m(2, false, 'Qd7', 'wrong')]],
    })
    // Qd7 branches at move 2, Black cell → row 1 (which holds move 2)
    const entries = layout.svAfterBlack.get(1)
    expect(entries).toHaveLength(1)
    expect(entries![0].moves[0].san).toBe('Qd7')
  })
})
