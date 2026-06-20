import { useAuth } from '../context/auth'
import { UserSelector } from '../components/UserSelector'
import { api, type SelectableUser } from '../lib/api'
import type { CustomFilterSpec } from '../components/ServerDataTable'

// Returns a ready-made ServerDataTable CustomFilterSpec for a user selector filter.
// Handles 'me' token resolution, numeric ID hydration, and renders a UserSelector.
// Pass the urlKey that matches the backend query param (e.g. 'userId' or 'userIds').
export function useUserFilterSpec(urlKey: string): CustomFilterSpec<SelectableUser> {
  const { user } = useAuth()

  const currentUser: SelectableUser | null = user
    ? { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl }
    : null

  return {
    type: 'custom',
    key: urlKey,
    render: (value, onChange) => (
      <UserSelector value={value} onChange={onChange} />
    ),
    serialize: (users) => users.map((u) => String(u.id)),
    resolveInstant: (id) =>
      id === 'me' || String(user?.id) === id ? currentUser : null,
    resolveIds: (ids) => api.users.getByIds(ids.map(Number)),
  }
}
