import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuth } from '../context/auth'
import { Button } from './ui/button'
import { DefaultAvatar } from './DefaultAvatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

export function UserMenu(): React.ReactElement | null {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

  if (loading || !user) return null

  const handleSignOut = async (): Promise<void> => {
    await logout()
    toast('Signed out', { description: 'See you next time.' })
    void navigate({ to: '/' })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="User menu">
          <div className="relative">
            <DefaultAvatar username={user.username} className="h-8 w-8" />
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-status-online ring-2 ring-background" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void handleSignOut()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
