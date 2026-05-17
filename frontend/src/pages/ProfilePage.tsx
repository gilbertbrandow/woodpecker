import * as React from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuth } from '../context/auth'
import { api } from '../lib/api'
import {
  AVATAR_PIECES, AVATAR_COLORS, AVATAR_STYLES, AVATAR_COLOR_VALUES,
  parseAvatarValue, resolveAvatarDefaults,
  type AvatarPiece, type AvatarColor, type AvatarStyle,
} from '../lib/avatar'
import { resolvePieceSet } from '../lib/themes'
import { Button } from '../components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar'
import { DefaultAvatar } from '../components/DefaultAvatar'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '../components/ui/breadcrumb'

const PIECE_CHESS_NOTATION: Record<string, string> = {
  bk: 'K',
  bq: 'Q',
  br: 'R',
  bb: 'B',
  bn: 'N',
}

export function ProfilePage(): React.ReactElement | null {
  const { user, loading, updateUser } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedPiece, setSelectedPiece] = useState<AvatarPiece>(AVATAR_PIECES[0])
  const [selectedColor, setSelectedColor] = useState<AvatarColor>(AVATAR_COLORS[0])
  const [selectedStyle, setSelectedStyle] = useState<AvatarStyle>(AVATAR_STYLES[0])

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, loading, navigate])

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName)
      const avatarVal = parseAvatarValue(user.avatarUrl)
      const defaults = resolveAvatarDefaults(user.username)
      setSelectedPiece(avatarVal.type === 'default' ? avatarVal.piece : defaults.piece)
      setSelectedColor(avatarVal.type === 'default' ? avatarVal.color : defaults.color)
      setSelectedStyle(avatarVal.type === 'default' ? avatarVal.style : defaults.style)
    }
  }, [user])

  if (loading || !user) return null

  const avatarValue = parseAvatarValue(user.avatarUrl)

  const saveDisplayName = async (): Promise<void> => {
    setSaving(true)
    try {
      const updated = await api.settings.update({ displayName })
      updateUser(updated)
      toast('Profile updated', { description: 'Your display name has been saved.' })
    } catch {
      toast.error('Something went wrong', { description: 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const saveAvatar = async (): Promise<void> => {
    setSaving(true)
    try {
      const value = avatarUrl.trim() || `default:${selectedPiece}:${selectedColor}:${selectedStyle}`
      const updated = await api.settings.update({ avatarUrl: value })
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
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/app">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Profile</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <section className="py-10">
        <h2 className="text-base font-semibold mb-6">Profile</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Lichess account: <span className="text-foreground">{user.username}</span>
        </p>
        <div className="flex flex-col gap-2 mb-8 max-w-sm">
          <label htmlFor="display-name" className="text-xs text-muted-foreground">
            Display name
          </label>
          <div className="flex gap-2">
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={32}
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="sm" onClick={() => void saveDisplayName()} disabled={saving}>
              Save
            </Button>
          </div>
        </div>

        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Avatar</h3>

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
              piece={selectedPiece}
              color={selectedColor}
              style={selectedStyle}
              className="h-16 w-16"
            />
          )}
        </div>

        <div className="mb-6 flex flex-col gap-5">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Color</p>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  aria-pressed={selectedColor === color}
                  onClick={() => setSelectedColor(color)}
                  className={selectedColor === color
                    ? 'rounded-full ring-2 ring-foreground ring-offset-2 ring-offset-background focus:outline-none'
                    : 'rounded-full ring-offset-background focus:outline-none hover:ring-1 hover:ring-muted-foreground hover:ring-offset-1'}
                >
                  <div className="h-8 w-8 rounded-full" style={{ backgroundColor: AVATAR_COLOR_VALUES[color] }} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Style</p>
            <div className="flex flex-wrap gap-2">
              {AVATAR_STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-label={s}
                  aria-pressed={selectedStyle === s}
                  onClick={() => setSelectedStyle(s)}
                  className={selectedStyle === s
                    ? 'rounded p-1 ring-2 ring-foreground ring-offset-2 ring-offset-background focus:outline-none'
                    : 'rounded p-1 ring-offset-background focus:outline-none hover:ring-1 hover:ring-muted-foreground hover:ring-offset-1'}
                >
                  <img
                    src={resolvePieceSet(s).knightPreviewUrl}
                    alt={s}
                    className="h-10 w-10 object-contain"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Piece</p>
            <div className="flex flex-wrap gap-2">
              {AVATAR_PIECES.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-label={p}
                  aria-pressed={selectedPiece === p}
                  onClick={() => setSelectedPiece(p)}
                  className={selectedPiece === p
                    ? 'rounded ring-2 ring-foreground ring-offset-2 ring-offset-background focus:outline-none'
                    : 'rounded ring-offset-background focus:outline-none hover:ring-1 hover:ring-muted-foreground hover:ring-offset-1'}
                >
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                    <span className="font-chess text-xl">{PIECE_CHESS_NOTATION[p] ?? p}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-3">
          <label htmlFor="avatar-url" className="text-xs text-muted-foreground">
            Custom avatar URL
          </label>
          <input
            id="avatar-url"
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/your-avatar.png"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            Paste a direct link to any image hosted online. If filled, this takes priority over the pickers above.
          </p>
        </div>

        <Button size="sm" onClick={() => void saveAvatar()} disabled={saving} className="mb-6">
          Save avatar
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => void resetAvatar()}
          className="px-0 text-muted-foreground hover:bg-transparent hover:text-foreground ml-3"
        >
          Reset to auto
        </Button>
      </section>
    </div>
  )
}
