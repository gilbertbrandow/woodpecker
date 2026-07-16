import * as React from 'react'
import { useState } from 'react'
import { api, type SelectableUser } from '../lib/api'
import { AvatarGroup, AvatarGroupCount } from './ui/avatar'
import { UserAvatar } from './UserAvatar'
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover'
import { useAuth } from '../context/auth'
import { EntitySelectorContent } from './EntitySelectorContent'
import { SelectorTrigger } from './SelectorTrigger'

const MAX_VISIBLE_AVATARS = 3

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
    authUser?.status === 'active'
      ? { id: authUser.id, displayName: authUser.displayName, avatarUrl: authUser.avatarUrl }
      : null

  return (
    <EntitySelectorContent
      value={value}
      onChange={onChange}
      fetchResults={api.users.search}
      fetchSuggestions={() =>
        api.users.suggest().then((suggestions) => {
          if (!me) return suggestions
          return [me, ...suggestions.filter((u) => u.id !== me.id)]
        })
      }
      placeholder="Search users…"
      hintText="Search to find any user"
      noResultsText="No users found."
      getDisplay={(u) => ({
        label: u.displayName,
        chipFlush: true,
        chipIcon: (
          <UserAvatar displayName={u.displayName} avatarUrl={u.avatarUrl} className="h-5 w-5 shrink-0" />
        ),
        resultIcon: (
          <UserAvatar displayName={u.displayName} avatarUrl={u.avatarUrl} className="mr-2 h-5 w-5" />
        ),
        suggestionExtra:
          me && u.id === me.id ? (
            <span className="ml-1.5 text-xs italic text-muted-foreground">(me)</span>
          ) : undefined,
      })}
    />
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
    authUser?.status === 'active'
      ? { id: authUser.id, displayName: authUser.displayName, avatarUrl: authUser.avatarUrl }
      : null

  const [open, setOpen] = useState(false)

  const visibleAvatars = value.slice(0, MAX_VISIBLE_AVATARS)
  const overflowCount = value.length - MAX_VISIBLE_AVATARS

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SelectorTrigger open={open} disabled={disabled} className={className}>
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
        </SelectorTrigger>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0" align="start">
        <UserSelectorContent value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  )
}
