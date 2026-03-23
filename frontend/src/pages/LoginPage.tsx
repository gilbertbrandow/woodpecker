import * as React from 'react'
import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../context/auth'
import { Button } from '../components/ui/button'
import { LichessIcon } from '../components/LichessIcon'

export function LoginPage(): React.ReactElement | null {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: '/app' })
    }
  }, [user, loading, navigate])

  if (loading) return null

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Woodpecker is a free training tool for Lichess players. Sign in with your Lichess account
          to get started.
        </p>
      </div>
      <a href="/api/auth/login">
        <Button size="lg" className="gap-3">
          <LichessIcon className="h-5 w-5" />
          Sign in with Lichess
        </Button>
      </a>
    </div>
  )
}
