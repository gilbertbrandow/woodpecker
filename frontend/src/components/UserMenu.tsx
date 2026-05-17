import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuth } from '../context/auth'
import { parseAvatarValue } from '../lib/avatar'
import { Button } from './ui/button'
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar'
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

  const avatarValue = parseAvatarValue(user.avatarUrl)

  const avatarEl =
    avatarValue.type === 'custom' ? (
      <Avatar className="h-8 w-8">
        <AvatarImage src={avatarValue.url} alt={`${user.displayName}'s avatar`} />
        <AvatarFallback>
          <DefaultAvatar username={user.displayName} className="h-8 w-8" />
        </AvatarFallback>
      </Avatar>
    ) : (
      <DefaultAvatar
        username={user.displayName}
        piece={avatarValue.type === 'default' ? avatarValue.piece : undefined}
        color={avatarValue.type === 'default' ? avatarValue.color : undefined}
        style={avatarValue.type === 'default' ? avatarValue.style : undefined}
        className="h-8 w-8"
      />
    )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="User menu">
          <div className="relative">
            {avatarEl}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-status-online ring-2 ring-background" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void navigate({ to: '/app/profile' })}>
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void navigate({ to: '/app/settings' })}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void handleSignOut()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
