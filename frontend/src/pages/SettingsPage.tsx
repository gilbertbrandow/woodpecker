import * as React from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuth } from '../context/auth'
import { api } from '../lib/api'
import { AVATAR_PIECES, AVATAR_COLORS, parseAvatarValue, type AvatarPiece, type AvatarColor } from '../lib/avatar'
import { Button } from '../components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar'
import { DefaultAvatar } from '../components/DefaultAvatar'
import { ThemeToggle } from '../components/ThemeToggle'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '../components/ui/breadcrumb'

export function SettingsPage(): React.ReactElement | null {
  const { user, loading, updateUser } = useAuth()
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, loading, navigate])

  useEffect(() => {
    if (user) {
      setNickname(user.nickname ?? '')
    }
  }, [user])

  if (loading || !user) return null

  const avatarValue = parseAvatarValue(user.avatarUrl)

  const saveNickname = async (): Promise<void> => {
    setSaving(true)
    try {
      const updated = await api.settings.update({ nickname })
      updateUser(updated)
      toast('Profile updated', { description: 'Your display name has been saved.' })
    } catch {
      toast.error('Something went wrong', { description: 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const selectDefaultAvatar = async (piece: AvatarPiece, color: AvatarColor): Promise<void> => {
    try {
      const updated = await api.settings.update({ avatarUrl: `default:${piece}:${color}` })
      updateUser(updated)
      toast('Avatar updated', { description: 'Your avatar has been saved.' })
    } catch {
      toast.error('Something went wrong', { description: 'Please try again.' })
    }
  }

  const saveAvatarUrl = async (): Promise<void> => {
    setSaving(true)
    try {
      const updated = await api.settings.update({ avatarUrl })
      updateUser(updated)
      setAvatarUrl('')
      toast('Avatar updated', { description: 'Your avatar has been saved.' })
    } catch {
      toast.error('Something went wrong', { description: 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const resetAvatar = async (): Promise<void> => {
    try {
      const updated = await api.settings.update({ avatarUrl: '' })
      updateUser(updated)
      toast('Avatar reset', { description: 'Reverted to your generated avatar.' })
    } catch {
      toast.error('Something went wrong', { description: 'Please try again.' })
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/app">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <section className="py-6 border-b border-border">
        <h2 className="text-sm font-semibold mb-4">Profile</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Lichess account: <span className="text-foreground">{user.username}</span>
        </p>
        <div className="flex flex-col gap-2">
          <label htmlFor="nickname" className="text-xs text-muted-foreground">
            Display name
          </label>
          <div className="flex gap-2">
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={user.username}
              maxLength={32}
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="sm" onClick={() => void saveNickname()} disabled={saving}>
              Save
            </Button>
          </div>
        </div>
      </section>

      <section className="py-6 border-b border-border">
        <h2 className="text-sm font-semibold mb-4">Avatar</h2>

        <div className="mb-6">
          {avatarValue.type === 'custom' ? (
            <Avatar className="h-16 w-16">
              <AvatarImage src={avatarValue.url} alt="Your avatar" />
              <AvatarFallback>
                <DefaultAvatar username={user.username} className="h-16 w-16" />
              </AvatarFallback>
            </Avatar>
          ) : (
            <DefaultAvatar
              username={user.username}
              piece={avatarValue.type === 'default' ? avatarValue.piece : undefined}
              color={avatarValue.type === 'default' ? avatarValue.color : undefined}
              className="h-16 w-16"
            />
          )}
        </div>

        <div className="mb-6">
          <p className="text-xs text-muted-foreground mb-3">Choose a default avatar</p>
          <div className="flex flex-col gap-3">
            {AVATAR_PIECES.map((piece) => (
              <div key={piece} className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => {
                  const isActive =
                    avatarValue.type === 'default' &&
                    avatarValue.piece === piece &&
                    avatarValue.color === color
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => void selectDefaultAvatar(piece, color)}
                      aria-label={`${piece} in ${color}`}
                      aria-pressed={isActive}
                      className={
                        isActive
                          ? 'rounded-full ring-2 ring-foreground ring-offset-2 ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                          : 'rounded-full ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:ring-1 hover:ring-muted-foreground hover:ring-offset-1'
                      }
                    >
                      <DefaultAvatar
                        username={user.username}
                        piece={piece}
                        color={color}
                        className="h-10 w-10"
                      />
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-3">
          <label htmlFor="avatar-url" className="text-xs text-muted-foreground">
            Custom avatar URL
          </label>
          <div className="flex gap-2">
            <input
              id="avatar-url"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/your-avatar.png"
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="sm" onClick={() => void saveAvatarUrl()} disabled={saving}>
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste a direct link to any image hosted online.
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => void resetAvatar()}
          className="px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          Reset to auto
        </Button>
      </section>

      <section className="py-6">
        <h2 className="text-sm font-semibold mb-4">Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Theme</p>
            <p className="text-xs text-muted-foreground">Switches between light and dark mode.</p>
          </div>
          <ThemeToggle />
        </div>
      </section>
    </div>
  )
}
