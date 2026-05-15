import * as React from 'react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../context/auth'
import { api } from '../lib/api'
import { Button } from '../components/ui/button'

export function WaitlistPage(): React.ReactElement | null {
  const { waitlisted, setWaitlisted, loading } = useAuth()
  const [email, setEmail] = useState(waitlisted?.email ?? '')
  const [saving, setSaving] = useState(false)

  if (loading || !waitlisted) return null

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!email.trim()) return
    setSaving(true)
    try {
      const updated = await api.auth.updateWaitlistEmail(email.trim())
      setWaitlisted(updated)
      toast('Email saved', { description: "We'll notify you when a spot opens up." })
    } catch {
      toast.error('Something went wrong', { description: 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">You're on the waitlist</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          We're limiting access while we get things running smoothly. You've been added to the waitlist.
          When a spot opens up, you'll need to sign in with the same Lichess account.
        </p>
      </div>
      <form onSubmit={(e) => void handleSubmit(e)} className="flex w-full max-w-sm flex-col gap-4">
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
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            Leave your email and we'll let you know when you're in.
          </p>
        </div>
        <Button type="submit" disabled={saving || !email.trim()}>
          {saving ? 'Saving…' : waitlisted.email ? 'Update email' : 'Notify me'}
        </Button>
      </form>
    </div>
  )
}
