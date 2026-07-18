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
}: OverviewSidebarRightProps): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2">
          {topSlot}
          <OverviewAttemptHistoryTable
            trainingItemId={trainingItemId}
            currentUser={currentUser}
            selectedAttemptId={selectedAttemptId}
            onRowClick={onRowClick}
            onUserFilterChange={onUserFilterChange}
          />
        </div>
      </div>
      <OverviewActionsSection
        nextPuzzleDisabledReason={nextPuzzleDisabledReason}
        isLoadingNextPuzzle={isLoadingNextPuzzle}
        gameUrl={analyzeUrl}
        onNextPuzzle={onNextPuzzle}
        onRetake={onRetake}
      />
    </div>
  )
}
