import * as React from 'react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuth } from '../context/auth'
import { api } from '../lib/api'
import { Button } from '../components/ui/button'

const DISPLAY_NAME_RE = /^[\w\s\-]+$/u

function validateDisplayName(value: string): string | null {
  const stripped = value.trim()
  if (!stripped) return 'Display name cannot be empty.'
  if (stripped.length < 2) return 'Display name must be at least 2 characters.'
  if (stripped.length > 32) return 'Display name must be 32 characters or fewer.'
  if (!DISPLAY_NAME_RE.test(stripped)) {
    return 'Display name may only contain letters, digits, spaces, underscores, and hyphens.'
  }
  return null
}

export function OnboardingPage(): React.ReactElement | null {
  const { onboarding, updateUser, loading } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState(onboarding?.lichessUsername ?? '')
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  if (loading || !onboarding) return null

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const error = validateDisplayName(displayName)
    if (error) {
      setValidationError(error)
      return
    }
    setValidationError(null)
    setSaving(true)
    try {
      const user = await api.auth.completeOnboarding(displayName.trim())
      updateUser(user)
      void navigate({ to: '/app' })
    } catch {
      toast.error('Something went wrong', { description: 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome!</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Choose a display name. This is how others will see you in leaderboards and training sessions.
        </p>
      </div>
      <form onSubmit={(e) => void handleSubmit(e)} className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="display-name" className="text-xs text-muted-foreground">
            Display name
          </label>
          <input
            id="display-name"
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value)
              setValidationError(null)
            }}
            maxLength={32}
            autoFocus
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {validationError && (
            <p className="text-xs text-destructive">{validationError}</p>
          )}
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Get started'}
        </Button>
      </form>
    </div>
  )
}
