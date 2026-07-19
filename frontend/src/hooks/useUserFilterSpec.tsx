import { useMemo } from 'react'
import { useAuth } from '../context/auth'
import { UserSelector, UserSelectorContent } from '../components/UserSelector'
import { api, type SelectableUser } from '../lib/api'
import type { EntityFilterSpec } from '../components/ServerDataTable'
import { User } from 'lucide-react'
import { AvatarGroup, AvatarGroupCount } from '../components/ui/avatar'
import { UserAvatar } from '../components/UserAvatar'

// Returns a ready-made ServerDataTable EntityFilterSpec for a user selector filter.
// Handles 'me' token resolution, numeric ID hydration, and renders a UserSelector.
// Pass the urlKey that matches the backend query param (e.g. 'userId').
export function useUserFilterSpec(urlKey: string, label = 'User'): EntityFilterSpec<SelectableUser> {
  const { user } = useAuth()

  return useMemo<EntityFilterSpec<SelectableUser>>(() => {
    const currentUser: SelectableUser | null = user
      ? { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl }
      : null

    return {
      type: 'entity',
      key: urlKey,
      label,
      icon: User,
      render: (value, onChange) => (
        <UserSelector value={value} onChange={onChange} />
      ),
      renderContent: (value, onChange) => (
        <UserSelectorContent value={value} onChange={onChange} />
      ),
      serialize: (users) => users.map((u) => String(u.id)),
      resolveInstant: (id) =>
        id === 'me' || String(user?.id) === id ? currentUser : null,
      resolveIds: (ids) => api.users.getByIds(ids.map(Number)),
      getChipLabel: (users) => {
        if (users.length === 0) return ''
        if (users.length === 1 && user && users[0].id === user.id) return 'me'
        if (users.length === 1) return users[0].displayName
        return `${users.length} users`
      },
      renderChipValue: (users, pendingCount) => {
        const total = users.length + pendingCount
        if (total === 0) return null
        const visible = users.slice(0, 3)
        const skeletonCount = Math.max(0, Math.min(pendingCount, 3 - visible.length))
        const overflow = total - 3
        return (
          <AvatarGroup>
            {visible.map((u) => (
              <UserAvatar key={u.id} displayName={u.displayName} avatarUrl={u.avatarUrl} className="h-4 w-4" />
            ))}
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <span key={`p${i}`} className="inline-block h-4 w-4 animate-pulse rounded-full bg-muted" />
            ))}
            {overflow > 0 && (
              <AvatarGroupCount className="h-4 w-4 text-[9px]">+{overflow}</AvatarGroupCount>
            )}
          </AvatarGroup>
        )
      },
    }
  }, [urlKey, label, user])
}
