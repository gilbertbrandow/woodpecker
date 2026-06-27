import * as React from 'react'
import { useState, useEffect } from 'react'
import { api, type AdminStats } from '../lib/api'
import { cn } from '../lib/utils'

export function AdminUserCapBanner(): React.ReactElement | null {
  const [stats, setStats] = useState<AdminStats | null>(null)

  useEffect(() => {
    api.admin.stats().then(setStats).catch(() => {})
  }, [])

  if (!stats) return null

  if (stats.maxUsers === 0) {
    return (
      <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        User cap not configured — all new users are waitlisted unless whitelisted.
      </div>
    )
  }

  const pct = Math.min(100, Math.round((stats.activeUserCount / stats.maxUsers) * 100))
  const remaining = Math.max(0, stats.maxUsers - stats.activeUserCount)
  const atCapacity = remaining === 0

  return (
    <div className="rounded-lg border bg-muted/50 px-4 py-5">
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium">User capacity</span>
        <span className="tabular-nums text-muted-foreground">
          {stats.activeUserCount} / {stats.maxUsers}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-foreground/15">
        <div
          className={cn('h-full rounded-full transition-all', atCapacity ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {atCapacity
          ? 'At capacity — new users are waitlisted unless whitelisted'
          : `${remaining} slot${remaining !== 1 ? 's' : ''} remaining`}
      </p>
    </div>
  )
}
