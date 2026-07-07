import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { useAuth } from '../context/auth'
import { api, type Subset } from '../lib/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { UserAvatar } from '../components/UserAvatar'
import { DataTable } from '../components/DataTable'
import { DATA_ICONS } from '../lib/icons'

export function ScheduleNewPage(): React.ReactElement | null {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [selectedSubset, setSelectedSubset] = useState<Subset | null>(null)
  const [subsets, setSubsets] = useState<Subset[]>([])
  const [subsetsLoading, setSubsetsLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, loading, navigate])

  useEffect(() => {
    if (!user) return
    api.subsets
      .list({ lockedOnly: true })
      .then((r) => setSubsets(r.items))
      .catch(() => {})
      .finally(() => setSubsetsLoading(false))
  }, [user])

  if (loading || !user) return null

  const canSubmit = name.trim().length > 0 && selectedSubset !== null && !submitting

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit || selectedSubset === null) return
    setSubmitting(true)
    try {
      const schedule = await api.schedules.create(name.trim(), selectedSubset.id)
      void navigate({ to: '/app/schedules/$scheduleId', params: { scheduleId: String(schedule.id) } })
    } catch {
      setSubmitting(false)
    }
  }

  const selectedId = selectedSubset?.id ?? null

  const columns: ColumnDef<Subset>[] = useMemo(
    () => [
      {
        id: 'select',
        header: 'Selected',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="h-4 w-4 shrink-0 rounded-full border border-primary flex items-center justify-center">
            {row.original.id === selectedId && (
              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
            )}
          </div>
        ),
      },
      {
        id: 'owner',
        header: 'Owner',
        meta: { icon: DATA_ICONS.user },
        enableSorting: false,
        cell: ({ row }) => (
          <UserAvatar
            displayName={row.original.ownedBy.displayName}
            avatarUrl={row.original.ownedBy.avatarUrl}
          />
        ),
      },
      {
        accessorKey: 'name',
        header: 'Name',
        meta: { icon: DATA_ICONS.name },
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: 'puzzleCount',
        header: 'Puzzles',
        meta: { icon: DATA_ICONS.puzzles },
        accessorFn: (row) => row.puzzleCount,
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">{row.original.puzzleCount}</span>
        ),
      },
      {
        id: 'lockedAt',
        header: 'Locked',
        meta: { icon: DATA_ICONS.started },
        accessorFn: (row) => row.lockedAt ?? '',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.lockedAt
              ? new Date(row.original.lockedAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : '—'}
          </span>
        ),
      },
    ],
    [selectedId],
  )

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
<h1 className="mb-6 text-xl font-semibold">New schedule</h1>

      {!subsetsLoading && subsets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No locked subsets available. Subsets must be locked before they can be used in a schedule.
        </p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void handleSubmit() }} className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="schedule-name">
              Schedule name
            </label>
            <Input
              id="schedule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 5-cycle spaced repetition"
              maxLength={100}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Subset</label>
            {subsetsLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <DataTable
                tableId={false}
                columns={columns}
                data={subsets}
                globalFilterPlaceholder="Search subsets…"
                pageSize={8}
                onRowClick={(row) => setSelectedSubset(selectedSubset?.id === row.id ? null : row)}
                getRowClassName={(row) => row.id === selectedId ? 'bg-muted' : ''}
                emptyMessage="No locked subsets available."
              />
            )}
          </div>

          <Button type="submit" disabled={!canSubmit} className="self-start">
            {submitting ? 'Creating…' : 'Create schedule'}
          </Button>
        </form>
      )}
    </div>
  )
}
