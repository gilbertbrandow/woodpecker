import { useEffect } from 'react'
import {
  resolveBoardTheme,
  resolvePieceSet,
  DEFAULT_BOARD_THEME_ID,
  DEFAULT_PIECE_SET_ID,
} from '../lib/themes'

const PIECE_CLASS_MAP: Array<{ key: string; type: string; color: string }> = [
  { key: 'wK', type: 'king', color: 'white' },
  { key: 'wQ', type: 'queen', color: 'white' },
  { key: 'wR', type: 'rook', color: 'white' },
  { key: 'wB', type: 'bishop', color: 'white' },
  { key: 'wN', type: 'knight', color: 'white' },
  { key: 'wP', type: 'pawn', color: 'white' },
  { key: 'bK', type: 'king', color: 'black' },
  { key: 'bQ', type: 'queen', color: 'black' },
  { key: 'bR', type: 'rook', color: 'black' },
  { key: 'bB', type: 'bishop', color: 'black' },
  { key: 'bN', type: 'knight', color: 'black' },
  { key: 'bP', type: 'pawn', color: 'black' },
]

const STYLE_ID = 'chess-theme-override'

function buildCSS(boardUrl: string, pieces: Record<string, string>): string {
  const boardRule = `.chess-board-container cg-board {
  background-image: url("${boardUrl}") !important;
  background-size: 100% 100% !important;
  background-repeat: no-repeat !important;
}`

  const pieceRules = PIECE_CLASS_MAP.map(({ key, type, color }) => {
    const url = pieces[key]
    if (!url) return ''
    return `.chess-board-container piece.${type}.${color} {
  background-image: url("${url}") !important;
  background-size: contain !important;
  background-repeat: no-repeat !important;
  background-position: center !important;
}`
  }).join('\n')

  return `${boardRule}\n${pieceRules}`
}

export function useChessTheme(
  boardThemeId: string = DEFAULT_BOARD_THEME_ID,
  pieceSetId: string = DEFAULT_PIECE_SET_ID,
): void {
  useEffect(() => {
    const board = resolveBoardTheme(boardThemeId)
    const pieceSet = resolvePieceSet(pieceSetId)
    const css = buildCSS(board.url, pieceSet.pieces)

    let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = STYLE_ID
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = css

    return () => {
      const el = document.getElementById(STYLE_ID)
      if (el) el.remove()
    }
  }, [boardThemeId, pieceSetId])
}
