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
import { BOARD_THEMES, PIECE_SETS, resolvePieceSet, resolveBoardTheme } from '../lib/themes'
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

const PIECE_CHESS_NOTATION: Record<string, string> = {
  bk: 'K',
  bq: 'Q',
  br: 'R',
  bb: 'B',
  bn: 'N',
}

export function SettingsPage(): React.ReactElement | null {
  const { user, loading, updateUser } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedPiece, setSelectedPiece] = useState<AvatarPiece>(AVATAR_PIECES[0])
  const [selectedColor, setSelectedColor] = useState<AvatarColor>(AVATAR_COLORS[0])
  const [selectedStyle, setSelectedStyle] = useState<AvatarStyle>(AVATAR_STYLES[0])
  const [savingBoard, setSavingBoard] = useState(false)
  const [savingPiece, setSavingPiece] = useState(false)
  const [savingTimerTenths, setSavingTimerTenths] = useState(false)

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

  const selectBoardTheme = async (themeId: string): Promise<void> => {
    if (savingBoard || themeId === user.boardTheme) return
    setSavingBoard(true)
    try {
      const updated = await api.settings.update({ boardTheme: themeId })
      updateUser(updated)
    } catch {
      toast.error('Something went wrong', { description: 'Please try again.' })
    } finally {
      setSavingBoard(false)
    }
  }

  const selectPieceTheme = async (setId: string): Promise<void> => {
    if (savingPiece || setId === user.pieceTheme) return
    setSavingPiece(true)
    try {
      const updated = await api.settings.update({ pieceTheme: setId })
      updateUser(updated)
    } catch {
      toast.error('Something went wrong', { description: 'Please try again.' })
    } finally {
      setSavingPiece(false)
    }
  }

  const toggleTimerTenths = async (checked: boolean): Promise<void> => {
    if (savingTimerTenths) return
    setSavingTimerTenths(true)
    try {
      const updated = await api.settings.update({ showTimerTenths: checked })
      updateUser(updated)
    } catch {
      toast.error('Something went wrong', { description: 'Please try again.' })
    } finally {
      setSavingTimerTenths(false)
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

      <section className="py-6 border-b border-border">
        <h2 className="text-sm font-semibold mb-4">Board theme</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Choose the board theme.
        </p>
        <div className="flex flex-wrap gap-2">
          {BOARD_THEMES.map((theme) => {
            const isActive = resolveBoardTheme(user.boardTheme ?? '').id === theme.id
            const previewUrl = theme.thumbnailUrl ?? theme.url
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => void selectBoardTheme(theme.id)}
                aria-label={theme.label}
                aria-pressed={isActive}
                title={theme.label}
                disabled={savingBoard}
                className={
                  isActive
                    ? 'rounded p-0.5 ring-2 ring-foreground ring-offset-2 ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait'
                    : 'rounded p-0.5 ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:ring-1 hover:ring-muted-foreground hover:ring-offset-1 disabled:cursor-wait'
                }
              >
                <div
                  className="w-14 h-10 rounded overflow-hidden"
                  style={{
                    backgroundImage: `url("${previewUrl}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
              </button>
            )
          })}
        </div>
      </section>

      <section className="py-6 border-b border-border">
        <h2 className="text-sm font-semibold mb-4">Piece set</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Choose a piece set.
        </p>
        <div className="flex flex-wrap gap-2">
          {PIECE_SETS.map((set) => {
            const isActive = resolvePieceSet(user.pieceTheme ?? '').id === set.id
            return (
              <button
                key={set.id}
                type="button"
                onClick={() => void selectPieceTheme(set.id)}
                aria-label={set.label}
                aria-pressed={isActive}
                title={set.label}
                disabled={savingPiece}
                className={
                  isActive
                    ? 'rounded p-1 ring-2 ring-foreground ring-offset-2 ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait'
                    : 'rounded p-1 ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:ring-1 hover:ring-muted-foreground hover:ring-offset-1 disabled:cursor-wait'
                }
              >
                <img
                  src={set.knightPreviewUrl}
                  alt={set.label}
                  className="h-10 w-10 object-contain"
                  draggable={false}
                />
              </button>
            )
          })}
        </div>
      </section>

      <section className="py-6">
        <h2 className="text-sm font-semibold mb-4">Appearance</h2>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm">Application theme</p>
            <p className="text-xs text-muted-foreground mt-4">Switches between light and dark mode.</p>
          </div>
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Show tenths of seconds</p>
            <p className="text-xs text-muted-foreground mt-1">Display a tenths digit on the puzzle timer (e.g. 01:23.4).</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={user.showTimerTenths}
            disabled={savingTimerTenths}
            onClick={() => void toggleTimerTenths(!user.showTimerTenths)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait ${user.showTimerTenths ? 'bg-foreground' : 'bg-input'}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-sm transition-transform ${user.showTimerTenths ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </section>
    </div>
  )
}
