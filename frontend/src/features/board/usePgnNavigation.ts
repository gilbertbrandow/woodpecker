import { useState, useMemo, useEffect } from 'react'
import type { RunTrainingItemAttemptView, TrainingItemMetaPgnDisplay, OverviewAttemptView } from '../../lib/api'
import { buildPgnDisplay } from './boardPage.helpers'
import type { Mode, PlySelection } from './boardPage.helpers'

type UsePgnNavigationParams = {
  mode: Mode
  solvingView: RunTrainingItemAttemptView | null
  session: {
    movesPlayed: string[]
    allPliesPlayed: string[]
    failedRetryPlies: string[]
    liveFocusStatus: 'in_progress' | 'solved' | 'failed'
  }
  selectedAttempt: OverviewAttemptView | null
  boardKey: number
  // When spectating another user's attempt, pass their pgnDisplay here so that
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
  selectedAttempt,
  boardKey,
  overviewPgnDisplayOverride,
}: UsePgnNavigationParams): PgnNavigationResult {
  const [selectedPly, setSelectedPly] = useState<PlySelection | null>(null)

  useEffect(() => {
    setSelectedPly(null)
  }, [boardKey])

  const focusPgnDisplay = useMemo((): TrainingItemMetaPgnDisplay | null => {
    if (mode !== 'focus' && mode !== 'failed') return null
    if (!solvingView) return null
    const moves =
      mode === 'focus' && session.liveFocusStatus === 'in_progress'
        ? session.allPliesPlayed
        : session.movesPlayed
    return buildPgnDisplay(
      solvingView.trainingItem.fen,
      moves,
      solvingView.trainingItem.solution,
      mode === 'failed' ? 'failed' : session.liveFocusStatus,
      mode === 'failed' ? session.failedRetryPlies : undefined,
      false,
    )
  }, [mode, solvingView, session])

  const overviewPgnDisplay: TrainingItemMetaPgnDisplay | null =
    overviewPgnDisplayOverride !== undefined
      ? overviewPgnDisplayOverride
      : (selectedAttempt?.pgnDisplay ?? null)

  const pgnDisplay = mode === 'overview' ? overviewPgnDisplay : focusPgnDisplay

  useEffect(() => {
    if (mode !== 'overview') return
    if (overviewPgnDisplay === null || overviewPgnDisplay.mainline.length === 0) {
      setSelectedPly(null)
      return
    }
    const lastMove = overviewPgnDisplay.mainline[overviewPgnDisplay.mainline.length - 1]
    if (lastMove.moveStatus === 'wrong') {
      if (overviewPgnDisplay.variation && overviewPgnDisplay.variation.length > 0) {
        setSelectedPly({ line: 'variation', index: overviewPgnDisplay.variation.length - 1 })
      } else if (overviewPgnDisplay.subvariations && overviewPgnDisplay.subvariations.length > 0) {
        // Decoy failed: subvariations hold each accepted move's line.
        // Prefer the one matching the retry move the user actually played; fall back to the first.
        const retryUci = session.failedRetryPlies[0] ?? null
        const matchIdx = retryUci !== null
          ? overviewPgnDisplay.subvariations.findIndex(sv => sv.length > 0 && sv[0].uci === retryUci)
          : -1
        setSelectedPly({ line: 'subvariation', subIndex: matchIdx >= 0 ? matchIdx : 0, index: 0 })
      } else {
        setSelectedPly(null)
      }
      return
    }
    let targetIndex = overviewPgnDisplay.mainline.length - 1
    while (targetIndex > 0 && overviewPgnDisplay.mainline[targetIndex].moveStatus === null) {
      targetIndex--
    }
    setSelectedPly({ line: 'main', index: targetIndex })
  }, [overviewPgnDisplay, mode, session.failedRetryPlies])

  const isAtHead =
    selectedPly === null ||
    (focusPgnDisplay !== null &&
      selectedPly.line === 'main' &&
      selectedPly.index === focusPgnDisplay.mainline.length - 1)

  return { pgnDisplay, selectedPly, setSelectedPly, isAtHead }
}
