import * as React from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/auth'
import { api, type Subset } from '../lib/api'
import { parseAvatarValue } from '../lib/avatar'
import { DefaultAvatar } from '../components/DefaultAvatar'
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '../components/ui/alert-dialog'

function SubsetAvatar({ username, avatarUrl }: { username: string; avatarUrl: string | null }): React.ReactElement {
  const avatarValue = parseAvatarValue(avatarUrl)
  if (avatarValue.type === 'custom') {
    return (
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={avatarValue.url} alt={`${username}'s avatar`} />
        <AvatarFallback>
          <DefaultAvatar username={username} className="h-8 w-8" />
        </AvatarFallback>
      </Avatar>
    )
  }
  return (
    <DefaultAvatar
      username={username}
      piece={avatarValue.type === 'default' ? avatarValue.piece : undefined}
      color={avatarValue.type === 'default' ? avatarValue.color : undefined}
      className="h-8 w-8 text-xs"
    />
  )
}

export function DashboardPage(): React.ReactElement | null {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [subsets, setSubsets] = useState<Subset[]>([])
  const [subsetsLoading, setSubsetsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)

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

  const handleDelete = async (subset: Subset): Promise<void> => {
    setDeletingId(subset.id)
    try {
      await api.subsets.delete(subset.id)
      setSubsets((prev) => prev.filter((s) => s.id !== subset.id))
      toast('Subset deleted', { description: `"${subset.name}" has been removed.` })
    } catch {
      toast.error('Failed to delete subset', { description: 'Please try again.' })
    } finally {
      setDeletingId(null)
    }
  }

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
        <div className="rounded-md border">
          <ul className="divide-y divide-border">
            {subsets.map((subset) => {
              const isOwn = subset.ownedBy.username === user.username
              return (
                <li key={subset.id} className="flex items-center gap-2 px-4">
                  <Link
                    to="/app/subsets/$subsetId"
                    params={{ subsetId: String(subset.id) }}
                    className="flex flex-1 items-center gap-4 py-3 min-w-0"
                  >
                    <SubsetAvatar username={subset.ownedBy.username} avatarUrl={subset.ownedBy.avatarUrl} />
                    <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                      <span className="truncate text-sm font-medium">{subset.name}</span>
                      <span className="text-xs text-muted-foreground capitalize">{subset.status} · {subset.puzzleCount} puzzles</span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(subset.createdAt).toLocaleDateString()}
                    </span>
                  </Link>
                  {isOwn && subset.status !== 'locked' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          disabled={deletingId !== null}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                          aria-label="Delete subset"
                        >
                          {deletingId === subset.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete subset?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{subset.name}" and all its puzzles will be permanently removed. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void handleDelete(subset)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
