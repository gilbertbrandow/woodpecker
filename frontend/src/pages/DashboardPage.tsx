import * as React from 'react'
import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../context/auth'

export function DashboardPage(): React.ReactElement | null {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, loading, navigate])

  if (loading || !user) return null

  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <p className="text-muted-foreground">Signed in as {user.username}</p>
    </div>
  )
}
