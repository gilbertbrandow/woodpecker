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
}

export function UserSelector({
  value,
  onChange,
  disabled = false,
}: UserSelectorProps): React.ReactElement {
  const { user: authUser } = useAuth()
  const me: SelectableUser | null =
    authUser && authUser.status === 'active'
      ? { id: authUser.id, displayName: authUser.displayName, avatarUrl: authUser.avatarUrl }
      : null

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SelectableUser[]>([])
  const [searching, setSearching] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

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

  const visibleAvatars = value.slice(0, MAX_VISIBLE_AVATARS)
  const overflowCount = value.length - MAX_VISIBLE_AVATARS
  const isSearching = debouncedQuery.length >= 2

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-8 w-fit items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50',
            open && 'border-ring ring-1 ring-ring',
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
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search users…"
            value={query}
            onValueChange={setQuery}
          />
          {value.length > 0 && (
            <div className="flex flex-wrap gap-1 border-b px-2 py-2">
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
          )}
          <CommandList>
            {!isSearching ? (
              me ? (
                <CommandGroup heading="Quick">
                  <CommandItem
                    value={String(me.id)}
                    onSelect={() => toggle(me)}
                    className={cn(value.some((u) => u.id === me.id) && 'bg-accent')}
                  >
                    <UserAvatar
                      displayName={me.displayName}
                      avatarUrl={me.avatarUrl}
                      className="mr-2 h-5 w-5"
                    />
                    <span className="flex-1">Me</span>
                    <span className="ml-2 text-xs text-muted-foreground">{me.displayName}</span>
                  </CommandItem>
                  <CommandEmpty>Type to search for other users.</CommandEmpty>
                </CommandGroup>
              ) : (
                <CommandEmpty>Type to search for users.</CommandEmpty>
              )
            ) : searching ? (
              <CommandEmpty>Searching…</CommandEmpty>
            ) : results.length === 0 ? (
              <CommandEmpty>No users found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {results.map((u) => {
                  const selected = value.some((v) => v.id === u.id)
                  return (
                    <CommandItem
                      key={u.id}
                      value={String(u.id)}
                      onSelect={() => toggle(u)}
                      className={cn(selected && 'bg-accent')}
                    >
                      <UserAvatar
                        displayName={u.displayName}
                        avatarUrl={u.avatarUrl}
                        className="mr-2 h-5 w-5"
                      />
                      {u.displayName}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
