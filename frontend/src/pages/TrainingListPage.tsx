import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Plus, Puzzle } from 'lucide-react'
import { useAuth } from '../context/auth'
import { TrainingTable } from '../components/participations/TrainingTable'
import { ConceptIcon } from '../components/ConceptIcon'
import { WhatIsThisDrawer } from '../components/WhatIsThisDrawer'

export function TrainingListPage(): React.ReactElement | null {
  const { user } = useAuth()

  if (!user) return null

  return (
    <PageWrapper className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-base font-semibold"><ConceptIcon concept="Training" />Training</h1>
        <Link
          to="/app/training/new"
          className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New training
        </Link>
      </div>

      <WhatIsThisDrawer
        triggerLabel="What is a Training?"
        title={<><Puzzle className="h-4 w-4" />Training</>}
        description="A user's active instance of working through a Schedule. Any user can create a Training from any existing Schedule, whether their own or another user's. It is through a Training that the user actually solves puzzles, by working through the Runs defined by the Schedule."
      />

      <TrainingTable />
    </PageWrapper>
  )
}
