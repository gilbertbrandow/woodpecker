import * as React from 'react'
import { cn } from '../lib/utils'
import {
  AVATAR_COLOR_VALUES,
  AVATAR_PIECE_URLS,
  resolveAvatarDefaults,
  type AvatarPiece,
  type AvatarColor,
  type AvatarStyle,
} from '../lib/avatar'
import { PIECE_SETS } from '../lib/themes'

type DefaultAvatarProps = {
  username: string
  piece?: AvatarPiece
  color?: AvatarColor
  style?: AvatarStyle
  className?: string
}

export function DefaultAvatar({ username, piece, color, style, className }: DefaultAvatarProps): React.ReactElement {
  const resolved =
    piece !== undefined && color !== undefined
      ? { piece, color, style: style ?? 'alpha' as AvatarStyle }
      : resolveAvatarDefaults(username)

  const pieceKey = `${resolved.piece[0]}${resolved.piece[1].toUpperCase()}`
  const pieceSet = PIECE_SETS.find(s => s.id === resolved.style)
  const pieceUrl = pieceSet?.pieces[pieceKey] ?? AVATAR_PIECE_URLS[resolved.piece]

  return (
    <div
      className={cn('shrink-0 rounded-full overflow-hidden flex items-center justify-center', className)}
      style={{ backgroundColor: AVATAR_COLOR_VALUES[resolved.color] }}
      aria-label={`${username}'s avatar`}
      role="img"
    >
      <img
        src={pieceUrl}
        alt=""
        aria-hidden="true"
        className="h-3/4 w-3/4 object-contain"
      />
    </div>
  )
}
