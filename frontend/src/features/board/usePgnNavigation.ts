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

  const overviewPgnDisplay: TrainingItemMetaPgnDisplay | null = selectedAttempt?.pgnDisplay ?? null

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
      } else {
        setSelectedPly(null)
      }
      return
    }
    setSelectedPly({ line: 'main', index: overviewPgnDisplay.mainline.length - 1 })
  }, [overviewPgnDisplay, mode])

  const isAtHead =
    selectedPly === null ||
    (focusPgnDisplay !== null &&
      selectedPly.line === 'main' &&
      selectedPly.index === focusPgnDisplay.mainline.length - 1)

  return { pgnDisplay, selectedPly, setSelectedPly, isAtHead }
}
