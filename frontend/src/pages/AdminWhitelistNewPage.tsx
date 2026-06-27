import * as React from 'react'
import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, Search, UserCheck } from 'lucide-react'
import { PageWrapper } from '../components/PageWrapper'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '../components/ui/popover'
import { api } from '../lib/api'
import { useDebounce } from '../hooks/useDebounce'
import { toast } from '../lib/toast'

type Suggestion = { id: string; name: string }

export function AdminWhitelistNewPage(): React.ReactElement {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Suggestion | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [open, setOpen] = useState(false)

  const debouncedQuery = useDebounce(query, 250)

  useEffect(() => {
    if (selected) return
    if (debouncedQuery.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    let cancelled = false
    setSearching(true)
    api.admin.lichessPlayerSearch(debouncedQuery)
      .then(({ result }) => {
        if (cancelled) return
        setSuggestions(result)
        setOpen(result.length > 0)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSearching(false) })
    return () => { cancelled = true }
  }, [debouncedQuery, selected])

  const handleSelect = (suggestion: Suggestion): void => {
    setSelected(suggestion)
    setQuery(suggestion.name)
    setOpen(false)
    setSuggestions([])
  }

  const handleQueryChange = (value: string): void => {
    setQuery(value)
    if (selected) setSelected(null)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const username = selected?.id ?? query.trim()
    if (!username) return
    setSubmitting(true)
    try {
      await api.admin.addWhitelist(username)
      toast.success('Added to whitelist', { description: `'${username.toLowerCase()}' can now sign up.` })
      void navigate({ to: '/app/admin/whitelist' })
    } catch {
      setSubmitting(false)
    }
  }

  const canSubmit = (selected !== null || query.trim().length >= 2) && !submitting

  return (
    <PageWrapper className="flex flex-col gap-6">
      <h1 className="text-base font-semibold">Add to whitelist</h1>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6 max-w-sm">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="username-search" className="text-sm font-medium">
            Lichess username
          </label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
              <div className="relative">
                <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {searching
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Search className="h-4 w-4" />
                  }
                </div>
                <Input
                  id="username-search"
                  autoFocus
                  autoComplete="off"
                  placeholder="Search Lichess username…"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
                  onBlur={() => setTimeout(() => setOpen(false), 150)}
                  className="pl-8"
                  disabled={submitting}
                />
              </div>
            </PopoverAnchor>
            <PopoverContent
              className="p-0"
              style={{ width: 'var(--radix-popover-trigger-width)' }}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <ul className="py-1">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                      onMouseDown={() => handleSelect(s)}
                    >
                      {s.name}
                      {s.name.toLowerCase() !== s.id && (
                        <span className="text-xs text-muted-foreground">({s.id})</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
          {selected && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserCheck className="h-3.5 w-3.5 text-green-500" />
              Verified Lichess user
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={!canSubmit} className="h-9 px-4 text-sm">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add to whitelist'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 px-4 text-sm"
            onClick={() => void navigate({ to: '/app/admin/whitelist' })}
          >
            Cancel
          </Button>
        </div>
      </form>
    </PageWrapper>
  )
}
