import * as React from 'react'
import { X } from 'lucide-react'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from './ui/command'
import { cn } from '../lib/utils'
import { useEntitySearch } from '../hooks/useEntitySearch'

type ItemDisplay = {
  label: string
  chipIcon: React.ReactNode
  chipFlush?: boolean           // true = no left padding (avatar flush to pill edge)
  resultIcon: React.ReactNode
  meta?: string | null          // status badge, rendered right-aligned in result rows
  suggestionExtra?: React.ReactNode  // extra content rendered after label in suggestions only
}

type EntitySelectorContentProps<T extends { id: number }> = {
  value: T[]
  onChange: (items: T[]) => void
  fetchResults: (q: string) => Promise<T[]>
  fetchSuggestions?: () => Promise<T[]>
  placeholder: string
  hintText: string
  noResultsText: string
  getDisplay: (item: T) => ItemDisplay
}

export function EntitySelectorContent<T extends { id: number }>({
  value,
  onChange,
  fetchResults,
  fetchSuggestions,
  placeholder,
  hintText,
  noResultsText,
  getDisplay,
}: EntitySelectorContentProps<T>): React.ReactElement {
  const { query, setQuery, results, searching, suggestions, isSearching, toggle, remove } =
    useEntitySearch<T>({ value, onChange, fetchResults, fetchSuggestions })

  const visibleSuggestions = suggestions.filter((s) => !value.some((v) => v.id === s.id))
  const showSuggestions = !isSearching && visibleSuggestions.length > 0
  const filteredResults = results.filter((r) => !value.some((v) => v.id === r.id))

  return (
    <Command shouldFilter={false}>
      <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b px-2 py-2">
          {value.map((item) => {
            const { label, chipIcon, chipFlush } = getDisplay(item)
            return (
              <span
                key={item.id}
                className={cn(
                  'flex items-center overflow-hidden rounded-full bg-muted pr-2 text-xs',
                  !chipFlush && 'pl-2',
                )}
              >
                {chipIcon}
                <span className="ml-1.5">{label}</span>
                <button
                  type="button"
                  onClick={(e) => remove(item.id, e)}
                  className="ml-1 rounded-full hover:text-foreground"
                  aria-label={`Remove ${label}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )
          })}
        </div>
      )}
      <>
        <div className="relative">
          <CommandList>
            {!isSearching ? (
              showSuggestions && (
                <CommandGroup heading="Suggestions">
                  {visibleSuggestions.map((item) => {
                    const { label, resultIcon, meta, suggestionExtra } = getDisplay(item)
                    return (
                      <CommandItem
                        key={item.id}
                        value={String(item.id)}
                        onSelect={() => toggle(item)}
                      >
                        {resultIcon}
                        <span className="flex-1 truncate">{label}</span>
                        {suggestionExtra}
                        {meta && (
                          <span className="ml-2 text-xs capitalize text-muted-foreground">{meta}</span>
                        )}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )
            ) : searching ? (
              <CommandEmpty>Searching…</CommandEmpty>
            ) : filteredResults.length === 0 ? (
              <CommandEmpty>{noResultsText}</CommandEmpty>
            ) : (
              <CommandGroup heading="Results">
                {filteredResults.map((item) => {
                  const { label, resultIcon, meta } = getDisplay(item)
                  return (
                    <CommandItem
                      key={item.id}
                      value={String(item.id)}
                      onSelect={() => toggle(item)}
                    >
                      {resultIcon}
                      <span className="flex-1 truncate">{label}</span>
                      {meta && (
                        <span className="ml-2 text-xs capitalize text-muted-foreground">{meta}</span>
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
          {showSuggestions && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-background to-transparent" />
          )}
        </div>
        {showSuggestions && (
          <p className="px-3 pb-2 text-[10px] italic text-muted-foreground">{hintText}</p>
        )}
      </>
    </Command>
  )
}
