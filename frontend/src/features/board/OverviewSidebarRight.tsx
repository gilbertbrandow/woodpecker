import * as React from 'react'
import type { SelectableUser } from '../../lib/api'
import { OverviewActionsSection } from './OverviewActionsSection'
import { OverviewAttemptHistoryTable } from './OverviewAttemptHistoryTable'
import type { OverviewAttemptHistoryRow } from './OverviewAttemptHistoryTable'

type OverviewSidebarRightProps = {
  isLoadingNextPuzzle: boolean
  onNextPuzzle: () => void
  onRetake: () => void
  historyRows: OverviewAttemptHistoryRow[]
  selectedAttemptId: number | null
  onRowClick: (row: OverviewAttemptHistoryRow) => void
  onUserFilterChange?: (users: SelectableUser[]) => void
  nextPuzzleDisabledReason: string | null
  analyzeUrl: string | null
  trainingItemId: number
  currentUser: SelectableUser
}

export function OverviewSidebarRight({
  isLoadingNextPuzzle,
  onNextPuzzle,
  onRetake,
  historyRows,
  selectedAttemptId,
  onRowClick,
  onUserFilterChange,
  nextPuzzleDisabledReason,
  analyzeUrl,
  trainingItemId,
  currentUser,
}: OverviewSidebarRightProps): React.ReactElement {
  return (
    <>
      <div className="mt-4 flex flex-col gap-2">
        <OverviewAttemptHistoryTable
          trainingItemId={trainingItemId}
          initialRows={historyRows}
          currentUser={currentUser}
          selectedAttemptId={selectedAttemptId}
          onRowClick={onRowClick}
          onUserFilterChange={onUserFilterChange}
        />
      </div>
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
