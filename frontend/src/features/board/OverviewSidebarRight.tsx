import * as React from 'react'
import { api, type AttemptSpectateView, type SelectableUser } from '../../lib/api'
import { OverviewActionsSection } from './OverviewActionsSection'
import { OverviewAttemptHistoryTable } from './OverviewAttemptHistoryTable'
import type { OverviewAttemptHistoryRow } from './OverviewAttemptHistoryTable'

type OverviewSidebarRightProps = {
  isLoadingNextPuzzle: boolean
  onNextPuzzle: () => void
  onRetake: () => void
  historyRows: OverviewAttemptHistoryRow[]
  selectedAttemptId: number | null
  onSelectAttempt: (row: OverviewAttemptHistoryRow) => void
  onSpectateAttempt: (view: AttemptSpectateView, user: { displayName: string; avatarUrl: string | null }) => void
  onClearSpectate: () => void
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
  onSelectAttempt,
  onSpectateAttempt,
  onClearSpectate,
  nextPuzzleDisabledReason,
  analyzeUrl,
  trainingItemId,
  currentUser,
}: OverviewSidebarRightProps): React.ReactElement {
  const [spectatedAttemptId, setSpectatedAttemptId] = React.useState<number | null>(null)

  React.useEffect(() => {
    setSpectatedAttemptId(null)
  }, [currentUser.id])

  const enrichedHistoryRows = React.useMemo(
    () =>
      historyRows.map((r) => ({
        ...r,
        userId: currentUser.id,
        displayName: currentUser.displayName,
        avatarUrl: currentUser.avatarUrl,
      })),
    [historyRows, currentUser],
  )

  async function handleSelectRow(row: OverviewAttemptHistoryRow): Promise<void> {
    if (row.userId === currentUser.id) {
      setSpectatedAttemptId(null)
      onClearSpectate()
      onSelectAttempt(row)
      return
    }
    try {
      const view = await api.trainingItems.getSpectateView(trainingItemId, row.attemptId)
      setSpectatedAttemptId(row.attemptId)
      onSpectateAttempt(view, { displayName: row.displayName ?? '', avatarUrl: row.avatarUrl ?? null })
    } catch {
      // silently ignore; board stays as-is
    }
  }

  return (
    <>
      <div className="mt-4 flex flex-col gap-2">
        <OverviewAttemptHistoryTable
          trainingItemId={trainingItemId}
          initialRows={enrichedHistoryRows}
          currentUser={currentUser}
          selectedAttemptId={spectatedAttemptId ?? selectedAttemptId}
          onRowClick={(row) => void handleSelectRow(row)}
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
