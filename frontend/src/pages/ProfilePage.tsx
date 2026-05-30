import { PageWrapper } from '../components/PageWrapper'
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
import { Input } from '../components/ui/input'
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar'
import { DefaultAvatar } from '../components/DefaultAvatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

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
  const [mode, setMode] = useState<'build' | 'custom'>('build')
  const [selectedPiece, setSelectedPiece] = useState<AvatarPiece>(AVATAR_PIECES[0])
  const [selectedColor, setSelectedColor] = useState<AvatarColor>(AVATAR_COLORS[0])
  const [selectedStyle, setSelectedStyle] = useState<AvatarStyle>(AVATAR_STYLES[0])
  const [customUrl, setCustomUrl] = useState('')
  const [urlError, setUrlError] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, loading, navigate])

  useEffect(() => {
    if (!user) return
    setDisplayName(user.displayName)
    const avatarVal = parseAvatarValue(user.avatarUrl)
    const defaults = resolveAvatarDefaults(user.username)
    if (avatarVal.type === 'custom') {
      setMode('custom')
      setCustomUrl(avatarVal.url)
      setSelectedPiece(defaults.piece)
      setSelectedColor(defaults.color)
      setSelectedStyle(defaults.style)
    } else {
      setMode('build')
      setCustomUrl('')
      setSelectedPiece(avatarVal.type === 'default' ? avatarVal.piece : defaults.piece)
      setSelectedColor(avatarVal.type === 'default' ? avatarVal.color : defaults.color)
      setSelectedStyle(avatarVal.type === 'default' ? avatarVal.style : defaults.style)
    }
  }, [user])

  if (loading || !user) return null

  const handleResetToAuto = (): void => {
    const defaults = resolveAvatarDefaults(user.username)
    setMode('build')
    setSelectedPiece(defaults.piece)
    setSelectedColor(defaults.color)
    setSelectedStyle(defaults.style)
    setCustomUrl('')
  }

  const handleSave = async (): Promise<void> => {
    if (mode === 'custom' && !customUrl.trim()) {
      setUrlError(true)
      return
    }
    setSaving(true)
    try {
      const avatarUrlValue =
        mode === 'custom'
          ? customUrl.trim()
          : `default:${selectedPiece}:${selectedColor}:${selectedStyle}`
      const updated = await api.settings.update({ displayName, avatarUrl: avatarUrlValue })
      updateUser(updated)
      toast('Profile updated', { description: 'Your profile has been saved.' })
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const previewAvatar =
    mode === 'custom' && customUrl.trim() ? (
      <Avatar className="h-16 w-16 shrink-0">
        <AvatarImage src={customUrl.trim()} alt={displayName} />
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
        className="h-16 w-16 shrink-0"
      />
    )

  return (
    <PageWrapper>
      <section className="py-10">
        <h2 className="text-base font-semibold mb-6">Profile</h2>

        {/* Preview card */}
        <div className="inline-flex flex-col min-w-sm rounded-lg border border-border bg-card p-5 mb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Preview</p>
          <div className="flex items-center gap-4">
            {previewAvatar}
            <div className="min-w-0">
              <p className="text-base font-semibold truncate">
                {displayName || <span className="text-muted-foreground italic font-normal text-sm">No display name</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{user.username}</p>
            </div>
          </div>
        </div>

        {/* Display name */}
        <div className="mb-8 mt-6">
          <h3 className="text-sm font-semibold mb-3">Display name</h3>
          <div className="flex flex-col gap-1.5 max-w-sm">
            <Input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={32}
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">2–32 characters. Shown to other users.</p>
          </div>
        </div>

        {/* Avatar builder */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold mb-3">Avatar</h3>
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'build' | 'custom')} className="max-w-sm">
              <TabsList className="w-full">
                <TabsTrigger value="build" className="flex-1">Build</TabsTrigger>
                <TabsTrigger value="custom" className="flex-1">Custom URL</TabsTrigger>
              </TabsList>

              <TabsContent value="build" className="mt-4 flex flex-col gap-4">
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
                        className={
                          selectedColor === color
                            ? 'rounded-full ring-2 ring-foreground ring-offset-2 ring-offset-background focus:outline-none'
                            : 'rounded-full ring-offset-background focus:outline-none hover:ring-1 hover:ring-muted-foreground hover:ring-offset-1'
                        }
                      >
                        <div className="h-7 w-7 rounded-full" style={{ backgroundColor: AVATAR_COLOR_VALUES[color] }} />
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
                        className={
                          selectedStyle === s
                            ? 'rounded p-1 ring-2 ring-foreground ring-offset-2 ring-offset-background focus:outline-none'
                            : 'rounded p-1 ring-offset-background focus:outline-none hover:ring-1 hover:ring-muted-foreground hover:ring-offset-1'
                        }
                      >
                        <img
                          src={resolvePieceSet(s).knightPreviewUrl}
                          alt={s}
                          className="h-9 w-9 object-contain"
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
                        className={
                          selectedPiece === p
                            ? 'rounded ring-2 ring-foreground ring-offset-2 ring-offset-background focus:outline-none'
                            : 'rounded ring-offset-background focus:outline-none hover:ring-1 hover:ring-muted-foreground hover:ring-offset-1'
                        }
                      >
                        <div className="h-9 w-9 rounded bg-muted flex items-center justify-center">
                          <span className="font-chess text-lg">{PIECE_CHESS_NOTATION[p] ?? p}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetToAuto}
                  className="self-start text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  Reset to auto
                </button>
              </TabsContent>

              <TabsContent value="custom" className="mt-4 flex flex-col gap-2">
                <Input
                  id="avatar-url"
                  type="url"
                  value={customUrl}
                  onChange={(e) => {
                    setCustomUrl(e.target.value)
                    if (urlError) setUrlError(false)
                  }}
                  placeholder="https://example.com/avatar.png"
                  className={urlError ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {urlError ? (
                  <p className="text-xs text-destructive">Enter a URL or switch to Build.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Paste a direct link to any image hosted online.
                  </p>
                )}
              </TabsContent>
          </Tabs>
        </div>

        {/* Save */}
        <Button onClick={() => void handleSave()} disabled={saving}>
          Update profile
        </Button>
      </section>
    </PageWrapper>
  )
}
