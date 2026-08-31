import * as React from 'react'
import type { UserRef } from '../lib/api'
import { parseAvatarValue } from '../lib/avatar'
import { DefaultAvatar } from './DefaultAvatar'
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar'
import { HoverCard, HoverCardTrigger, HoverCardContent } from './ui/hover-card'

type UserAvatarProps = {
  user: Pick<UserRef, 'displayName' | 'avatarUrl' | 'isPresent' | 'countryCode'>
  className?: string
}

export function UserAvatar({
  user,
  className = 'h-6 w-6',
}: UserAvatarProps): React.ReactElement {
  const { displayName, avatarUrl, isPresent, countryCode } = user
  const av = parseAvatarValue(avatarUrl)
  const avatarEl =
    av.type === 'custom' ? (
      <Avatar className={`${className} shrink-0`}>
        <AvatarImage src={av.url} alt={displayName} />
        <AvatarFallback>
          <DefaultAvatar username={displayName} className={className} />
        </AvatarFallback>
      </Avatar>
    ) : (
      <DefaultAvatar
        username={displayName}
        piece={av.type === 'default' ? av.piece : undefined}
        color={av.type === 'default' ? av.color : undefined}
        style={av.type === 'default' ? av.style : undefined}
        className={`${className} shrink-0 text-[10px]`}
      />
    )

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span
          className={`relative inline-flex shrink-0 cursor-default ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {avatarEl}
          {isPresent === true && (
            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500 ring-1 ring-background" />
          )}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-auto p-3" side="top" align="center">
        <div className="flex flex-col gap-1.5 min-w-[120px]">
          <span className="text-sm font-medium leading-none">{displayName}</span>
          <div className="flex items-center gap-2 mt-0.5">
            {countryCode && (
              <img
                src={`https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`}
                alt={countryCode}
                className="h-3 w-auto"
              />
            )}
            <div className="flex items-center gap-1">
              {isPresent ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                  <span className="text-xs text-muted-foreground">Online</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full border border-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">Offline</span>
                </>
              )}
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
