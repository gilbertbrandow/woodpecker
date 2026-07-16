import * as React from 'react'
import { useState } from 'react'
import { LibraryBig } from 'lucide-react'
import { api, type SelectableSubset } from '../lib/api'
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover'
import { EntitySelectorContent } from './EntitySelectorContent'
import { SelectorTrigger } from './SelectorTrigger'

// ---------------------------------------------------------------------------
// Exported content component — renders the Command palette without a trigger.
// Use this when embedding inside another Popover (e.g. a filter chip).
// ---------------------------------------------------------------------------
export function SubsetSelectorContent({
  value,
  onChange,
}: {
  value: SelectableSubset[]
  onChange: (items: SelectableSubset[]) => void
}): React.ReactElement {
  return (
    <EntitySelectorContent
      value={value}
      onChange={onChange}
      fetchResults={api.subsets.search}
      fetchSuggestions={api.subsets.suggest}
      placeholder="Search subsets…"
      hintText="Search to find any subset"
      noResultsText="No subsets found."
      getDisplay={(s) => ({
        label: s.name,
        meta: s.status,
        chipIcon: <LibraryBig className="h-3 w-3 shrink-0 text-muted-foreground" />,
        resultIcon: <LibraryBig className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />,
      })}
    />
  )
}

// ---------------------------------------------------------------------------
// Full standalone component — trigger button + popover wrapping the content.
// ---------------------------------------------------------------------------
export function SubsetSelector({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: SelectableSubset[]
  onChange: (items: SelectableSubset[]) => void
  disabled?: boolean
  className?: string
}): React.ReactElement {
  const [open, setOpen] = useState(false)

  const label =
    value.length === 0
      ? null
      : value.length === 1
        ? value[0].name
        : `${value.length} subsets`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SelectorTrigger open={open} disabled={disabled} className={className}>
          {label ? (
            <span className="text-foreground">{label}</span>
          ) : (
            <span className="text-muted-foreground">All subsets</span>
          )}
        </SelectorTrigger>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0" align="start">
        <SubsetSelectorContent value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  )
}
