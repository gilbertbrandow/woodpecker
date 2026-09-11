import { useState, useMemo, useEffect } from 'react'
import type { RunTrainingItemAttemptView, RunTrainingItemOverview, TrainingItemMetaPgnDisplay } from '../../lib/api'
import { buildLivePgnDisplay } from './boardPage.helpers'
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
    )
  }, [mode, solvingView, session])

  const overviewPgnDisplay: TrainingItemMetaPgnDisplay | null =
    overviewPgnDisplayOverride !== undefined
      ? overviewPgnDisplayOverride
      : (overview?.pgn ?? null)

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
    setSelectedPly({ line: 'main', index: targetIndex })
  }, [overviewPgnDisplay, mode, overview])

  const isAtHead =
    selectedPly === null ||
    (livePgnDisplay !== null &&
      selectedPly.line === 'main' &&
      selectedPly.index === livePgnDisplay.mainline.length - 1)

  return { pgnDisplay, selectedPly, setSelectedPly, isAtHead }
}
