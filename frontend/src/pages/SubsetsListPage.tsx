import * as React from 'react'
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/auth'
import { api, type Subset } from '../lib/api'
import { SubsetsTable } from '../components/subsets/SubsetsTable'

export function SubsetsListPage(): React.ReactElement | null {
  const { user } = useAuth()
  const [subsets, setSubsets] = useState<Subset[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    api.subsets
      .list()
      .then(setSubsets)
      .catch(() => toast.error('Failed to load subsets', { description: 'Could not fetch subsets.' }))
      .finally(() => setLoading(false))
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

  if (!user) return null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Subsets</h1>
        <Link
          to="/app/subsets/new"
          className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New subset
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : subsets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No subsets yet. Create one to get started.</p>
      ) : (
        <SubsetsTable
          subsets={subsets}
          currentUsername={user.username}
          deletingId={deletingId}
          onDelete={(s) => void handleDelete(s)}
        />
      )}
    </div>
  )
}
