import * as React from 'react'
import { useState, useEffect, useCallback } from 'react'
import { X, ChevronsUpDown } from 'lucide-react'
import { api, type SelectableUser } from '../lib/api'
import { AvatarGroup, AvatarGroupCount } from './ui/avatar'
import { UserAvatar } from './UserAvatar'
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from './ui/command'
import { useAuth } from '../context/auth'
import { cn } from '../lib/utils'

const MAX_VISIBLE_AVATARS = 3

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

type UserSelectorProps = {
  value: SelectableUser[]
  onChange: (users: SelectableUser[]) => void
  disabled?: boolean
  className?: string
}

// ---------------------------------------------------------------------------
// Exported content component — renders the Command palette without a trigger.
// Use this when embedding inside another Popover (e.g. a filter chip).
// ---------------------------------------------------------------------------
export function UserSelectorContent({
  value,
  onChange,
}: {
  value: SelectableUser[]
  onChange: (users: SelectableUser[]) => void
}): React.ReactElement {
  const { user: authUser } = useAuth()
  const me: SelectableUser | null =
    authUser && authUser.status === 'active'
      ? { id: authUser.id, displayName: authUser.displayName, avatarUrl: authUser.avatarUrl }
      : null

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SelectableUser[]>([])
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<SelectableUser[]>([])
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    let cancelled = false
    api.users.suggest().then((r) => { if (!cancelled) setSuggestions(r) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    api.users
      .search(debouncedQuery)
      .then((r) => { if (!cancelled) setResults(r) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSearching(false) })
    return () => { cancelled = true }
  }, [debouncedQuery])

  const toggle = useCallback(
    (user: SelectableUser) => {
      const already = value.some((u) => u.id === user.id)
      onChange(already ? value.filter((u) => u.id !== user.id) : [...value, user])
    },
    [value, onChange],
  )

  const remove = useCallback(
    (userId: number, e: React.MouseEvent) => {
      e.stopPropagation()
      onChange(value.filter((u) => u.id !== userId))
    },
    [value, onChange],
  )

  const isSearching = debouncedQuery.length >= 2

  return (
    <Command shouldFilter={false}>
      <CommandInput
        placeholder="Search users…"
        value={query}
        onValueChange={setQuery}
      />
      {value.length > 0 && (
        <div className="border-b px-2 py-2">
          <div className="flex flex-wrap gap-1">
            {value.map((u) => (
              <span
                key={u.id}
                className="flex items-center overflow-hidden rounded-full bg-muted pr-2 text-xs"
              >
                <UserAvatar
                  displayName={u.displayName}
                  avatarUrl={u.avatarUrl}
                  className="h-5 w-5 shrink-0"
                />
                <span className="ml-1.5">{u.displayName}</span>
                <button
                  type="button"
                  onClick={(e) => remove(u.id, e)}
                  className="ml-1 rounded-full hover:text-foreground"
                  aria-label={`Remove ${u.displayName}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      {(() => {
        const visibleSuggestions = [
          ...(me && !value.some((u) => u.id === me.id) ? [{ ...me, isMe: true }] : []),
          ...suggestions
            .filter((u) => !value.some((v) => v.id === u.id))
            .map((u) => ({ ...u, isMe: false })),
        ]
        const showSuggestions = !isSearching && visibleSuggestions.length > 0
        return (
          <>
            <div className="relative">
              <CommandList>
                {!isSearching ? (
                  showSuggestions && (
                    <CommandGroup heading="Suggestions">
                      {visibleSuggestions.map((u) => (
                        <CommandItem
                          key={u.id}
                          value={String(u.id)}
                          onSelect={() => toggle(u)}
                        >
                          <UserAvatar
                            displayName={u.displayName}
                            avatarUrl={u.avatarUrl}
                            className="mr-2 h-5 w-5"
                          />
                          {u.displayName}
                          {u.isMe && (
                            <span className="ml-1.5 text-xs italic text-muted-foreground">(me)</span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )
                ) : searching ? (
                  <CommandEmpty>Searching…</CommandEmpty>
                ) : results.filter((u) => !value.some((v) => v.id === u.id)).length === 0 ? (
                  <CommandEmpty>No users found.</CommandEmpty>
                ) : (
                  <CommandGroup heading="Results">
                    {results
                      .filter((u) => !value.some((v) => v.id === u.id))
                      .map((u) => (
                        <CommandItem
                          key={u.id}
                          value={String(u.id)}
                          onSelect={() => toggle(u)}
                        >
                          <UserAvatar
                            displayName={u.displayName}
                            avatarUrl={u.avatarUrl}
                            className="mr-2 h-5 w-5"
                          />
                          {u.displayName}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                )}
              </CommandList>
              {showSuggestions && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-background to-transparent" />
              )}
            </div>
            {showSuggestions && (
              <p className="px-3 pb-2 text-[10px] italic text-muted-foreground">Search to find any user</p>
            )}
          </>
        )
      })()}
    </Command>
  )
}

// ---------------------------------------------------------------------------
// Full standalone component — trigger button + popover wrapping the content.
// ---------------------------------------------------------------------------
export function UserSelector({
  value,
  onChange,
  disabled = false,
  className,
}: UserSelectorProps): React.ReactElement {
  const { user: authUser } = useAuth()
  const me: SelectableUser | null =
    authUser && authUser.status === 'active'
      ? { id: authUser.id, displayName: authUser.displayName, avatarUrl: authUser.avatarUrl }
      : null

  const [open, setOpen] = useState(false)

  const visibleAvatars = value.slice(0, MAX_VISIBLE_AVATARS)
  const overflowCount = value.length - MAX_VISIBLE_AVATARS

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
          {value.length === 0 ? (
            <span className="text-muted-foreground">All users</span>
          ) : (
            <>
              <span className="text-foreground">
                {me && value.length === 1 && value[0].id === me.id ? 'Me' : 'Users'}
              </span>
              <AvatarGroup>
                {visibleAvatars.map((u) => (
                  <UserAvatar
                    key={u.id}
                    displayName={u.displayName}
                    avatarUrl={u.avatarUrl}
                    className="h-5 w-5"
                  />
                ))}
                {overflowCount > 0 && (
                  <AvatarGroupCount className="h-5 w-5 text-[10px]">
                    +{overflowCount}
                  </AvatarGroupCount>
                )}
              </AvatarGroup>
            </>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0" align="start">
        <UserSelectorContent value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  )
}
