import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Plus, CalendarDays } from 'lucide-react'
import { useAuth } from '../context/auth'
import { SchedulesTable } from '../components/schedules/SchedulesTable'
import { ConceptIcon } from '../components/ConceptIcon'
import { WhatIsThisDrawer } from '../components/WhatIsThisDrawer'

export function SchedulesListPage(): React.ReactElement | null {
  const { user } = useAuth()

  if (!user) return null

  return (
    <PageWrapper className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-base font-semibold"><ConceptIcon concept="Schedule" />Schedules</h1>
        <Link
          to="/app/schedules/new"
          className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New schedule
        </Link>
      </div>

      <WhatIsThisDrawer
        triggerLabel="What is a Schedule?"
        title={<><CalendarDays className="h-4 w-4" />Schedule</>}
        description="A training plan created by any user around a locked Subset. The user configures how many Runs to perform and, for each, the time limit and the suggested break before the next. Additional settings control the puzzle order across Runs and whether failed puzzles are retried within the same Run."
      />

      <SchedulesTable />
    </PageWrapper>
  )
}
