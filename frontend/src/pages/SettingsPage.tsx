import { PageWrapper } from '../components/PageWrapper'
import * as React from 'react'
import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '../context/auth'
import { api } from '../lib/api'
import { BOARD_THEMES, PIECE_SETS, resolvePieceSet, resolveBoardTheme } from '../lib/themes'
import { ThemeToggle } from '../components/ThemeToggle'

const SOUND_THEMES = [
  { id: 'standard', label: 'Standard' },
  { id: 'piano', label: 'Piano' },
  { id: 'robot', label: 'Robot' },
  { id: 'woodland', label: 'Woodland' },
  { id: 'futuristic', label: 'Futuristic' },
  { id: 'nes', label: 'NES' },
  { id: 'sfx', label: 'SFX' },
] as const

export function SettingsPage(): React.ReactElement | null {
  const { user, loading, updateUser } = useAuth()
  const navigate = useNavigate()
  const [savingBoard, setSavingBoard] = useState(false)
  const [savingPiece, setSavingPiece] = useState(false)
  const [savingTimerTenths, setSavingTimerTenths] = useState(false)
  const [savingSound, setSavingSound] = useState(false)
  const [savingSoundTheme, setSavingSoundTheme] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, loading, navigate])

  if (loading || !user) return null

  const selectBoardTheme = async (themeId: string): Promise<void> => {
    if (savingBoard || themeId === user.boardTheme) return
    setSavingBoard(true)
    try {
      const updated = await api.settings.update({ boardTheme: themeId })
      updateUser(updated)
    } catch {
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
    } finally {
      setSavingTimerTenths(false)
    }
  }

  const toggleSoundEnabled = async (checked: boolean): Promise<void> => {
    if (savingSound) return
    setSavingSound(true)
    try {
      const updated = await api.settings.update({ soundEnabled: checked })
      updateUser(updated)
    } catch {
    } finally {
      setSavingSound(false)
    }
  }

  const selectSoundTheme = async (themeId: string): Promise<void> => {
    if (savingSoundTheme || themeId === user.soundTheme) return
    setSavingSoundTheme(true)
    try {
      const updated = await api.settings.update({ soundTheme: themeId })
      updateUser(updated)
    } catch {
    } finally {
      setSavingSoundTheme(false)
    }
  }

  return (
    <PageWrapper>
      <section className="py-10 border-b border-border">
        <h2 className="text-base font-semibold mb-6">Solve Settings</h2>

        <h3 className="text-sm font-semibold mb-3">Board theme</h3>
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

        <h3 className="text-sm font-semibold mb-3 mt-6">Piece set</h3>
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

        <div className="flex items-center justify-between mt-8 max-w-sm">
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

        <div className="flex items-center justify-between mt-8 max-w-sm">
          <div>
            <p className="text-sm">Board sounds</p>
            <p className="text-xs text-muted-foreground mt-1">Play move, capture, and check sounds while solving.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={user.soundEnabled}
            disabled={savingSound}
            onClick={() => void toggleSoundEnabled(!user.soundEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait ${user.soundEnabled ? 'bg-foreground' : 'bg-input'}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-sm transition-transform ${user.soundEnabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>

        <h3 className="text-sm font-semibold mb-3 mt-6">Sound theme</h3>
        <div className="flex flex-wrap gap-2">
          {SOUND_THEMES.map((theme) => {
            const isActive = user.soundTheme === theme.id
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => void selectSoundTheme(theme.id)}
                aria-pressed={isActive}
                disabled={savingSoundTheme}
                className={
                  isActive
                    ? 'rounded border border-foreground bg-foreground px-3 py-1.5 text-xs font-medium text-background focus:outline-none disabled:cursor-wait'
                    : 'rounded border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-foreground/40 hover:text-foreground focus:outline-none disabled:cursor-wait'
                }
              >
                {theme.label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="py-10">
        <h2 className="text-base font-semibold mb-6">Appearance</h2>
        <div className="flex items-center justify-between max-w-sm">
          <div>
            <p className="text-sm">Application theme</p>
            <p className="text-xs text-muted-foreground mt-1">Switches between light and dark mode.</p>
          </div>
          <ThemeToggle />
        </div>
      </section>
    </PageWrapper>
  )
}
