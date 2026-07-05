import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { Database, Library, CalendarDays, Puzzle, Flag } from 'lucide-react'

type Concept = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

const CONCEPTS: Concept[] = [
  {
    icon: Database,
    title: 'Sources',
    description:
      'A named external puzzle database and the origin of all puzzles that can be included in a Subset. Each source defines its own solving conditions, what constitutes a correct solution is source-specific, not universal.',
  },
  {
    icon: Library,
    title: 'Subsets',
    description:
      'A user-curated, fixed collection of puzzles drawn from any Source. Any user can create a Subset by configuring a source composition with filters, filling it from that configuration, then locking it. Once locked it is public and visible to all users and available to be used in a Schedule.',
  },
  {
    icon: CalendarDays,
    title: 'Schedules',
    description:
      'A training plan created by any user around a locked Subset. The user configures how many Runs to perform and, for each, the time limit and the suggested break before the next. Additional settings control the puzzle order across Runs and whether failed puzzles are retried within the same Run.',
  },
  {
    icon: Puzzle,
    title: 'Trainings',
    description:
      'A user\'s active instance of working through a Schedule. Any user can create a Training from any existing Schedule, whether their own or another user\'s. It is through a Training that the user actually solves puzzles, by working through the Runs defined by the Schedule.',
  },
  {
    icon: Flag,
    title: 'Runs',
    description:
      'One complete pass through every puzzle in the Subset defined by the Training\'s Schedule. Every Run in a Training contains the same full set of puzzles, presented in the order configured by the Schedule.'
  },
]

export function GuidePage(): React.ReactElement {
  return (
    <PageWrapper className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">How does it work?</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Woodpecker is built around one idea: solve the same puzzles repeatedly until the patterns become automatic.
          This page explains the five concepts that make up the system.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONCEPTS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex flex-col gap-2 rounded-md border border-border p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">{title}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>
    </PageWrapper>
  )
}
