import * as React from 'react'
import { useState, useEffect, useCallback } from 'react'
import { X, ChevronsUpDown, CalendarDays } from 'lucide-react'
import { api, type SelectableSchedule } from '../lib/api'
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from './ui/command'
import { cn } from '../lib/utils'
import { useDebounce } from '../hooks/useDebounce'

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
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SelectableSchedule[]>([])
  const [searching, setSearching] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    api.schedules
      .list({ search: debouncedQuery, pageSize: 10 })
      .then((r) => {
        if (!cancelled)
          setResults(r.items.map((s) => ({ id: s.id, name: s.name, status: s.status })))
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSearching(false) })
    return () => { cancelled = true }
  }, [debouncedQuery])

  const toggle = useCallback(
    (item: SelectableSchedule) => {
      const already = value.some((s) => s.id === item.id)
      onChange(already ? value.filter((s) => s.id !== item.id) : [...value, item])
    },
    [value, onChange],
  )

  const remove = useCallback(
    (id: number, e: React.MouseEvent) => {
      e.stopPropagation()
      onChange(value.filter((s) => s.id !== id))
    },
    [value, onChange],
  )

  const isSearching = debouncedQuery.length >= 2

  return (
    <Command shouldFilter={false}>
      <CommandInput
        placeholder="Search schedules…"
        value={query}
        onValueChange={setQuery}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b px-2 py-2">
          {value.map((s) => (
            <span
              key={s.id}
              className="flex items-center overflow-hidden rounded-full bg-muted pl-2 pr-2 text-xs"
            >
              <CalendarDays className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="ml-1.5">{s.name}</span>
              <button
                type="button"
                onClick={(e) => remove(s.id, e)}
                className="ml-1 rounded-full hover:text-foreground"
                aria-label={`Remove ${s.name}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <CommandList>
        {!isSearching ? (
          <CommandEmpty>Type to search for schedules.</CommandEmpty>
        ) : searching ? (
          <CommandEmpty>Searching…</CommandEmpty>
        ) : results.length === 0 ? (
          <CommandEmpty>No schedules found.</CommandEmpty>
        ) : (
          <CommandGroup>
            {results.map((s) => {
              const selected = value.some((v) => v.id === s.id)
              return (
                <CommandItem
                  key={s.id}
                  value={String(s.id)}
                  onSelect={() => toggle(s)}
                  className={cn(selected && 'bg-accent')}
                >
                  <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="ml-2 text-xs capitalize text-muted-foreground">{s.status}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
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
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-8 w-fit items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50',
            open && 'border-ring ring-1 ring-ring',
            className,
          )}
        >
          {label ? (
            <span className="text-foreground">{label}</span>
          ) : (
            <span className="text-muted-foreground">All schedules</span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0" align="start">
        <ScheduleSelectorContent value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  )
}
