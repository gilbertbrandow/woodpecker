import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../context/auth'
import { Button } from '../components/ui/button'
import { LichessIcon } from '../components/LichessIcon'
import { ThemeToggle } from '../components/ThemeToggle'

export function LoginPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: '/app' })
    }
  }, [user, loading, navigate])

  if (loading) return null

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="flex flex-col items-center gap-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Woodpecker</h1>
        <a href="/api/auth/login">
          <Button size="lg" className="gap-3">
            <LichessIcon className="h-5 w-5" />
            Sign in with Lichess
          </Button>
        </a>
      </div>
      <a
        href="https://www.amazon.se/-/en/Axel-Smith/dp/1784830542"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-6 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Based on the Woodpecker Method by Axel Smith
      </a>
    </div>
  )
}
