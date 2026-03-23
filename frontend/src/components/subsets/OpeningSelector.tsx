import * as React from 'react'
import { useState, useEffect, useRef } from 'react'
import { X, TriangleAlert } from 'lucide-react'
import { api, type Opening } from '../../lib/api'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { Slider } from '../ui/slider'

export type OpeningValue = {
  items: string[]
  strength: number
}

type OpeningSelectorProps = {
  value: OpeningValue
  onChange: (v: OpeningValue) => void
  disabled?: boolean
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function OpeningSelector({ value, onChange, disabled = false }: OpeningSelectorProps): React.ReactElement {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Opening[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const fetchedNamesRef = useRef<Set<string>>(new Set())
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    value.items.forEach((name) => {
      if (fetchedNamesRef.current.has(name)) return
      fetchedNamesRef.current.add(name)
      api.openings
        .search(name.replace(/_/g, ' ').slice(0, 30))
        .then((data) => {
          const match = data.find((r) => r.name === name)
          if (match?.displayName) {
            setDisplayNames((prev) => ({ ...prev, [name]: match.displayName }))
          }
        })
        .catch(() => {})
    })
  }, [value.items])

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }
    setSearching(true)
    api.openings
      .search(debouncedQuery)
      .then((data) => {
        setResults(data)
        setShowDropdown(true)
      })
      .catch(() => setResults([]))
      .finally(() => setSearching(false))
  }, [debouncedQuery])

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addOpening = (opening: Opening): void => {
    if (value.items.includes(opening.name)) return
    if (opening.displayName) {
      setDisplayNames((prev) => ({ ...prev, [opening.name]: opening.displayName as string }))
    }
    onChange({ ...value, items: [...value.items, opening.name] })
    setQuery('')
    setShowDropdown(false)
  }

  const removeOpening = (name: string): void => {
    onChange({ ...value, items: value.items.filter((i) => i !== name) })
  }

  const getDisplayName = (name: string): string => {
    return displayNames[name] ?? results.find((r) => r.name === name)?.displayName ?? name
  }

  const strengthLabel = (): string => {
    if (value.strength === 0) return 'Off'
    if (value.strength === 1) return 'Hard filter'
    return `${Math.round(value.strength * 100)}%`
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 rounded-md border border-amber-600/30 bg-amber-50/40 p-3 dark:border-amber-700/20 dark:bg-amber-900/10">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500/70" />
        <p className="text-xs text-amber-800 dark:text-amber-400/70">
          Opening tags only exist for puzzles arising before move 20. Activating opening preferences
          strongly biases towards early-game positions and shrinks the eligible pool significantly.
        </p>
      </div>

      <div ref={containerRef} className="relative">
        <Input
          placeholder="Search openings…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          disabled={disabled}
          className="h-9"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            …
          </span>
        )}

        {showDropdown && results.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-background shadow-md">
            {results.map((o) => (
              <li key={o.name}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    addOpening(o)
                  }}
                >
                  {o.eco && (
                    <span className="shrink-0 text-xs text-muted-foreground">{o.eco}</span>
                  )}
                  <span>{o.displayName ?? o.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {value.items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.items.map((name) => (
            <Badge key={name} variant="secondary" className="gap-1">
              <span>{getDisplayName(name)}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeOpening(name)}
                  className="ml-0.5 rounded-full opacity-60 hover:opacity-100"
                  aria-label={`Remove ${name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {value.items.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Opening strength</span>
            <span>{strengthLabel()}</span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={[value.strength]}
            onValueChange={(vals) => {
              const v = vals[0]
              if (v !== undefined) onChange({ ...value, strength: v })
            }}
            disabled={disabled}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            0 = ignored · 0.5 = twice as likely · 1 = hard filter
          </p>
        </div>
      )}
    </div>
  )
}
