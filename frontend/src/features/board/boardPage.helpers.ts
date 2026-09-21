import { Chess, type Move } from 'chess.js'
import type { DisplayMove, PositionStatus, TrainingItemMetaPgnDisplay, OverviewAttemptView } from '../../lib/api'
import { getStored, setStored } from '../../lib/storage'

export type Mode = 'loading' | 'focus' | 'failed' | 'overview'
export type Orientation = 'white' | 'black'
export type PendingPromotion = { orig: string; dest: string }
export type MoveFeedbackResult = 'correct' | 'wrong'
export type MoveFeedbackState = {
  lastMoveResult: MoveFeedbackResult | null
  lastMoveSquare: string | null
  isShowingMoveFeedback: boolean
}

export type BoardState = {
  boardKey: number
  boardSize: number
  fen: string
  orientation: Orientation
  dests: Map<string, string[]>
  lastMove: [string, string] | undefined
  hintSquare: string | null
  pendingPromotion: PendingPromotion | null
  moveFeedback: {
    result: MoveFeedbackResult | null
    square: string | null
    visible: boolean
  }
  turnToMove: Orientation
  kingPieceUrl: string
  darkKingPieceUrl: string
}

export const HEADER_H = 56
export const FOOTER_H = 0
export const BOARD_GAP = 24
export const H_PAD_MD = 48
export const H_PAD_SM = 32
export const MIN_SIDEBAR = 96
export const LG_BREAKPOINT = 1024
export const V_PAD_DESKTOP = 96
export const MOBILE_H_PAD = 24

export const MIN_BOARD_SIZE = 200
export const MIN_BOARD_SCALE = 0.4
export const BOARD_SCALE_STORAGE_KEY = 'board.scale'

export function isDesktopBoardLayout(): boolean {
  return window.innerWidth >= LG_BREAKPOINT
}

// Largest board that fits the viewport; the user's scale only ever shrinks from here.
export function computeMaxBoardSize(): number {
  if (isDesktopBoardLayout()) {
    const availH = window.innerHeight - HEADER_H - FOOTER_H - V_PAD_DESKTOP
    const availW = window.innerWidth - H_PAD_MD - 2 * MIN_SIDEBAR - 2 * BOARD_GAP
    return Math.max(MIN_BOARD_SIZE, Math.min(availH, availW))
  }
  return Math.max(MIN_BOARD_SIZE, window.innerWidth - MOBILE_H_PAD)
}

export function clampBoardScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1
  return Math.min(1, Math.max(MIN_BOARD_SCALE, scale))
}

export function readBoardScale(): number {
  const stored = getStored<unknown>(BOARD_SCALE_STORAGE_KEY)
  return typeof stored === 'number' ? clampBoardScale(stored) : 1
}

export function writeBoardScale(scale: number): void {
  setStored(BOARD_SCALE_STORAGE_KEY, clampBoardScale(scale))
}

export function computeBoardSize(scale: number = readBoardScale()): number {
  const max = computeMaxBoardSize()
  if (!isDesktopBoardLayout()) return max
  return Math.max(MIN_BOARD_SIZE, Math.round(max * clampBoardScale(scale)))
}
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

