import * as React from 'react'
import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { api, type SelectableSchedule } from '../lib/api'
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover'
import { EntitySelectorContent } from './EntitySelectorContent'
import { SelectorTrigger } from './SelectorTrigger'

// ---------------------------------------------------------------------------
// Exported content component — renders the Command palette without a trigger.
// Use this when embedding inside another Popover (e.g. a filter chip).
// ---------------------------------------------------------------------------
export function ScheduleSelectorContent({
  value,
  onChange,
}: {
  value: SelectableSchedule[]
  onChange: (items: SelectableSchedule[]) => void
}): React.ReactElement {
  return (
    <EntitySelectorContent
      value={value}
      onChange={onChange}
      fetchResults={api.schedules.search}
      fetchSuggestions={api.schedules.suggest}
      placeholder="Search schedules…"
      hintText="Search to find any schedule"
      noResultsText="No schedules found."
      getDisplay={(s) => ({
        label: s.name,
        meta: s.status,
        chipIcon: <CalendarDays className="h-3 w-3 shrink-0 text-muted-foreground" />,
        resultIcon: <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />,
      })}
    />
  )
}

// ---------------------------------------------------------------------------
// Full standalone component — trigger button + popover wrapping the content.
// ---------------------------------------------------------------------------
export function ScheduleSelector({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: SelectableSchedule[]
  onChange: (items: SelectableSchedule[]) => void
  disabled?: boolean
  className?: string
}): React.ReactElement {
  const [open, setOpen] = useState(false)

  const label =
    value.length === 0
      ? null
      : value.length === 1
        ? value[0].name
        : `${value.length} schedules`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SelectorTrigger open={open} disabled={disabled} className={className}>
          {label ? (
            <span className="text-foreground">{label}</span>
          ) : (
            <span className="text-muted-foreground">All schedules</span>
          )}
        </SelectorTrigger>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0" align="start">
        <ScheduleSelectorContent value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  )
}
