import { describe, it, expect, beforeAll } from 'vitest'
import { Chess } from 'chess.js'
import { buildPgnDisplay, computeFinalFen, resolveOverviewBoardPosition, resultsInCheckmate } from '../boardPage.helpers'

describe('resultsInCheckmate', () => {
  it('returns true when the move results in checkmate', () => {
    // White queen g6, white king h6, black king g8 — Qg7# is checkmate
    const chess = new Chess('6k1/8/6QK/8/8/8/8/8 w - - 0 1')
    expect(resultsInCheckmate(chess, 'g6', 'g7')).toBe(true)
  })

  it('returns false for a non-checkmating move', () => {
    const chess = new Chess('6k1/8/6QK/8/8/8/8/8 w - - 0 1')
    expect(resultsInCheckmate(chess, 'g6', 'f6')).toBe(false)
  })

  it('returns false for an illegal move without throwing', () => {
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    expect(resultsInCheckmate(chess, 'a1', 'h8')).toBe(false)
  })
})

describe('buildPgnDisplay', () => {
  // 4-ply puzzle on standard starting position:
  //   opponent (white): e2e4
  //   player  (black): d7d5
  //   opponent (white): e4xd5
  //   player  (black): Qxd5
  const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  const SOLUTION: (string | string[])[] = ['e2e4', 'd7d5', 'e4d5', 'd8d5']
  const FIRST_PLY = 'e2e4'
  const PLAYER_MOVE_1 = 'd7d5'
  const PLAYER_MOVE_2 = 'd8d5'
  const WRONG_MOVE = 'd7d6'
  const CORRECT_RETRY_MOVE = 'd7d5'

  beforeAll(() => {
    const chess = new Chess(FEN)
    const e4 = chess.move({ from: 'e2', to: 'e4' })
    const d5 = chess.move({ from: 'd7', to: 'd5' })
    const exd5 = chess.move({ from: 'e4', to: 'd5' })
    const qxd5 = chess.move({ from: 'd8', to: 'd5' })
    expect(e4).not.toBeNull()
    expect(d5).not.toBeNull()
    expect(exd5).not.toBeNull()
    expect(qxd5).not.toBeNull()
  })

  it('in_progress with no moves shows empty mainline', () => {
    const result = buildPgnDisplay(FEN, [], SOLUTION, 'in_progress')
    expect(result.mainline).toHaveLength(0)
    expect(result.variation).toBeNull()
  })

  it('in_progress with one ply applied shows that move with null status', () => {
    const result = buildPgnDisplay(FEN, [FIRST_PLY], SOLUTION, 'in_progress')
    expect(result.mainline).toHaveLength(1)
    expect(result.mainline[0].moveStatus).toBeNull()
    expect(result.mainline[0].uci).toBe(FIRST_PLY)
    expect(result.variation).toBeNull()
  })

  it('solved shows opponent first then player correct moves with no variation', () => {
    const result = buildPgnDisplay(FEN, [PLAYER_MOVE_1, PLAYER_MOVE_2], SOLUTION, 'solved')
    expect(result.mainline.length).toBeGreaterThanOrEqual(2)
    expect(result.mainline[0].moveStatus).toBe('opponent')
    expect(result.mainline[0].uci).toBe('e2e4')
    expect(result.mainline[1].moveStatus).toBe('correct')
    expect(result.mainline[1].uci).toBe(PLAYER_MOVE_1)
    expect(result.variation).toBeNull()
  })

  it('failed with autoVariation=false shows wrong move in mainline and no variation', () => {
    const result = buildPgnDisplay(FEN, [WRONG_MOVE], SOLUTION, 'failed', [], false)
    expect(result.mainline.some((m) => m.moveStatus === 'wrong')).toBe(true)
    expect(result.variation).toBeNull()
  })

  it('failed with autoVariation=true immediately shows the solution as variation', () => {
    const result = buildPgnDisplay(FEN, [WRONG_MOVE], SOLUTION, 'failed', [], true)
    expect(result.variation).not.toBeNull()
    expect(result.variation!.length).toBeGreaterThan(0)
  })

  it('failed with retry plies shows them in variation regardless of autoVariation', () => {
    const result = buildPgnDisplay(FEN, [WRONG_MOVE], SOLUTION, 'failed', [CORRECT_RETRY_MOVE], false)
    expect(result.variation).not.toBeNull()
    expect(result.variation![0].uci).toBe(CORRECT_RETRY_MOVE)
  })
})

