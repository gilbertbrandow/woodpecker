import { Chess } from 'chess.js'
import { applyUci } from './boardPage.helpers'
import type { MoveFeedbackResult } from './boardPage.helpers'
import type { AttemptSummary, RunPuzzleFull } from '../../lib/api'

export type OverviewBoardState = {
  fen: string
  lastMove: [string, string] | undefined
  moveFeedback: {
    result: MoveFeedbackResult | null
    square: string | null
    visible: boolean
  }
}

const EMPTY_FEEDBACK: OverviewBoardState['moveFeedback'] = {
  result: null,
  square: null,
  visible: false,
}

function applyMovesUntilFail(chess: Chess, moves: string[]): void {
  for (const uci of moves) {
    try {
      applyUci(chess, uci)
    } catch {
      break
    }
  }
}

export function computeOverviewBoardState(
  puzzle: RunPuzzleFull,
  selectedAttempt: AttemptSummary | null,
): OverviewBoardState {
  const solutionMoves = puzzle.solution.split(' ')

  if (selectedAttempt === null || selectedAttempt.moves.length === 0) {
    const chess = new Chess(puzzle.fen)
    applyMovesUntilFail(chess, solutionMoves)
    return { fen: chess.fen(), lastMove: undefined, moveFeedback: EMPTY_FEEDBACK }
  }

  if (selectedAttempt.status === 'solved') {
    const chess = new Chess(puzzle.fen)
    applyMovesUntilFail(chess, solutionMoves)
    const lastUci = solutionMoves[solutionMoves.length - 1]
    const lastMove: [string, string] = [lastUci.slice(0, 2), lastUci.slice(2, 4)]
    return {
      fen: chess.fen(),
      lastMove,
      moveFeedback: { result: 'correct', square: lastMove[1], visible: true },
    }
  }

  const chess = new Chess(puzzle.fen)
  if (solutionMoves.length === 0) {
    return { fen: puzzle.fen, lastMove: undefined, moveFeedback: EMPTY_FEEDBACK }
  }

  applyMovesUntilFail(chess, solutionMoves)
  const lastUci = solutionMoves[solutionMoves.length - 1]
  const lastMove: [string, string] = [lastUci.slice(0, 2), lastUci.slice(2, 4)]
  return {
    fen: chess.fen(),
    lastMove,
    moveFeedback: { result: 'correct', square: lastMove[1], visible: true },
  }
}
