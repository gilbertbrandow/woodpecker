import * as React from 'react'
import { cn } from '../lib/utils'
import {
  AVATAR_COLOR_VALUES,
  AVATAR_PIECE_URLS,
  resolveAvatarPieceAndColor,
  type AvatarPiece,
  type AvatarColor,
} from '../lib/avatar'

type DefaultAvatarProps = {
  username: string
  piece?: AvatarPiece
  color?: AvatarColor
  className?: string
}

export function DefaultAvatar({ username, piece, color, className }: DefaultAvatarProps): React.ReactElement {
  const resolved =
    piece !== undefined && color !== undefined
      ? { piece, color }
      : resolveAvatarPieceAndColor(username)

  return (
    <div
      className={cn('shrink-0 rounded-full overflow-hidden flex items-center justify-center', className)}
      style={{ backgroundColor: AVATAR_COLOR_VALUES[resolved.color] }}
      aria-label={`${username}'s avatar`}
      role="img"
    >
      <img
        src={AVATAR_PIECE_URLS[resolved.piece]}
        alt=""
        aria-hidden="true"
        className="h-3/4 w-3/4 object-contain"
      />
    </div>
  )
}
