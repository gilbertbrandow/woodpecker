import bk from '../assets/piece/alpha/bK.svg'
import bq from '../assets/piece/alpha/bQ.svg'
import br from '../assets/piece/alpha/bR.svg'
import bb from '../assets/piece/alpha/bB.svg'
import bn from '../assets/piece/alpha/bN.svg'

export const AVATAR_PIECE_URLS: Record<string, string> = { bk, bq, br, bb, bn }

export const AVATAR_PIECES = ['bk', 'bq', 'br', 'bb', 'bn'] as const
export const AVATAR_COLORS = [
  'navy', 'sky', 'forest', 'sage', 'amber', 'straw', 'crimson', 'rust',
] as const
export const AVATAR_STYLES = ['alpha', 'anarcandy', 'companion', 'maestro', 'merida'] as const

export type AvatarPiece = typeof AVATAR_PIECES[number]
export type AvatarColor = typeof AVATAR_COLORS[number]
export type AvatarStyle = typeof AVATAR_STYLES[number]

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
  | { type: 'default'; piece: AvatarPiece; color: AvatarColor; style: AvatarStyle }
  | { type: 'custom'; url: string }

export function parseAvatarValue(avatarUrl: string | null): AvatarValue {
  if (!avatarUrl) return { type: 'auto' }
  if (avatarUrl.startsWith('default:')) {
    const parts = avatarUrl.split(':')
    const piece = parts[1] as AvatarPiece
    const color = parts[2] as AvatarColor
    const style = (parts[3] ?? 'alpha') as AvatarStyle
    return { type: 'default', piece, color, style }
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

export function resolveAvatarDefaults(username: string): { piece: AvatarPiece; color: AvatarColor; style: AvatarStyle } {
  const hash = usernameHash(username)
  const colorIndex = hash % AVATAR_COLORS.length
  const pieceIndex = Math.floor(hash / AVATAR_COLORS.length) % AVATAR_PIECES.length
  const styleIndex = Math.floor(hash / (AVATAR_COLORS.length * AVATAR_PIECES.length)) % AVATAR_STYLES.length
  return {
    piece: AVATAR_PIECES[pieceIndex] ?? AVATAR_PIECES[0],
    color: AVATAR_COLORS[colorIndex] ?? AVATAR_COLORS[0],
    style: AVATAR_STYLES[styleIndex] ?? AVATAR_STYLES[0],
  }
}
