import { PageWrapper } from '../components/PageWrapper'
import { UserAvatar } from '../components/UserAvatar'
import * as React from 'react'
import { CONCEPT_ICONS } from '../lib/icons'

type FlowStep = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  detail: string
}

type Flow = {
  displayName: string
  avatarUrl: string
  context: string
  steps: FlowStep[]
}

const FLOWS: Flow[] = [
  {
    displayName: 'Alice',
    avatarUrl: 'default:bq:crimson:alpha',
    context: 'Creates her own Subset with exactly the puzzles she wants and sets up a Schedule that works for her.',
    steps: [
      { icon: CONCEPT_ICONS.Subset, label: 'Creates "Alice\'s Subset"', detail: '250 puzzles: 70% Lichess Tactics (rating 1800–2200), 20% Scraped Positional (medium difficulty), 10% Decoys. Locks it.' },
      { icon: CONCEPT_ICONS.Schedule, label: 'Creates "Alice\'s Schedule"', detail: 'Uses "Alice\'s Subset". 4 runs with tightening time limits: 1 week, 4 days, 2 days, 1 day. 1 day break between each run. Random order of puzzles each run.' },
      { icon: CONCEPT_ICONS.Training, label: 'Starts new training', detail: 'Using "Alice\'s Schedule"' },
      { icon: CONCEPT_ICONS.Run, label: 'Runs', detail: 'Run 1 created as soon as training start, others after completion.' },
    ],
  },
  {
    displayName: 'Bob',
    avatarUrl: 'default:bk:navy:merida',
    context: 'Uses Alice\'s Subset and Schedule by simply starting a Training from Alice\'s existing Schedule.',
    steps: [
      { icon: CONCEPT_ICONS.Training, label: 'Starts new training', detail: 'Using "Alice\'s Schedule"' },
      { icon: CONCEPT_ICONS.Run, label: 'Runs', detail: 'Run 1 created as soon as training start, others after completion.' },
    ],
  },
  {
    displayName: 'Carol',
    avatarUrl: 'default:bb:amber:anarcandy',
    context: 'Wants to train on Alice\'s Subset but prefers her own Schedule with different run lengths and ordering.',
    steps: [
      { icon: CONCEPT_ICONS.Schedule, label: 'Creates "Carol\'s Schedule"', detail: 'Uses "Alice\'s Subset". 5 runs with tightening time limits: 2 weeks, 1 week, 4 days, 2 days, 1 day. 1 day break between each run. Puzzles ordered by rating each run.' },
      { icon: CONCEPT_ICONS.Training, label: 'Starts new training', detail: 'Using "Carol\'s Schedule"' },
      { icon: CONCEPT_ICONS.Run, label: 'Runs', detail: 'Run 1 created as soon as training start, others after completion.' },
    ],
  },
]

type Concept = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

const CONCEPTS: Concept[] = [
  {
    icon: CONCEPT_ICONS.Source,
    title: 'Sources',
    description:
      'A named external puzzle database and the origin of all puzzles that can be included in a Subset. Each source defines its own solving conditions, what constitutes a correct solution is source-specific, not universal.',
  },
  {
    icon: CONCEPT_ICONS.Subset,
    title: 'Subsets',
    description:
      'A user-curated, fixed collection of puzzles drawn from any Source. Any user can create a Subset by configuring a source composition with filters, filling it from that configuration, then locking it. Once locked it is public and visible to all users and available to be used in a Schedule.',
  },
  {
    icon: CONCEPT_ICONS.Schedule,
    title: 'Schedules',
    description:
      'A training plan created by any user around a locked Subset. The user configures how many Runs to perform and, for each, the time limit and the suggested break before the next. Additional settings control the puzzle order across Runs and whether failed puzzles are retried within the same Run.',
  },
  {
    icon: CONCEPT_ICONS.Training,
    title: 'Trainings',
    description:
      'A user\'s active instance of working through a Schedule. Any user can create a Training from any existing Schedule, whether their own or another user\'s. It is through a Training that the user actually solves puzzles, by working through the Runs defined by the Schedule.',
  },
  {
    icon: CONCEPT_ICONS.Run,
    title: 'Runs',
    description:
      'One complete pass through every puzzle in the Subset defined by the Training\'s Schedule. Every Run in a Training contains the same full set of puzzles, presented in the order configured by the Schedule.',
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
        <h2 className="text-base font-semibold">Concepts</h2>
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

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">Examples</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FLOWS.map((flow) => (
            <div key={flow.displayName} className="flex flex-col gap-4 rounded-md border border-border p-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <UserAvatar displayName={flow.displayName} avatarUrl={flow.avatarUrl} className="h-5 w-5" />
                  <span className="text-sm font-medium">{flow.displayName}</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{flow.context}</p>
              </div>
              <div className="flex flex-col">
                {flow.steps.map((step, i) => (
                  <div key={step.label + i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
                        <step.icon className="h-3.5 w-3.5 text-foreground" />
                      </div>
                      {i < flow.steps.length - 1 && (
                        <div className="my-1 w-px flex-1 bg-border" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="text-xs font-medium leading-6">{step.label}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </PageWrapper>
  )
}
