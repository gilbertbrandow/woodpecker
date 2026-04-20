export const DEFAULT_BOARD_THEME_ID = 'green'
export const DEFAULT_PIECE_SET_ID = 'cburnett'

export type BoardTheme = {
  id: string
  label: string
  url: string
  thumbnailUrl: string | null
}

export type PieceSet = {
  id: string
  label: string
  pieces: Record<string, string>
  knightPreviewUrl: string
}

const REQUIRED_PIECE_KEYS = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']

function humanize(id: string): string {
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function isMainBoardFile(filename: string): boolean {
  // Accept only files with exactly one dot: <name>.<ext>
  // Excludes .thumbnail.*, .orig.*, .current-premove.*, etc.
  return filename.split('.').length === 2
}

// Import all board images and thumbnails eagerly so Vite bundles and hashes them.
const boardMainGlob = import.meta.glob('../assets/board/*.{png,jpg,jpeg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const boardThumbGlob = import.meta.glob('../assets/board/*.thumbnail.{png,jpg,jpeg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

// Import all piece SVGs eagerly.
const pieceGlob = import.meta.glob('../assets/piece/**/*.svg', {
  eager: true,
  import: 'default',
}) as Record<string, string>

function buildBoardThemes(): BoardTheme[] {
  const thumbByName = new Map<string, string>()
  for (const [path, url] of Object.entries(boardThumbGlob)) {
    const filename = path.split('/').pop()!
    // filename like "green.thumbnail.png" → id "green"
    const id = filename.split('.')[0]
    thumbByName.set(id, url)
  }

  const themes: BoardTheme[] = []
  for (const [path, url] of Object.entries(boardMainGlob)) {
    const filename = path.split('/').pop()!
    if (!isMainBoardFile(filename)) continue
    const dotIdx = filename.lastIndexOf('.')
    const id = filename.slice(0, dotIdx)
    themes.push({
      id,
      label: humanize(id),
      url,
      thumbnailUrl: thumbByName.get(id) ?? null,
    })
  }

  return themes.sort((a, b) => a.id.localeCompare(b.id))
}

function buildPieceSets(): PieceSet[] {
  // Group SVGs by set directory name.
  const bySet = new Map<string, Record<string, string>>()
  for (const [path, url] of Object.entries(pieceGlob)) {
    const parts = path.split('/')
    const setName = parts[parts.length - 2]
    const pieceName = parts[parts.length - 1].replace('.svg', '')
    if (!bySet.has(setName)) bySet.set(setName, {})
    bySet.get(setName)![pieceName] = url
  }

  const sets: PieceSet[] = []
  for (const [id, pieces] of bySet) {
    if (!REQUIRED_PIECE_KEYS.every((k) => k in pieces)) continue
    sets.push({
      id,
      label: humanize(id),
      pieces,
      knightPreviewUrl: pieces['wN'],
    })
  }

  return sets.sort((a, b) => a.id.localeCompare(b.id))
}

export const BOARD_THEMES: BoardTheme[] = buildBoardThemes()
export const PIECE_SETS: PieceSet[] = buildPieceSets()

export function resolveBoardTheme(id: string): BoardTheme {
  return (
    BOARD_THEMES.find((t) => t.id === id) ??
    BOARD_THEMES.find((t) => t.id === DEFAULT_BOARD_THEME_ID) ??
    BOARD_THEMES[0]
  )
}

export function resolvePieceSet(id: string): PieceSet {
  return (
    PIECE_SETS.find((p) => p.id === id) ??
    PIECE_SETS.find((p) => p.id === DEFAULT_PIECE_SET_ID) ??
    PIECE_SETS[0]
  )
}
