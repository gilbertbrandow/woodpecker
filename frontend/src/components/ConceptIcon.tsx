import * as React from 'react'
import { Database, Library, CalendarDays, Puzzle, Flag } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'

export type Concept = 'Source' | 'Subset' | 'Schedule' | 'Training' | 'Run'

const CONCEPT_ICONS: Record<Concept, React.ComponentType<{ className?: string }>> = {
  Source: Database,
  Subset: Library,
  Schedule: CalendarDays,
  Training: Puzzle,
  Run: Flag,
}

export function ConceptIcon({ concept, className }: { concept: Concept; className?: string }): React.ReactElement {
  const Icon = CONCEPT_ICONS[concept]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0 items-center">
          <Icon className={className ?? 'h-4 w-4 text-muted-foreground'} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{concept}</TooltipContent>
    </Tooltip>
  )
}
