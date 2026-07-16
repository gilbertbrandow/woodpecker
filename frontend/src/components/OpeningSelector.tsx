import * as React from 'react'
import { useState, useEffect } from 'react'
import { BookOpen, X } from 'lucide-react'
import { api, type Opening } from '../lib/api'
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover'
import { SelectorTrigger } from './SelectorTrigger'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from './ui/command'

// ---------------------------------------------------------------------------
// Exported content component — renders the Command palette without a trigger.
// Use this when embedding inside another Popover (e.g. a filter chip).
// ---------------------------------------------------------------------------
const SUGGESTION_COUNT = 5

export function OpeningSelectorContent({
  value,
  onChange,
}: {
  value: Opening[]
  onChange: (items: Opening[]) => void
}): React.ReactElement {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Opening[]>([])
  const [results, setResults] = useState<Opening[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    api.openings.search('').then((r) => setSuggestions(r.slice(0, SUGGESTION_COUNT))).catch(() => {})
  }, [])

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    api.openings.search(query)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setSearching(false))
  }, [query])

  const selectedNames = new Set(value.map((o) => o.name))
  const isSearching = query.length >= 2
  const visibleSuggestions = suggestions.filter((s) => !selectedNames.has(s.name))
  const filteredResults = results.filter((r) => !selectedNames.has(r.name))

  const toggle = (opening: Opening): void => {
    if (selectedNames.has(opening.name)) {
      onChange(value.filter((o) => o.name !== opening.name))
    } else {
      onChange([...value, opening])
    }
  }

  return (
    <Command shouldFilter={false}>
      <CommandInput placeholder="Search openings…" value={query} onValueChange={setQuery} />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b px-2 py-2">
          {value.map((o) => (
            <span
              key={o.name}
              className="flex items-center overflow-hidden rounded-full bg-muted pl-2 pr-2 text-xs"
            >
              <BookOpen className="mr-1 h-3 w-3 shrink-0 text-muted-foreground" />
              <span>{o.displayName ?? o.name}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v.name !== o.name))}
                className="ml-1 rounded-full hover:text-foreground"
                aria-label={`Remove ${o.displayName ?? o.name}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <CommandList>
        {!isSearching ? (
          visibleSuggestions.length > 0 ? (
            <CommandGroup heading="Suggestions">
              {visibleSuggestions.map((o) => (
                <CommandItem key={o.name} value={o.name} onSelect={() => toggle(o)}>
                  <BookOpen className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1">{o.displayName ?? o.name}</span>
                  {o.eco && (
                    <span className="ml-2 text-xs text-muted-foreground">{o.eco}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : (
            <CommandEmpty>Type to search openings.</CommandEmpty>
          )
        ) : searching ? (
          <CommandEmpty>Searching…</CommandEmpty>
        ) : filteredResults.length === 0 ? (
          <CommandEmpty>No openings found.</CommandEmpty>
        ) : (
          <CommandGroup heading="Results">
            {filteredResults.map((o) => (
              <CommandItem key={o.name} value={o.name} onSelect={() => toggle(o)}>
                <BookOpen className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">{o.displayName ?? o.name}</span>
                {o.eco && (
                  <span className="ml-2 text-xs text-muted-foreground">{o.eco}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )
}

// ---------------------------------------------------------------------------
// Full standalone component — trigger button + popover wrapping the content.
// ---------------------------------------------------------------------------
export function OpeningSelector({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: Opening[]
  onChange: (items: Opening[]) => void
  disabled?: boolean
  className?: string
}): React.ReactElement {
  const [open, setOpen] = useState(false)

  const label =
    value.length === 0
      ? null
      : value.length === 1
        ? (value[0].displayName ?? value[0].name)
        : `${value.length} openings`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SelectorTrigger open={open} disabled={disabled} className={className}>
          {label ? (
            <span className="text-foreground">{label}</span>
          ) : (
            <span className="text-muted-foreground">All openings</span>
          )}
        </SelectorTrigger>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <OpeningSelectorContent value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  )
}
