import { Chess } from 'chess.js'

export type DisplayMove = {
  san: string
  moveNumber: number
  isWhite: boolean
}

export type PuzzleMetaPgnDisplay = {
  mainline: DisplayMove[]
  variation: DisplayMove[] | null
}

function applyUciDisplay(chess: Chess, uci: string): DisplayMove | null {
  const isWhite = chess.turn() === 'w'
  const moveNumber = parseInt(chess.fen().split(' ')[5], 10)
  try {
    const result = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length === 5 ? uci[4] : undefined,
    })
    if (!result) return null
    return { san: result.san, moveNumber, isWhite }
  } catch {
    return null
  }
}

export function buildPgnDisplay(
  baseFen: string,
  attemptMoves: string[],
  solutionMovesStr: string,
  attemptStatus: 'solved' | 'failed',
): PuzzleMetaPgnDisplay {
  const solutionMoves = solutionMovesStr.split(' ').filter(Boolean)
  if (solutionMoves.length === 0) return { mainline: [], variation: null }

  if (attemptStatus === 'solved' || attemptMoves.length === 0) {
    const chess = new Chess(baseFen)
    const mainline: DisplayMove[] = []
    for (const uci of solutionMoves) {
      const move = applyUciDisplay(chess, uci)
      if (!move) break
      mainline.push(move)
    }
    return { mainline, variation: null }
  }

  const chess = new Chess(baseFen)
  const mainline: DisplayMove[] = []

  const opponentFirst = applyUciDisplay(chess, solutionMoves[0])
  if (!opponentFirst) return { mainline: [], variation: null }
  mainline.push(opponentFirst)

  let actualFailedIdx = 0
  for (let i = 0; i < attemptMoves.length; i++) {
    actualFailedIdx = i
    const userMove = applyUciDisplay(chess, attemptMoves[i])
    if (!userMove) break
    mainline.push(userMove)

    const isLast = i === attemptMoves.length - 1
    const opponentIdx = 2 + i * 2
    if (!isLast && opponentIdx < solutionMoves.length) {
      const oppMove = applyUciDisplay(chess, solutionMoves[opponentIdx])
      if (!oppMove) break
      mainline.push(oppMove)
    }
  }

  const variationChess = new Chess(baseFen)
  applyUciDisplay(variationChess, solutionMoves[0])
  for (let i = 0; i < actualFailedIdx; i++) {
    if (!applyUciDisplay(variationChess, attemptMoves[i])) break
    const oppIdx = 2 + i * 2
    if (oppIdx < solutionMoves.length) {
      applyUciDisplay(variationChess, solutionMoves[oppIdx])
    }
  }

  const correctStartIdx = actualFailedIdx * 2 + 1
  const variation: DisplayMove[] = []
  for (let i = correctStartIdx; i < solutionMoves.length; i++) {
    const move = applyUciDisplay(variationChess, solutionMoves[i])
    if (!move) break
    variation.push(move)
  }

  return { mainline, variation: variation.length > 0 ? variation : null }
}
