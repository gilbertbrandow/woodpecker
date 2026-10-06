import { useState, useMemo, useEffect } from 'react'
import type { RunTrainingItemAttemptView, RunTrainingItemOverview, TrainingItemMetaPgnDisplay } from '../../lib/api'
import { buildLivePgnDisplay, buildContextMoves } from './boardPage.helpers'
import type { Mode, PlySelection, FailedModeWrongMove } from './boardPage.helpers'

type UsePgnNavigationParams = {
  mode: Mode
  solvingView: RunTrainingItemAttemptView | null
  session: {
    allPliesPlayed: string[]
    movesPlayed: string[]
    failedRetryPlies: string[]
    failedModeWrongMoves: FailedModeWrongMove[]
    liveFocusStatus: 'in_progress' | 'solved' | 'failed'
  }
  overview: RunTrainingItemOverview | null
  boardKey: number
  // When spectating another user's attempt, pass their pgn here so that
  // selectedPly auto-selection and navigation operate on the correct PGN.
  overviewPgnDisplayOverride?: TrainingItemMetaPgnDisplay | null
}

export type PgnNavigationResult = {
  pgnDisplay: TrainingItemMetaPgnDisplay | null
  selectedPly: PlySelection | null
  setSelectedPly: (ply: PlySelection | null) => void
  isAtHead: boolean
}

export function usePgnNavigation({
  mode,
  solvingView,
  session,
  overview,
  boardKey,
  overviewPgnDisplayOverride,
}: UsePgnNavigationParams): PgnNavigationResult {
  const [selectedPly, setSelectedPly] = useState<PlySelection | null>(null)

  useEffect(() => {
    setSelectedPly(null)
  }, [boardKey])

  const livePgnDisplay = useMemo((): TrainingItemMetaPgnDisplay | null => {
    if (mode === 'overview') return null
    if (!solvingView) return null
    const hasWrongMove = mode === 'failed' || session.liveFocusStatus === 'failed'
    const firstWrongMove = hasWrongMove
      ? (session.movesPlayed[session.movesPlayed.length - 1] ?? undefined)
      : undefined
    return buildLivePgnDisplay(
      solvingView.trainingItem.fen,
      session.allPliesPlayed,
      firstWrongMove,
      mode === 'failed' ? session.failedRetryPlies : [],
      mode === 'failed' ? session.failedModeWrongMoves : [],
      solvingView.trainingItem.prelude,
    )
  }, [mode, solvingView, session])

  const overviewPgnDisplay = useMemo((): TrainingItemMetaPgnDisplay | null => {
    const raw = overviewPgnDisplayOverride !== undefined
      ? overviewPgnDisplayOverride
      : (overview?.pgn ?? null)
    if (raw === null) return null
    // Always take the prelude from the overview: solvingView can still hold the
    // last puzzle that was played (e.g. after navigating back via the attempt
    // strip), and its game moves would be prepended to this puzzle's PGN.
    const prelude = overview?.trainingItem.prelude ?? []
    if (prelude.length === 0) return raw
    const contextMoves = buildContextMoves(prelude)
    return contextMoves.length > 0 ? { ...raw, mainline: [...contextMoves, ...raw.mainline] } : raw
  }, [overview, overviewPgnDisplayOverride])

  const pgnDisplay = mode === 'overview' ? overviewPgnDisplay : livePgnDisplay

  useEffect(() => {
    if (mode !== 'overview') return
    if (overviewPgnDisplay === null || overviewPgnDisplay.mainline.length === 0) {
      setSelectedPly(null)
      return
    }
    let targetIndex = overviewPgnDisplay.mainline.length - 1
    while (targetIndex > 0 && overviewPgnDisplay.mainline[targetIndex].moveStatus === null) {
      targetIndex--
    }
    // Walk back past context moves too — auto-select the last actual solving move.
    while (targetIndex > 0 && overviewPgnDisplay.mainline[targetIndex].moveStatus === 'context') {
      targetIndex--
    }
    setSelectedPly({ line: 'main', index: targetIndex })
  }, [overviewPgnDisplay, mode, overview])

  // Reset to head whenever we enter failed mode so a stale selectedPly from
  // focus-mode navigation doesn't leave isAtHead false (disabling Hint/Solution).
  useEffect(() => {
    if (mode === 'failed') setSelectedPly(null)
  }, [mode])

  const lastLiveIdx = (livePgnDisplay?.mainline.length ?? 0) - 1
  const liveLastMoveIsWrong = livePgnDisplay !== null && livePgnDisplay.mainline[lastLiveIdx]?.moveStatus === 'wrong'
  // Index of the ply whose position is the live board (a reverted wrong move sits after it).
  const liveHeadIdx: number | null =
    livePgnDisplay === null ? null
    : liveLastMoveIsWrong ? (lastLiveIdx >= 1 ? lastLiveIdx - 1 : null)
    : lastLiveIdx

  // Browsing the PGN back to the head leaves an explicit selection on that ply
  // rather than null. When a move then advances the head, that selection would
  // pin the board to the old position (#406), so follow the head instead.
  // Compared by index: `session` is a fresh object every render.
  const [prevLiveHeadIdx, setPrevLiveHeadIdx] = useState<number | null>(liveHeadIdx)
  if (liveHeadIdx !== prevLiveHeadIdx) {
    setPrevLiveHeadIdx(liveHeadIdx)
    if (mode !== 'overview' && selectedPly?.line === 'main' && selectedPly.index === prevLiveHeadIdx) {
      setSelectedPly(null)
    }
  }

  const isAtHead =
    selectedPly === null ||
    (liveHeadIdx !== null && selectedPly.line === 'main' && selectedPly.index === liveHeadIdx)

  return { pgnDisplay, selectedPly, setSelectedPly, isAtHead }
}
