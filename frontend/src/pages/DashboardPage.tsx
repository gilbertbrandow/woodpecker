import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuth } from '../context/auth'
import { Button } from '../components/ui/button'
import { ThemeToggle } from '../components/ThemeToggle'

export function DashboardPage() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, loading, navigate])

  if (loading || !user) return null

  const handleLogout = async () => {
    await logout()
    toast('Signed out', { description: 'See you next time.' })
    void navigate({ to: '/' })
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Woodpecker</h1>
        <p className="text-muted-foreground">Signed in as {user.username}</p>
        <Button variant="outline" onClick={() => void handleLogout()}>
          Sign out
        </Button>
      </div>
    </div>
  )
}
