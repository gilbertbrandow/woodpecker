import * as React from 'react'
import { useState, useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { toast } from '../lib/toast'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../context/auth'
import { api } from '../lib/api'
import { Button } from '../components/ui/button'
import { GitHubPill } from '../components/GitHubPill'

export function WaitlistPage(): React.ReactElement | null {
  const { user, onboarding, waitlisted, setWaitlisted, loading } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (loading) return
    if (user) void navigate({ to: '/app' })
    else if (onboarding) void navigate({ to: '/onboarding' })
    else if (!waitlisted) void navigate({ to: '/' })
  }, [user, onboarding, waitlisted, loading, navigate])

  if (loading || !waitlisted) return null

  const handleEdit = (): void => {
    setEmail(waitlisted.email ?? '')
    setEditing(true)
  }

  const handleCancel = (): void => {
    setEditing(false)
    setEmail('')
  }

  const handleSubmit = async (e: React.SyntheticEvent): Promise<void> => {
    e.preventDefault()
    if (!email.trim()) return
    setSaving(true)
    try {
      const updated = await api.auth.updateWaitlistEmail(email.trim())
      setWaitlisted(updated)
      setEditing(false)
      setEmail('')
      toast.success('Email saved', { description: "We'll notify you when a spot opens up." })
    } catch {
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <GitHubPill />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">You're on the waitlist</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          We're limiting access while we get things running smoothly. You've been added to the waitlist.
          When a spot opens up, you'll need to sign in with the same Lichess account.
        </p>
      </div>

      <div className="w-full max-w-sm">
        {waitlisted.email && !editing ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-md border border-input bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                <span className="text-foreground">{waitlisted.email}</span>
              </div>
              <button
                type="button"
                onClick={handleEdit}
                className="ml-3 shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Edit
              </button>
            </div>
            <p className="text-xs text-muted-foreground">We'll notify you at this address when a spot opens up.</p>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="waitlist-email" className="text-xs text-muted-foreground">
                Email address (optional)
              </label>
              <input
                id="waitlist-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus={editing}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Leave your email and we'll let you know when you're in.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving || !email.trim()} className="flex-1">
                {saving ? 'Saving…' : 'Notify me'}
              </Button>
              {editing && (
                <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
