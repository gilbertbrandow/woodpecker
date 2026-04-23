import { Chess } from 'chess.js'
import type { RunPuzzleListItem, PositionStatus, AttemptSummary, Run } from '../../lib/api'

export type Mode = 'loading' | 'focus' | 'failed' | 'overview'
export type Orientation = 'white' | 'black'
export type PendingPromotion = { orig: string; dest: string }
export type MoveFeedbackResult = 'correct' | 'wrong'
export type MoveFeedbackState = {
  lastMoveResult: MoveFeedbackResult | null
  lastMoveSquare: string | null
  isShowingMoveFeedback: boolean
}

export type StatsResult = {
  accuracy: number | null
  avgTimeMs: number | null
  solvedCount: number
  resolvedCount: number
  timeCount: number
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

export function computeStats(puzzles: RunPuzzleListItem[], excludeId?: number): StatsResult {
  const items = excludeId !== undefined ? puzzles.filter((p) => p.runPuzzleId !== excludeId) : puzzles
  const resolved = items.filter((p) =>
    p.positionStatus === 'solved' || p.positionStatus === 'solved_with_retries' || p.positionStatus === 'failed',
  )
  const solvedItems = resolved.filter(
    (p) => p.positionStatus === 'solved' || p.positionStatus === 'solved_with_retries',
  )
  const times = solvedItems.map((p) => p.timeMs).filter((t): t is number => t !== null)
  return {
    accuracy: resolved.length > 0 ? (solvedItems.length / resolved.length) * 100 : null,
    avgTimeMs: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    solvedCount: solvedItems.length,
    resolvedCount: resolved.length,
    timeCount: times.length,
  }
}

// TEMPORARY: frontend reconstruction of backend semantics.
// If backend training logic evolves, this derivation can silently become wrong.
// Preferred long-term solution: backend provides per-attempt flags (isQualifyingAttempt, countsTowardTraining, etc.).
export function computeQualifyingAttemptId(
  tries: AttemptSummary[],
  maxTriesPerPuzzle: number,
): number | null {
  const queueAttempts = tries
    .filter((a) => a.tryNumber <= maxTriesPerPuzzle && a.status !== 'in_progress')
    .sort((a, b) => a.tryNumber - b.tryNumber)

  const firstSolved = queueAttempts.find((a) => a.status === 'solved')
  if (firstSolved) return firstSolved.id

  if (queueAttempts.length >= maxTriesPerPuzzle) {
    return queueAttempts[queueAttempts.length - 1].id
  }

  return null
}

export function computeFrozenTimerTenths(attempt: AttemptSummary): number {
  return attempt.timeSpentMs !== null ? Math.round(attempt.timeSpentMs / 100) : 0
}

export function computeMetTargetTime(
  attempt: AttemptSummary,
  targetSolveTenths: number | null,
): boolean | null {
  if (attempt.timeSpentMs === null || targetSolveTenths === null || targetSolveTenths <= 0) return null
  return Math.round(attempt.timeSpentMs / 100) <= targetSolveTenths
}

export function computeRunProgressPct(run: Run): number {
  const resolved = run.solvedCount + run.solvedWithRetriesCount + run.failedCount
  return run.totalPuzzles > 0 ? (resolved / run.totalPuzzles) * 100 : 0
}

export function computeRunProgressDelta(
  selectedAttemptId: number,
  qualifyingAttemptId: number | null,
  totalPuzzles: number,
): number | null {
  if (qualifyingAttemptId !== selectedAttemptId) return null
  return totalPuzzles > 0 ? (1 / totalPuzzles) * 100 : null
}

export function computeTrainingProgressPct(allRuns: Run[]): number {
  const totalPuzzles = allRuns.reduce((s, r) => s + r.totalPuzzles, 0)
  if (totalPuzzles === 0) return 0
  const resolved = allRuns.reduce(
    (s, r) => s + r.solvedCount + r.solvedWithRetriesCount + r.failedCount,
    0,
  )
  return (resolved / totalPuzzles) * 100
}

export function computeTrainingProgressDelta(
  runProgressDelta: number | null,
  allRuns: Run[],
): number | null {
  if (runProgressDelta === null) return null
  const totalPuzzles = allRuns.reduce((s, r) => s + r.totalPuzzles, 0)
  if (totalPuzzles === 0) return null
  return (1 / totalPuzzles) * 100
}

export type RunPaceInput = {
  startedAt: string
  targetHours: number
  totalPuzzles: number
  resolvedCount: number
  nowMs?: number
}

export type RunPaceResult = {
  status: 'ahead' | 'on_pace' | 'behind'
  puzzleDelta: number
  timeRemainingHours: number
  deadlineIso: string
  expectedResolved: number
}

export function computeRunPace(input: RunPaceInput): RunPaceResult {
  const now = input.nowMs ?? Date.now()
  const startMs = Date.parse(input.startedAt)
  const elapsedMs = now - startMs
  const elapsedHours = elapsedMs / 3_600_000
  const progressFraction = Math.min(1, Math.max(0, elapsedHours / input.targetHours))
  const expectedResolved = Math.round(progressFraction * input.totalPuzzles)
  const rawDelta = input.resolvedCount - expectedResolved
  const puzzleDelta = Math.abs(rawDelta)
  const timeRemainingHours = input.targetHours - elapsedHours
  const deadlineMs = startMs + input.targetHours * 3_600_000
  const deadlineIso = new Date(deadlineMs).toISOString()

  const status: RunPaceResult['status'] =
    puzzleDelta <= 1 ? 'on_pace' : rawDelta > 0 ? 'ahead' : 'behind'

  return { status, puzzleDelta, timeRemainingHours, deadlineIso, expectedResolved }
}

export function formatTimeRemaining(hours: number): string {
  if (hours <= 0) return 'Overdue'
  const months = Math.floor(hours / 720)
  if (months >= 1) return `${months} month${months === 1 ? '' : 's'}`
  const weeks = Math.floor(hours / 168)
  if (weeks >= 1) return `${weeks} week${weeks === 1 ? '' : 's'}`
  const days = Math.floor(hours / 24)
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`
  const h = Math.ceil(hours)
  return `${h} hour${h === 1 ? '' : 's'}`
}
