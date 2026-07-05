import * as React from 'react'
import { api, type AttemptHistoryRow, type AttemptSpectateView, type SelectableUser } from '../../lib/api'
import { UserSelector } from '../../components/UserSelector'
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
  const [selectedUsers, setSelectedUsers] = React.useState<SelectableUser[]>([currentUser])
  const [allUsersRows, setAllUsersRows] = React.useState<OverviewAttemptHistoryRow[] | null>(null)
  const [isLoadingAllUsers, setIsLoadingAllUsers] = React.useState(false)
  const [spectatedAttemptId, setSpectatedAttemptId] = React.useState<number | null>(null)

  React.useEffect(() => {
    setSelectedUsers([currentUser])
    setAllUsersRows(null)
    setSpectatedAttemptId(null)
  }, [trainingItemId, currentUser.id])

  const isMyDataOnly = selectedUsers.length === 1 && selectedUsers[0].id === currentUser.id

  async function handleUsersChange(users: SelectableUser[]): Promise<void> {
    setSelectedUsers(users)
    const nextIsMyDataOnly = users.length === 1 && users[0].id === currentUser.id
    if (nextIsMyDataOnly) {
      setSpectatedAttemptId(null)
      onClearSpectate()
      return
    }
    if (allUsersRows !== null) return
    setIsLoadingAllUsers(true)
    try {
      const { attempts } = await api.trainingItems.getAttemptHistory(trainingItemId)
      setAllUsersRows(
        attempts.map((a: AttemptHistoryRow) => ({
          attemptId: a.attemptId,
          runId: 0,
          runLabel: `Run ${a.runIndex + 1}`,
          runOrder: a.runIndex,
          runTrainingItemId: 0,
          tryNumber: a.tryNumber,
          countsTowardsTraining: a.countsTowardsTraining,
          result: a.result,
          timeSpentMs: a.timeSpentMs,
          userId: a.userId,
          displayName: a.displayName,
          avatarUrl: a.avatarUrl,
        })),
      )
    } finally {
      setIsLoadingAllUsers(false)
    }
  }

  async function handleSelectRow(attemptId: number): Promise<void> {
    if (isMyDataOnly) {
      onSelectAttempt(attemptId)
      return
    }
    const row = activeRows.find((r) => r.attemptId === attemptId)
    if (!row) return
    if (row.userId === currentUser.id) {
      setSpectatedAttemptId(null)
      onClearSpectate()
      onSelectAttempt(attemptId)
      return
    }
    try {
      const view = await api.trainingItems.getSpectateView(trainingItemId, attemptId)
      setSpectatedAttemptId(attemptId)
      onSpectateAttempt(view, { displayName: row.displayName ?? '', avatarUrl: row.avatarUrl ?? null })
    } catch {
      // silently ignore; board stays as-is
    }
  }

  const filteredAllUsersRows = React.useMemo((): OverviewAttemptHistoryRow[] => {
    if (allUsersRows === null) return []
    if (selectedUsers.length === 0) return allUsersRows
    const ids = new Set(selectedUsers.map((u) => u.id))
    return allUsersRows.filter((r) => r.userId !== undefined && ids.has(r.userId))
  }, [allUsersRows, selectedUsers])

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

  const activeRows = isMyDataOnly ? enrichedHistoryRows : filteredAllUsersRows

  return (
    <>
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Previous attempts</span>
          <UserSelector value={selectedUsers} onChange={(u) => void handleUsersChange(u)} />
        </div>
        {isLoadingAllUsers ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <OverviewAttemptHistoryTable
            rows={activeRows}
            selectedAttemptId={spectatedAttemptId ?? selectedAttemptId}
            onSelectAttempt={(id) => void handleSelectRow(id)}
          />
        )}
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
