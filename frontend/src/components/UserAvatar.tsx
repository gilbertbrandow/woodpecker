import * as React from 'react'
import { parseAvatarValue } from '../lib/avatar'
import { DefaultAvatar } from './DefaultAvatar'
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'

type UserAvatarProps = {
  username: string
  avatarUrl: string | null
  className?: string
}

export function UserAvatar({
  username,
  avatarUrl,
  className = 'h-6 w-6',
}: UserAvatarProps): React.ReactElement {
  const av = parseAvatarValue(avatarUrl)
  const avatar =
    av.type === 'custom' ? (
      <Avatar className={`${className} shrink-0`}>
        <AvatarImage src={av.url} alt={username} />
        <AvatarFallback>
          <DefaultAvatar username={username} className={className} />
        </AvatarFallback>
      </Avatar>
    ) : (
      <DefaultAvatar
        username={username}
        piece={av.type === 'default' ? av.piece : undefined}
        color={av.type === 'default' ? av.color : undefined}
        style={av.type === 'default' ? av.style : undefined}
        className={`${className} shrink-0 text-[10px]`}
      />
    )

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <span
          className="inline-flex cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          {avatar}
        </span>
      </TooltipTrigger>
      <TooltipContent>{username}</TooltipContent>
    </Tooltip>
  )
}
