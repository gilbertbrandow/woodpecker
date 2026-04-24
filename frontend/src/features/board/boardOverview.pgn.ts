import { Chess } from 'chess.js'

export type PlySelection = {
  line: 'main' | 'variation'
  index: number
}

export type DisplayMove = {
  san: string
  fen: string
  from: string
  to: string
  moveNumber: number
  isWhite: boolean
  moveStatus: 'correct' | 'wrong' | 'opponent' | null
}

export type PuzzleMetaPgnDisplay = {
  mainline: DisplayMove[]
  variation: DisplayMove[] | null
}

function applyUciDisplay(
  chess: Chess,
  uci: string,
  moveStatus: DisplayMove['moveStatus'] = null,
): DisplayMove | null {
  const isWhite = chess.turn() === 'w'
  const moveNumber = parseInt(chess.fen().split(' ')[5], 10)
  try {
    const result = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length === 5 ? uci[4] : undefined,
    })
    if (!result) return null
    return {
      san: result.san,
      fen: chess.fen(),
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      moveNumber,
      isWhite,
      moveStatus,
    }
  } catch {
    return null
  }
}

export function buildPgnDisplay(
  baseFen: string,
  attemptMoves: string[],
  solutionMovesStr: string,
  attemptStatus: 'solved' | 'failed' | 'in_progress',
  retryPlies: string[] = [],
  autoVariation: boolean = true,
): PuzzleMetaPgnDisplay {
  const solutionMoves = solutionMovesStr.split(' ').filter(Boolean)
  if (solutionMoves.length === 0) return { mainline: [], variation: null }

  if (attemptStatus === 'in_progress') {
    const chess = new Chess(baseFen)
    const mainline: DisplayMove[] = []
    for (const uci of attemptMoves) {
      const move = applyUciDisplay(chess, uci, null)
      if (!move) break
      mainline.push(move)
    }
    return { mainline, variation: null }
  }

  if (attemptStatus === 'solved') {
    const chess = new Chess(baseFen)
    const mainline: DisplayMove[] = []
    const firstOpponent = applyUciDisplay(chess, solutionMoves[0], 'opponent')
    if (!firstOpponent) return { mainline, variation: null }
    mainline.push(firstOpponent)
    for (let i = 0; i < attemptMoves.length; i++) {
      const userMove = applyUciDisplay(chess, attemptMoves[i], 'correct')
      if (!userMove) break
      mainline.push(userMove)
      const nextOpponentIndex = 2 * (i + 1)
      if (i + 1 < attemptMoves.length && nextOpponentIndex < solutionMoves.length) {
        const oppMove = applyUciDisplay(chess, solutionMoves[nextOpponentIndex], 'opponent')
        if (!oppMove) break
        mainline.push(oppMove)
      }
    }
    return { mainline, variation: null }
  }

  const chess = new Chess(baseFen)
  const mainline: DisplayMove[] = []

  const opponentFirst = applyUciDisplay(chess, solutionMoves[0], 'opponent')
  if (!opponentFirst) return { mainline: [], variation: null }
  mainline.push(opponentFirst)

  if (attemptMoves.length === 0) {
    return { mainline, variation: null }
  }

  let branchFen = chess.fen()
  let actualFailedIdx = 0

  for (let i = 0; i < attemptMoves.length; i++) {
    actualFailedIdx = i
    const isLastUserMove = i === attemptMoves.length - 1
    const userStatus: DisplayMove['moveStatus'] = isLastUserMove ? 'wrong' : 'correct'

    if (isLastUserMove) {
      branchFen = chess.fen()
    }

    const userMove = applyUciDisplay(chess, attemptMoves[i], userStatus)
    if (!userMove) break
    mainline.push(userMove)

    const opponentIdx = 2 + i * 2
    if (!isLastUserMove && opponentIdx < solutionMoves.length) {
      const oppMove = applyUciDisplay(chess, solutionMoves[opponentIdx], 'opponent')
      if (!oppMove) break
      mainline.push(oppMove)
    }
  }

  const variationChess = new Chess(branchFen)
  const variation: DisplayMove[] = []

  if (retryPlies.length > 0) {
    for (const uci of retryPlies) {
      const move = applyUciDisplay(variationChess, uci, null)
      if (!move) break
      variation.push(move)
    }
  } else if (autoVariation) {
    const correctStartIdx = actualFailedIdx * 2 + 1
    for (let i = correctStartIdx; i < solutionMoves.length; i++) {
      const status: DisplayMove['moveStatus'] = i % 2 === 0 ? 'opponent' : 'correct'
      const move = applyUciDisplay(variationChess, solutionMoves[i], status)
      if (!move) break
      variation.push(move)
    }
  }

  return { mainline, variation: variation.length > 0 ? variation : null }
}
