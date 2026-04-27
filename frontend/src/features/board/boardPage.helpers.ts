import { Chess } from 'chess.js'
import type { DisplayMove, PositionStatus, PuzzleMetaPgnDisplay } from '../../lib/api'

export type Mode = 'loading' | 'focus' | 'failed' | 'overview'
export type Orientation = 'white' | 'black'
export type PendingPromotion = { orig: string; dest: string }
export type MoveFeedbackResult = 'correct' | 'wrong'
export type MoveFeedbackState = {
  lastMoveResult: MoveFeedbackResult | null
  lastMoveSquare: string | null
  isShowingMoveFeedback: boolean
}

export const HEADER_H = 57
export const FOOTER_H = 49
export const BOARD_GAP = 24
export const H_PAD_MD = 48
export const H_PAD_SM = 32
export const MIN_SIDEBAR = 96
export const MAX_BOARD = 760
export const LG_BREAKPOINT = 1024
export const V_PAD_DESKTOP = 48
export const MOBILE_H_PAD = 32
export const MOBILE_CHROME_H = 244
export const MOVE_FEEDBACK_SUCCESS_MS = 200
export const WRONG_REVERT_MS = 500
export const FAILED_TO_OVERVIEW_MS = 300
export const TIMER_UPDATE_MS = 50
export const INITIAL_OPPONENT_MOVE_DELAY_MS = 250
export const OPPONENT_MOVE_ANIM_MS = 150

export const POSITION_STATUS_CLASS: Record<PositionStatus, string> = {
  not_started: '',
  in_progress: 'border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
  solved: 'border-green-600/30 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  solved_with_retries: 'border-green-600/30 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  failed: 'border-red-600/30 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400',
}

export const ATTEMPT_STATUS_CLASS: Record<string, string> = {
  solved: 'border-green-600/30 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  failed: 'border-red-600/30 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  in_progress: 'border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
}

export const ATTEMPT_STATUS_LABEL: Record<string, string> = {
  solved: 'Solved',
  failed: 'Failed',
  in_progress: 'In progress',
}

export function computeDests(chess: Chess): Map<string, string[]> {
  const dests = new Map<string, string[]>()
  for (const move of chess.moves({ verbose: true })) {
    const existing = dests.get(move.from) ?? []
    dests.set(move.from, [...existing, move.to])
  }
  return dests
}

export function applyUci(chess: Chess, uci: string): void {
  chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length === 5 ? uci[4] : undefined,
  })
}

export function resultsInCheckmate(chess: Chess, orig: string, dest: string, promotionPiece?: string): boolean {
  try {
    chess.move({ from: orig, to: dest, promotion: promotionPiece ?? 'q' })
  } catch {
    return false
  }
  const checkmate = chess.isCheckmate()
  chess.undo()
  return checkmate
}

export function playerColor(fen: string): Orientation {
  return fen.split(' ')[1] === 'w' ? 'black' : 'white'
}

export function formatTimer(tenths: number): string {
  const capped = Math.min(tenths, 6_000)
  const wholeTenths = Math.floor(capped)
  const m = Math.floor(wholeTenths / 600)
  const s = Math.floor((wholeTenths % 600) / 10)
  const t = wholeTenths % 10
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${t}`
}

export function formatTargetSolveTime(tenths: number): string {
  const wholeSeconds = Math.floor(Math.max(0, tenths) / 10)
  const minutes = Math.floor(wholeSeconds / 60)
  const seconds = wholeSeconds % 60

  if (minutes === 0) {
    return `${seconds}s`
  }

  if (seconds === 0) {
    return `${minutes}m`
  }

  return `${minutes}m ${seconds}s`
}

export function positionStatusLabel(status: PositionStatus): string {
  switch (status) {
    case 'solved': return 'Solved'
    case 'solved_with_retries': return 'Solved'
    case 'failed': return 'Failed'
    case 'in_progress': return 'In progress'
    case 'not_started': return 'Not started'
  }
}

export function computeFinalFen(fen: string, solutionMoves: string[]): string {
  const chess = new Chess(fen)
  for (const uci of solutionMoves) applyUci(chess, uci)
  return chess.fen()
}

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Overdue'
  const hours = ms / 3_600_000
  const months = Math.floor(hours / 720)
  if (months >= 1) return `${months} month${months === 1 ? '' : 's'}`
  const weeks = Math.floor(hours / 168)
  if (weeks >= 1) return `${weeks} week${weeks === 1 ? '' : 's'}`
  const days = Math.floor(hours / 24)
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`
  const h = Math.ceil(hours)
  return `${h} hour${h === 1 ? '' : 's'}`
}

export type PlySelection = {
  line: 'main' | 'variation'
  index: number
}

function applyUciDisplay(
  chess: Chess,
  uci: string,
  moveStatus: DisplayMove['moveStatus'],
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
      uci,
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
      const isLast = i === attemptMoves.length - 1
      const userMove = applyUciDisplay(chess, attemptMoves[i], 'correct')
      if (!userMove) break
      mainline.push(userMove)
      if (!isLast) {
        const nextOpponentIndex = 2 * (i + 1)
        if (nextOpponentIndex < solutionMoves.length) {
          const oppMove = applyUciDisplay(chess, solutionMoves[nextOpponentIndex], 'opponent')
          if (!oppMove) break
          mainline.push(oppMove)
        }
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
