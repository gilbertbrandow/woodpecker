import { useState, useMemo, useEffect } from 'react'
import type { RunTrainingItemAttemptView, RunTrainingItemOverview, TrainingItemMetaPgnDisplay } from '../../lib/api'
import { buildFocusPgnDisplay, buildLiveSolvingPgnDisplay } from './boardPage.helpers'
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

  const focusPgnDisplay = useMemo((): TrainingItemMetaPgnDisplay | null => {
    if (mode !== 'focus') return null
    if (!solvingView) return null
    // While in_progress: plain correct-moves display.
    // Once liveFocusStatus is 'failed' (wrong move played, board reverting):
    // show the wrong move immediately as a provisional mainline entry with ??.
    if (session.liveFocusStatus !== 'failed') {
      return buildFocusPgnDisplay(solvingView.trainingItem.fen, session.allPliesPlayed)
    }
    const firstWrongMove = session.movesPlayed[session.movesPlayed.length - 1]
    if (!firstWrongMove) return buildFocusPgnDisplay(solvingView.trainingItem.fen, session.allPliesPlayed)
    return buildLiveSolvingPgnDisplay(
      solvingView.trainingItem.fen,
      session.allPliesPlayed,
      firstWrongMove,
      [],
      [],
    )
  }, [mode, solvingView, session])

  // In failed (retry) mode, build a live PGN from the retry session.
  // W1 (session.movesPlayed[session.movesPlayed.length - 1]) holds the provisional mainline slot until
  // the correct move is played; subsequent wrong moves become subvariations.
  const failedFocusPgnDisplay = useMemo((): TrainingItemMetaPgnDisplay | null => {
    if (mode !== 'failed') return null
    if (!solvingView) return null
    const firstWrongMove = session.movesPlayed[session.movesPlayed.length - 1]
    if (!firstWrongMove) return null
    return buildLiveSolvingPgnDisplay(
      solvingView.trainingItem.fen,
      session.allPliesPlayed,
      firstWrongMove,
      session.failedRetryPlies,
      session.failedModeWrongMoves,
    )
  }, [mode, solvingView, session])

  const overviewPgnDisplay: TrainingItemMetaPgnDisplay | null =
    overviewPgnDisplayOverride !== undefined
      ? overviewPgnDisplayOverride
      : (overview?.pgn ?? null)

  const pgnDisplay = mode === 'overview'
    ? overviewPgnDisplay
    : mode === 'failed'
      ? failedFocusPgnDisplay
      : focusPgnDisplay

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
    setSelectedPly({ line: 'main', index: targetIndex })
  }, [overviewPgnDisplay, mode, overview])

  const isAtHead =
    selectedPly === null ||
    (focusPgnDisplay !== null &&
      selectedPly.line === 'main' &&
      selectedPly.index === focusPgnDisplay.mainline.length - 1)

  return { pgnDisplay, selectedPly, setSelectedPly, isAtHead }
}
