import { describe, it, expect } from 'vitest'
import { resolveDisplayBoard } from '../boardPage.helpers'
import type { BoardState, PlySelection } from '../boardPage.helpers'
import type { TrainingItemMetaPgnDisplay, OverviewAttemptView } from '../../../lib/api'

const BASE_BOARD: BoardState = {
  boardKey: 0,
  boardSize: 480,
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  orientation: 'white',
  dests: new Map([['e2', ['e4', 'e3']]]),
  lastMove: undefined,
  hintSquare: null,
  pendingPromotion: null,
  moveFeedback: { result: null, square: null, visible: false },
  turnToMove: 'white',
  kingPieceUrl: '',
}

const PLY_1_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
const PLY_2_FEN = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'

const PGN_2_MOVES: TrainingItemMetaPgnDisplay = {
  mainline: [
    { san: 'e4', uci: 'e2e4', fen: PLY_1_FEN, from: 'e2', to: 'e4', moveNumber: 1, isWhite: true, moveStatus: 'opponent' },
    { san: 'd5', uci: 'd7d5', fen: PLY_2_FEN, from: 'd7', to: 'd5', moveNumber: 1, isWhite: false, moveStatus: 'correct' },
  ],
  variation: null,
}

const PGN_WITH_WRONG: TrainingItemMetaPgnDisplay = {
  mainline: [
    { san: 'e4', uci: 'e2e4', fen: PLY_1_FEN, from: 'e2', to: 'e4', moveNumber: 1, isWhite: true, moveStatus: 'opponent' },
    { san: 'd6', uci: 'd7d6', fen: PLY_2_FEN, from: 'd7', to: 'd6', moveNumber: 1, isWhite: false, moveStatus: 'wrong' },
  ],
  variation: [
    { san: 'd5', uci: 'd7d5', fen: PLY_2_FEN, from: 'd7', to: 'd5', moveNumber: 1, isWhite: false, moveStatus: 'correct' },
  ],
}

const SOLVED_ATTEMPT: OverviewAttemptView = {
  id: 1, runId: 1, runIndex: 0, runTrainingItemId: 1, tryNumber: 1,
  status: 'solved', startedAt: '', completedAt: '', timeSpentMs: 5000,
  moves: [], attemptType: 'scored', isQualifying: true,
  countsTowardsTraining: true, countsTowardsProgress: true,
  countsTowardsAccuracy: true, countsTowardsAverageTime: true,
  board: { terminalFen: PLY_2_FEN, lastMove: ['d7', 'd5'], result: 'correct' },
  pgnDisplay: null,
  impact: { runProgressDeltaPct: null, trainingProgressDeltaPct: null, accuracyDeltaPct: null, averageSolveTimeDeltaMs: null },
}

const FAILED_ATTEMPT: OverviewAttemptView = { ...SOLVED_ATTEMPT, id: 2, status: 'failed', board: { terminalFen: PLY_2_FEN, lastMove: ['d7', 'd6'], result: 'wrong' } }

describe('resolveDisplayBoard — focus mode', () => {
  it('returns board unchanged when no ply selected', () => {
    const result = resolveDisplayBoard(BASE_BOARD, 'focus', null, PGN_2_MOVES, null, null)
    expect(result).toBe(BASE_BOARD)
  })

  it('returns board unchanged when selected ply is the head of mainline', () => {
    const headPly: PlySelection = { line: 'main', index: 1 }
    const result = resolveDisplayBoard(BASE_BOARD, 'focus', headPly, PGN_2_MOVES, null, null)
    expect(result).toBe(BASE_BOARD)
  })

  it('returns ply FEN and clears dests when non-head ply is selected', () => {
    const ply: PlySelection = { line: 'main', index: 0 }
    const result = resolveDisplayBoard(BASE_BOARD, 'focus', ply, PGN_2_MOVES, null, null)
    expect(result.fen).toBe(PLY_1_FEN)
    expect(result.lastMove).toEqual(['e2', 'e4'])
    expect(result.dests.size).toBe(0)
  })

  it('returns board unchanged when focusPgnDisplay is null', () => {
    const ply: PlySelection = { line: 'main', index: 0 }
    const result = resolveDisplayBoard(BASE_BOARD, 'focus', ply, null, null, null)
    expect(result).toBe(BASE_BOARD)
  })

  it('sets correct moveFeedback for a correct ply', () => {
    const ply: PlySelection = { line: 'main', index: 0 }
    const result = resolveDisplayBoard(BASE_BOARD, 'focus', ply, PGN_2_MOVES, null, null)
    expect(result.moveFeedback.result).toBe(null) // opponent move has null feedback in focus
  })

  it('resolves variation ply when selected', () => {
    const ply: PlySelection = { line: 'variation', index: 0 }
    const result = resolveDisplayBoard(BASE_BOARD, 'focus', ply, PGN_WITH_WRONG, null, null)
    expect(result.fen).toBe(PLY_2_FEN)
    expect(result.moveFeedback.result).toBe('correct')
  })
})

describe('resolveDisplayBoard — overview mode', () => {
  it('clears dests and returns base board when no ply and no attempt', () => {
    const result = resolveDisplayBoard(BASE_BOARD, 'overview', null, null, null, null)
    expect(result.dests.size).toBe(0)
    expect(result.fen).toBe(BASE_BOARD.fen)
  })

  it('uses selected attempt terminal FEN for solved attempt', () => {
    const result = resolveDisplayBoard(BASE_BOARD, 'overview', null, null, SOLVED_ATTEMPT, null)
    expect(result.fen).toBe(PLY_2_FEN)
    expect(result.lastMove).toEqual(['d7', 'd5'])
    expect(result.moveFeedback.result).toBe('correct')
    expect(result.moveFeedback.visible).toBe(true)
  })

  it('does NOT use attempt terminal FEN for failed attempt', () => {
    const result = resolveDisplayBoard(BASE_BOARD, 'overview', null, null, FAILED_ATTEMPT, null)
    expect(result.fen).toBe(BASE_BOARD.fen)
  })

  it('PGN ply selection overrides attempt board', () => {
    const ply: PlySelection = { line: 'main', index: 0 }
    const result = resolveDisplayBoard(BASE_BOARD, 'overview', ply, null, SOLVED_ATTEMPT, PGN_2_MOVES)
    expect(result.fen).toBe(PLY_1_FEN)
    expect(result.moveFeedback.result).toBe(null) // opponent ply
  })

  it('sets wrong moveFeedback for wrong ply in overview', () => {
    const ply: PlySelection = { line: 'main', index: 1 }
    const result = resolveDisplayBoard(BASE_BOARD, 'overview', ply, null, null, PGN_WITH_WRONG)
    expect(result.moveFeedback.result).toBe('wrong')
    expect(result.moveFeedback.square).toBe('d6')
    expect(result.moveFeedback.visible).toBe(true)
  })
})