export function applyUci(chess: Chess, uci: string): Move {
  return chess.move({
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

export function formatTimer(tenths: number, showTenths = true): string {
  const capped = Math.min(tenths, 6_000)
  const wholeTenths = Math.floor(capped)
  const m = Math.floor(wholeTenths / 600)
  const s = Math.floor((wholeTenths % 600) / 10)
  if (!showTenths) return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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

export function resolveStep(step: string | string[]): string {
  return Array.isArray(step) ? step[0] : step
}

export function computeFinalFen(fen: string, plies: (string | string[])[]): string {
  const chess = new Chess(fen)
  for (const ply of plies) {
    try { applyUci(chess, resolveStep(ply)) } catch { break }
  }
  return chess.fen()
}

type AttemptBoardView = { terminalFen: string | null; lastMove: [string, string] | null } | null

export function resolveOverviewBoardPosition(
  attempts: ReadonlyArray<{ status: string; board: AttemptBoardView }>,
  plies: (string | string[])[],
  initialFen: string,
): { fen: string; lastMove: [string, string] | undefined } {
  const solvedAttempt = [...attempts].reverse().find((a) => a.status === 'solved') ?? null
  return {
    fen: solvedAttempt?.board?.terminalFen ?? computeFinalFen(initialFen, plies),
    lastMove: solvedAttempt?.board?.lastMove ?? undefined,
  }
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

export type PlySelection =
  | { line: 'main'; index: number }
  | { line: 'subvariation'; subIndex: number; index: number }

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

export type FailedModeWrongMove = {
  uci: string
  // Snapshot of failedRetryPlies at the time this wrong move was played.
  // Empty = wrong move at the same position as W1; non-empty = later position.
  retryPliesAtWrongMove: string[]
}

// Builds the live Aggregate PGN for a TrainingItem during active solving.
//
// Without firstWrongMove (focus mode before any mistake): plain linear display
// of pliesPlayed with no subvariations.
//
// With firstWrongMove (W1): W1 occupies the mainline slot until failedRetryPlies
// resolves it — at which point W1 is demoted to the first subvariation and the
// correct move becomes mainline. Subsequent wrong moves at the same position go
// directly to subvariations.
//
// The same "hold the mainline slot" rule applies at every later position: the
// first wrong move at each new frontier position occupies the mainline slot
// (with 'wrong' status) until the correct move at that position is found.
// This ensures computePgnLayout can always find the branch point in the mainline
// rather than falling back to an incorrect position.
export function buildLivePgnDisplay(
  baseFen: string,
  pliesPlayed: string[],
  firstWrongMove?: string,
  failedRetryPlies: string[] = [],
  failedModeWrongMoves: FailedModeWrongMove[] = [],
): TrainingItemMetaPgnDisplay {
  if (firstWrongMove === undefined) {
    const chess = new Chess(baseFen)
    const mainline: DisplayMove[] = []
    for (let i = 0; i < pliesPlayed.length; i++) {
      const move = applyUciDisplay(chess, pliesPlayed[i], i === 0 ? 'opponent' : null)
      if (!move) break
      mainline.push(move)
    }
    return { mainline, subvariations: null }
  }

  const w1Resolved = failedRetryPlies.length > 0

  // The first wrong move at the current frontier (retryPliesAtWrongMove.length ===
  // failedRetryPlies.length) holds the mainline slot just like W1 does at position 1.
  // Once the correct move at that position is found, failedRetryPlies grows and this
  // entry's snapshot falls behind — at which point it demotes to a subvariation.
  const firstUnresolvedAtFrontier = w1Resolved
    ? (failedModeWrongMoves.find(wm => wm.retryPliesAtWrongMove.length === failedRetryPlies.length) ?? null)
    : null

  const mainlinePlies = w1Resolved
    ? firstUnresolvedAtFrontier !== null
      ? [...pliesPlayed, ...failedRetryPlies, firstUnresolvedAtFrontier.uci]
      : [...pliesPlayed, ...failedRetryPlies]
    : [...pliesPlayed, firstWrongMove]

  const mainlineChess = new Chess(baseFen)
  const mainline: DisplayMove[] = []
  for (let i = 0; i < mainlinePlies.length; i++) {
    const isLastPly = i === mainlinePlies.length - 1
    const isWrongInMainline =
      (!w1Resolved && isLastPly) || (firstUnresolvedAtFrontier !== null && isLastPly)
    const moveStatus: DisplayMove['moveStatus'] =
      i === 0 ? 'opponent'
      : isWrongInMainline ? 'wrong'
      : null
    const move = applyUciDisplay(mainlineChess, mainlinePlies[i], moveStatus)
    if (!move) break
    mainline.push(move)
  }

  const makeWrongDisplay = (uci: string, prefix: string[]): DisplayMove | null => {
    const chess = new Chess(baseFen)
    for (const ply of prefix) {
      try { applyUci(chess, ply) } catch { return null }
    }
    return applyUciDisplay(chess, uci, 'wrong')
  }

  const subvariations: DisplayMove[][] = []

  // Wrong moves at W1's position. Once W1 is resolved it joins this group first.
  if (w1Resolved) {
    const d = makeWrongDisplay(firstWrongMove, pliesPlayed)
    if (d) subvariations.push([d])
  }
  for (const wm of failedModeWrongMoves) {
    if (wm.retryPliesAtWrongMove.length > 0) continue
    const d = makeWrongDisplay(wm.uci, pliesPlayed)
    if (d) subvariations.push([d])
  }

  // Wrong moves at later positions (P2+). Skip the one currently in the mainline.
  for (const wm of failedModeWrongMoves) {
    if (wm.retryPliesAtWrongMove.length === 0) continue
    if (wm === firstUnresolvedAtFrontier) continue
    const d = makeWrongDisplay(wm.uci, [...pliesPlayed, ...wm.retryPliesAtWrongMove])
    if (d) subvariations.push([d])
  }

  return { mainline, subvariations: subvariations.length > 0 ? subvariations : null }
}

export function resolveDisplayBoard(
  board: BoardState,
  mode: Mode,
  selectedPly: PlySelection | null,
  focusPgnDisplay: TrainingItemMetaPgnDisplay | null,
  selectedAttempt: OverviewAttemptView | null,
  overviewPgnDisplay: TrainingItemMetaPgnDisplay | null,
): BoardState {
  if (mode === 'overview') {
    const base: BoardState = { ...board, dests: new Map() }
    if (selectedPly !== null && overviewPgnDisplay !== null) {
      let ply: DisplayMove | undefined
      if (selectedPly.line === 'subvariation') {
        ply = overviewPgnDisplay.subvariations?.[selectedPly.subIndex]?.[selectedPly.index]
      } else {
        ply = overviewPgnDisplay.mainline[selectedPly.index]
      }
      if (ply) {
        const feedbackResult: MoveFeedbackResult | null =
          ply.moveStatus === 'correct' ? 'correct' : ply.moveStatus === 'wrong' ? 'wrong' : null
        return {
          ...base,
          fen: ply.fen,
          lastMove: [ply.from, ply.to],
          moveFeedback: { result: feedbackResult, square: feedbackResult !== null ? ply.to : null, visible: feedbackResult !== null },
        }
      }
    }
    if (
      selectedAttempt?.board !== null &&
      selectedAttempt?.board !== undefined &&
      selectedAttempt.status !== 'failed'
    ) {
      return {
        ...base,
        fen: selectedAttempt.board.terminalFen ?? board.fen,
        lastMove: selectedAttempt.board.lastMove ?? undefined,
        moveFeedback: {
          result: selectedAttempt.board.result,
          square: selectedAttempt.board.result !== null ? (selectedAttempt.board.lastMove?.[1] ?? null) : null,
          visible: selectedAttempt.board.result !== null,
        },
      }
    }
    return base
  }

  if (selectedPly === null || focusPgnDisplay === null) return board
  const isAtHeadPly =
    selectedPly.line === 'main' && selectedPly.index === focusPgnDisplay.mainline.length - 1
  if (isAtHeadPly) return board
  const ply = focusPgnDisplay.mainline[selectedPly.index]
  if (!ply) return board
  const feedbackResult: MoveFeedbackResult | null =
    ply.moveStatus === 'correct' ? 'correct' : ply.moveStatus === 'wrong' ? 'wrong' : null
  return {
    ...board,
    fen: ply.fen,
    lastMove: [ply.from, ply.to],
    dests: new Map(),
    moveFeedback: { result: feedbackResult, square: feedbackResult !== null ? ply.to : null, visible: feedbackResult !== null },
  }
}