// Reuse the same 4-ply position from the buildPgnDisplay suite above.
const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const SOLUTION_MOVES: (string | string[])[] = ['e2e4', 'd7d5', 'e4d5', 'd8d5']

describe('computeFinalFen', () => {
  it('returns the initial FEN unchanged when solution is empty', () => {
    expect(computeFinalFen(INITIAL_FEN, [])).toBe(INITIAL_FEN)
  })

  it('returns the correct terminal FEN after applying all solution moves', () => {
    const terminal = computeFinalFen(INITIAL_FEN, SOLUTION_MOVES)
    // Verify by replaying manually with chess.js
    const chess = new Chess(INITIAL_FEN)
    chess.move({ from: 'e2', to: 'e4' })
    chess.move({ from: 'd7', to: 'd5' })
    chess.move({ from: 'e4', to: 'd5' })
    chess.move({ from: 'd8', to: 'd5' })
    expect(terminal).toBe(chess.fen())
  })
})

describe('resolveOverviewBoardPosition', () => {
  const TERMINAL_FEN_A = 'r1bqkbnr/ppp1pppp/8/3Q4/8/8/PPPP1PPP/RNB1KBNR w KQkq - 0 3'
  const TERMINAL_FEN_B = 'r1bqkb1r/ppp1pppp/5n2/3Q4/8/8/PPPP1PPP/RNB1KBNR w KQkq - 2 4'

  it('falls back to computeFinalFen when all attempts are failed', () => {
    const attempts = [
      { status: 'failed', board: { terminalFen: 'some-wrong-fen', lastMove: ['e2', 'e4'] as [string, string] } },
      { status: 'failed', board: { terminalFen: 'another-wrong-fen', lastMove: null } },
    ]
    const { fen } = resolveOverviewBoardPosition(attempts, SOLUTION_MOVES, INITIAL_FEN)
    expect(fen).toBe(computeFinalFen(INITIAL_FEN, SOLUTION_MOVES))
  })

  it('uses the solved attempt\'s terminalFen', () => {
    const attempts = [
      { status: 'failed', board: { terminalFen: 'wrong-fen', lastMove: null } },
      { status: 'solved', board: { terminalFen: TERMINAL_FEN_A, lastMove: ['d8', 'd5'] as [string, string] } },
    ]
    const { fen, lastMove } = resolveOverviewBoardPosition(attempts, SOLUTION_MOVES, INITIAL_FEN)
    expect(fen).toBe(TERMINAL_FEN_A)
    expect(lastMove).toEqual(['d8', 'd5'])
  })

  it('uses the LAST solved attempt when multiple solved attempts exist', () => {
    const attempts = [
      { status: 'solved', board: { terminalFen: TERMINAL_FEN_A, lastMove: null } },
      { status: 'failed', board: { terminalFen: 'wrong-fen', lastMove: null } },
      { status: 'solved', board: { terminalFen: TERMINAL_FEN_B, lastMove: ['e4', 'd5'] as [string, string] } },
    ]
    const { fen } = resolveOverviewBoardPosition(attempts, SOLUTION_MOVES, INITIAL_FEN)
    expect(fen).toBe(TERMINAL_FEN_B)
  })

  it('falls back to computeFinalFen when the solved attempt has a null terminalFen', () => {
    const attempts = [
      { status: 'solved', board: { terminalFen: null, lastMove: null } },
    ]
    const { fen } = resolveOverviewBoardPosition(attempts, SOLUTION_MOVES, INITIAL_FEN)
    expect(fen).toBe(computeFinalFen(INITIAL_FEN, SOLUTION_MOVES))
  })
})
