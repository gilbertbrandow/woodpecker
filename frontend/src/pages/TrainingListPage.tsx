import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useAuth } from '../context/auth'
import { TrainingTable } from '../components/participations/TrainingTable'

export function TrainingListPage(): React.ReactElement | null {
  const { user } = useAuth()

  if (!user) return null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Training</h1>
        <Link
          to="/app/training/new"
          className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New training
        </Link>
      </div>
      <TrainingTable />
    </div>
  )
}
