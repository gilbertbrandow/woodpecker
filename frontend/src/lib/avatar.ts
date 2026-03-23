import bk from '../assets/alpha/bk.svg'
import bq from '../assets/alpha/bq.svg'
import br from '../assets/alpha/br.svg'
import bb from '../assets/alpha/bb.svg'
import bn from '../assets/alpha/bn.svg'

export const AVATAR_PIECE_URLS: Record<string, string> = { bk, bq, br, bb, bn }

export const AVATAR_PIECES = ['bk', 'bq', 'br', 'bb', 'bn'] as const
export const AVATAR_COLORS = [
  'navy', 'sky', 'forest', 'sage', 'amber', 'straw', 'crimson', 'rust',
] as const

export type AvatarPiece = typeof AVATAR_PIECES[number]
export type AvatarColor = typeof AVATAR_COLORS[number]

export const AVATAR_COLOR_VALUES: Record<AvatarColor, string> = {
  navy:    '#4d7fa0',
  sky:     '#6b9fc2',
  forest:  '#3d7a52',
  sage:    '#618c6e',
  amber:   '#c49c38',
  straw:   '#b5a84a',
  crimson: '#9c3d4a',
  rust:    '#b05a3a',
}

export type AvatarValue =
  | { type: 'auto' }
  | { type: 'default'; piece: AvatarPiece; color: AvatarColor }
  | { type: 'custom'; url: string }

export function parseAvatarValue(avatarUrl: string | null): AvatarValue {
  if (!avatarUrl) return { type: 'auto' }
  if (avatarUrl.startsWith('default:')) {
    const [, piece, color] = avatarUrl.split(':')
    return { type: 'default', piece: piece as AvatarPiece, color: color as AvatarColor }
  }
  return { type: 'custom', url: avatarUrl }
}

function usernameHash(username: string): number {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

export function resolveAvatarPieceAndColor(username: string): { piece: AvatarPiece; color: AvatarColor } {
  const hash = usernameHash(username)
  const pieceIndex = Math.floor(hash / AVATAR_COLORS.length) % AVATAR_PIECES.length
  const colorIndex = hash % AVATAR_COLORS.length
  const piece = AVATAR_PIECES[pieceIndex] ?? AVATAR_PIECES[0]
  const color = AVATAR_COLORS[colorIndex] ?? AVATAR_COLORS[0]
  return { piece, color }
}
