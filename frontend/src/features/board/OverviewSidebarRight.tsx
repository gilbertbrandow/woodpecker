import * as React from 'react'
import type { SelectableUser } from '../../lib/api'
import { OverviewActionsSection } from './OverviewActionsSection'
import { OverviewAttemptHistoryTable } from './OverviewAttemptHistoryTable'
import type { OverviewAttemptHistoryRow } from './OverviewAttemptHistoryTable'

type OverviewSidebarRightProps = {
  isLoadingNextPuzzle: boolean
  onNextPuzzle: () => void
  onRetake: () => void
  selectedAttemptId: number | null
  onRowClick: (row: OverviewAttemptHistoryRow) => void
  onUserFilterChange?: (users: SelectableUser[]) => void
  nextPuzzleDisabledReason: string | null
  analyzeUrl: string | null
  trainingItemId: number
  currentUser: SelectableUser
  topSlot?: React.ReactNode
  showTable: boolean
}

export function OverviewSidebarRight({
  isLoadingNextPuzzle,
  onNextPuzzle,
  onRetake,
  selectedAttemptId,
  onRowClick,
  onUserFilterChange,
  nextPuzzleDisabledReason,
  analyzeUrl,
  trainingItemId,
  currentUser,
  topSlot,
  showTable,
}: OverviewSidebarRightProps): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {topSlot != null && (
        <div className="min-h-0 overflow-y-auto">
          {topSlot}
        </div>
      )}
      {showTable && (
        <div className="mt-2 shrink-0">
          <OverviewAttemptHistoryTable
            trainingItemId={trainingItemId}
            currentUser={currentUser}
            selectedAttemptId={selectedAttemptId}
            onRowClick={onRowClick}
            onUserFilterChange={onUserFilterChange}
          />
        </div>
      )}
      <div className="flex-1" />
      <div className="shrink-0">
        <OverviewActionsSection
          nextPuzzleDisabledReason={nextPuzzleDisabledReason}
          isLoadingNextPuzzle={isLoadingNextPuzzle}
          gameUrl={analyzeUrl}
          onNextPuzzle={onNextPuzzle}
          onRetake={onRetake}
        />
      </div>
    </div>
  )
}
