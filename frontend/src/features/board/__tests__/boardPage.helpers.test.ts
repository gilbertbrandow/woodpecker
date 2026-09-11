import { describe, it, expect, beforeAll } from 'vitest'
import { Chess } from 'chess.js'
import { buildLivePgnDisplay, computeFinalFen, resolveOverviewBoardPosition, resolveStep, resultsInCheckmate } from '../boardPage.helpers'

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

// 4-ply puzzle: opponent (white) e2e4, player (black) d7d5, opponent e4xd5, player Qxd5.
const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const OPP_MOVE = 'e2e4'
const PLAYER_MOVE_1 = 'd7d5'
const OPP_MOVE_2 = 'e4d5'

const WRONG_MOVE_1 = 'd7d6'   // wrong at position 1 (same square as PLAYER_MOVE_1)
const WRONG_MOVE_2 = 'd8d7'   // wrong at position 2 (after correct PLAYER_MOVE_1 + OPP_MOVE_2)

describe('buildLivePgnDisplay — focus mode (no wrong move)', () => {
  beforeAll(() => {
    const chess = new Chess(FEN)
    const e4 = chess.move({ from: 'e2', to: 'e4' })
    const d5 = chess.move({ from: 'd7', to: 'd5' })
    expect(e4).not.toBeNull()
    expect(d5).not.toBeNull()
  })

  it('returns empty mainline when no plies have been played', () => {
    const result = buildLivePgnDisplay(FEN, [])
    expect(result.mainline).toHaveLength(0)
    expect(result.subvariations).toBeNull()
  })

  it('shows opponent move when only the first ply has been played', () => {
    const result = buildLivePgnDisplay(FEN, [OPP_MOVE])
    expect(result.mainline).toHaveLength(1)
    expect(result.mainline[0].moveStatus).toBe('opponent')
    expect(result.mainline[0].uci).toBe(OPP_MOVE)
    expect(result.subvariations).toBeNull()
  })

  it('shows opponent then player move with null status for player move', () => {
    const result = buildLivePgnDisplay(FEN, [OPP_MOVE, PLAYER_MOVE_1])
    expect(result.mainline).toHaveLength(2)
    expect(result.mainline[0].moveStatus).toBe('opponent')
    expect(result.mainline[1].moveStatus).toBeNull()
    expect(result.mainline[1].uci).toBe(PLAYER_MOVE_1)
    expect(result.subvariations).toBeNull()
  })
})

describe('buildLivePgnDisplay — W1 unresolved (wrong move in mainline)', () => {
  it('places W1 as the last mainline move with wrong status', () => {
    const result = buildLivePgnDisplay(FEN, [OPP_MOVE], WRONG_MOVE_1)
    expect(result.mainline).toHaveLength(2)
    expect(result.mainline[0].moveStatus).toBe('opponent')
    expect(result.mainline[1].uci).toBe(WRONG_MOVE_1)
    expect(result.mainline[1].moveStatus).toBe('wrong')
    expect(result.subvariations).toBeNull()
  })
})

describe('buildLivePgnDisplay — W1 resolved (correct move found after W1)', () => {
  it('demotes W1 to first subvariation and puts correct move in mainline', () => {
    const result = buildLivePgnDisplay(FEN, [OPP_MOVE], WRONG_MOVE_1, [PLAYER_MOVE_1])
    // Mainline: opp e4, then correct d5 (null status, not yet marked correct by backend)
    expect(result.mainline).toHaveLength(2)
    expect(result.mainline[0].moveStatus).toBe('opponent')
    expect(result.mainline[1].uci).toBe(PLAYER_MOVE_1)
    expect(result.mainline[1].moveStatus).toBeNull()
    // W1 demoted to first subvariation
    expect(result.subvariations).toHaveLength(1)
    expect(result.subvariations![0][0].uci).toBe(WRONG_MOVE_1)
    expect(result.subvariations![0][0].moveStatus).toBe('wrong')
  })

  it('W2 at the same position as W1 also goes to subvariations', () => {
    const WRONG_MOVE_1B = 'c7c5'
    const result = buildLivePgnDisplay(
      FEN,
      [OPP_MOVE],
      WRONG_MOVE_1,
      [PLAYER_MOVE_1],
      [{ uci: WRONG_MOVE_1B, retryPliesAtWrongMove: [] }],
    )
    expect(result.subvariations).toHaveLength(2)
    expect(result.subvariations![0][0].uci).toBe(WRONG_MOVE_1)
    expect(result.subvariations![1][0].uci).toBe(WRONG_MOVE_1B)
  })
})

describe('buildLivePgnDisplay — wrong move at a later position (P2)', () => {
  it('puts a wrong move at P2 directly into subvariations', () => {
    // Player got P1 right (d7d5), opponent responded (e4xd5), now wrong at P2.
    const retryPlies = [PLAYER_MOVE_1, OPP_MOVE_2]
    const result = buildLivePgnDisplay(
      FEN,
      [OPP_MOVE],
      WRONG_MOVE_1,
      retryPlies,
      [{ uci: WRONG_MOVE_2, retryPliesAtWrongMove: [PLAYER_MOVE_1, OPP_MOVE_2] }],
    )
    // Mainline: opp e4, d5 (W1 resolved), opp exd5, Qd7 (the wrong P2 move is in subs)
    expect(result.mainline.length).toBeGreaterThanOrEqual(2)
    // W1 in first subvariation
    expect(result.subvariations).not.toBeNull()
    const wrongAtP2 = result.subvariations!.find(sv => sv[0].uci === WRONG_MOVE_2)
    expect(wrongAtP2).toBeDefined()
    expect(wrongAtP2![0].moveStatus).toBe('wrong')
  })
})

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const SOLUTION_MOVES: (string | string[])[] = ['e2e4', 'd7d5', 'e4d5', 'd8d5']

describe('computeFinalFen', () => {
  it('returns the initial FEN unchanged when solution is empty', () => {
    expect(computeFinalFen(INITIAL_FEN, [])).toBe(INITIAL_FEN)
  })

  it('returns the correct terminal FEN after applying all solution moves', () => {
    const terminal = computeFinalFen(INITIAL_FEN, SOLUTION_MOVES)
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

describe('resolveStep', () => {
  it('returns the string unchanged for a plain UCI move', () => {
    expect(resolveStep('e2e4')).toBe('e2e4')
  })
  it('returns the first element for a non-empty alternatives array', () => {
    expect(resolveStep(['e7e5', 'c7c5'])).toBe('e7e5')
  })
})
