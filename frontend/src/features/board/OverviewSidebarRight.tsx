import * as React from 'react'
import { OverviewActionsSection } from './OverviewActionsSection'
import { OverviewAttemptHistoryTable } from './OverviewAttemptHistoryTable'
import type { OverviewAttemptHistoryRow } from './OverviewAttemptHistoryTable'

type OverviewSidebarRightProps = {
  isLoadingNextPuzzle: boolean
  onNextPuzzle: () => void
  onRetake: () => void
  historyRows: OverviewAttemptHistoryRow[]
  selectedAttemptId: number | null
  onSelectAttempt: (attemptId: number) => void
  nextPuzzleDisabledReason: string | null
  analyzeUrl: string | null
}

export function OverviewSidebarRight({
  isLoadingNextPuzzle,
  onNextPuzzle,
  onRetake,
  historyRows,
  selectedAttemptId,
  onSelectAttempt,
  nextPuzzleDisabledReason,
  analyzeUrl,
}: OverviewSidebarRightProps): React.ReactElement {
  return (
    <>
      <OverviewAttemptHistoryTable
        rows={historyRows}
        selectedAttemptId={selectedAttemptId}
        onSelectAttempt={onSelectAttempt}
      />
      <OverviewActionsSection
        nextPuzzleDisabledReason={nextPuzzleDisabledReason}
        isLoadingNextPuzzle={isLoadingNextPuzzle}
        gameUrl={analyzeUrl}
        onNextPuzzle={onNextPuzzle}
        onRetake={onRetake}
      />
    </>
  )
}


