import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Plus, Library } from 'lucide-react'
import { useAuth } from '../context/auth'
import { SubsetsTable } from '../components/subsets/SubsetsTable'
import { ConceptIcon } from '../components/ConceptIcon'
import { WhatIsThisDrawer } from '../components/WhatIsThisDrawer'

export function SubsetsListPage(): React.ReactElement | null {
  const { user } = useAuth()

  if (!user) return null

  return (
    <PageWrapper className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-base font-semibold"><ConceptIcon concept="Subset" />Subsets</h1>
        <Link
          to="/app/subsets/new"
          className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New subset
        </Link>
      </div>

      <WhatIsThisDrawer
        triggerLabel="What is a Subset?"
        title={<><Library className="h-4 w-4" />Subset</>}
        description="A user-curated, fixed collection of puzzles drawn from any Source. Any user can create a Subset by configuring a source composition with filters, filling it from that configuration, then locking it. Once locked it is public and visible to all users and available to be used in a Schedule."
      />

      <SubsetsTable />
    </PageWrapper>
  )
}
