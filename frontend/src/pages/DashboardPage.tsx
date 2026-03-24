import * as React from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/auth'
import { api, type Subset } from '../lib/api'
import { DefaultAvatar } from '../components/DefaultAvatar'

export function DashboardPage(): React.ReactElement | null {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [subsets, setSubsets] = useState<Subset[]>([])
  const [subsetsLoading, setSubsetsLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, loading, navigate])

  useEffect(() => {
    if (!user) return
    api.subsets
      .list()
      .then(setSubsets)
      .catch(() => toast.error('Failed to load subsets', { description: 'Could not fetch your subsets.' }))
      .finally(() => setSubsetsLoading(false))
  }, [user])

  if (loading || !user) return null

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Subsets</h1>
        <Link
          to="/app/subsets/new"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          New subset
        </Link>
      </div>

      {subsetsLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : subsets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No subsets yet. Create one to get started.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {subsets.map((subset) => (
            <li key={subset.id}>
              <Link
                to="/app/subsets/$subsetId"
                params={{ subsetId: String(subset.id) }}
                className="flex items-center gap-4 py-3 hover:bg-accent/50 -mx-2 px-2 rounded-sm transition-colors"
              >
                <DefaultAvatar username={user.username} className="h-8 w-8 text-xs" />
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                  <span className="truncate text-sm font-medium">{subset.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">{subset.status} · {subset.puzzleCount} puzzles</span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(subset.createdAt).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
