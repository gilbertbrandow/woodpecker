import 'chessground/assets/chessground.base.css'
import * as React from 'react'
import { useEffect, useCallback, useLayoutEffect } from 'react'
import { Chess } from 'chess.js'
import type { DrawShape } from 'chessground/draw'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-chessground ships no bundled type declarations
import ReactChessground from 'react-chessground'
// Vite 8 (rolldown) wraps CJS module.exports as { default: … }; fall back for older bundlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Chessground = (ReactChessground as any).default ?? ReactChessground
import { Check, X } from 'lucide-react'
import type { Orientation, PendingPromotion, MoveFeedbackResult } from './boardPage.helpers'

type CheckColor = 'white' | 'black' | false

type ChessgroundInstance = { cg: { set: (config: { drawable?: { shapes?: DrawShape[] } }) => void } }

type PromotionPickerProps = {
  pending: PendingPromotion
  orientation: Orientation
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void
  onCancel: () => void
}

function PromotionPicker({ pending, orientation, onSelect, onCancel }: PromotionPickerProps): React.ReactElement {
  const fileIndex = pending.dest.charCodeAt(0) - 97
  const colIndex = orientation === 'white' ? fileIndex : 7 - fileIndex
  const leftPct = colIndex * 12.5

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  const pieces: Array<{ piece: 'q' | 'r' | 'b' | 'n'; label: string }> = [
    { piece: 'q', label: 'Q' },
    { piece: 'r', label: 'R' },
    { piece: 'b', label: 'B' },
    { piece: 'n', label: 'N' },
  ]

  return (
    <div
      className="absolute inset-0 z-10"
      onClick={onCancel}
      onContextMenu={(e) => { e.preventDefault(); onCancel() }}
    >
      <div
        className="absolute top-0 flex flex-col border border-border bg-background shadow-md"
        style={{ left: `${leftPct}%`, width: '12.5%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {pieces.map(({ piece, label }) => (
          <button
            key={piece}
            type="button"
            className="flex w-full items-center justify-center border-b border-border py-2 text-sm font-semibold hover:bg-accent last:border-b-0"
            onClick={() => onSelect(piece)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

type MoveFeedbackBadgeProps = {
  result: MoveFeedbackResult
  square: string
  orientation: Orientation
}

function MoveFeedbackBadge({ result, square, orientation }: MoveFeedbackBadgeProps): React.ReactElement | null {
  if (square.length !== 2) return null

  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1])
  if (Number.isNaN(rank) || file < 0 || file > 7 || rank < 1 || rank > 8) return null

  const col = orientation === 'white' ? file : 7 - file
  const row = orientation === 'white' ? 8 - rank : rank - 1
  const left = col * 12.5
  const top = row * 12.5
  const isCorrect = result === 'correct'

  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{ left: `${left}%`, top: `${top}%`, width: '12.5%', height: '12.5%' }}
    >
      <div
        className={`absolute right-[6%] top-[6%] flex h-[38%] w-[38%] items-center justify-center rounded-full border shadow-sm ${
          isCorrect
            ? 'border-emerald-300/90 bg-emerald-500/85 text-white'
            : 'border-red-300/90 bg-red-500/85 text-white'
        }`}
      >
        {isCorrect ? <Check className="h-[65%] w-[65%]" strokeWidth={3} /> : <X className="h-[65%] w-[65%]" strokeWidth={3} />}
      </div>
    </div>
  )
}

export type BoardSurfaceProps = {
  boardKey: number
  boardSize: number
  fen: string
  orientation: Orientation
  dests: Map<string, string[]>
  lastMove: [string, string] | undefined
  hintSquare: string | null
  pendingPromotion: PendingPromotion | null
  moveFeedback: {
    result: MoveFeedbackResult | null
    square: string | null
    visible: boolean
  }
  animationEnabled?: boolean
  onMove: (orig: string, dest: string) => void
  onPromotionSelect: (piece: 'q' | 'r' | 'b' | 'n') => void
  onPromotionCancel: () => void
}

export function BoardSurface({
  boardKey,
  boardSize,
  fen,
  orientation,
  dests,
  lastMove,
  hintSquare,
  pendingPromotion,
  moveFeedback,
  animationEnabled = true,
  onMove,
  onPromotionSelect,
  onPromotionCancel,
}: BoardSurfaceProps): React.ReactElement {
  const cgRef = React.useRef<ChessgroundInstance | null>(null)
  const drawnShapesRef = React.useRef<DrawShape[]>([])
  const prevBoardKeyRef = React.useRef(boardKey)
  const prevFenRef = React.useRef(fen)

  if (prevBoardKeyRef.current !== boardKey) {
    prevBoardKeyRef.current = boardKey
    drawnShapesRef.current = []
  }
  if (prevFenRef.current !== fen) {
    prevFenRef.current = fen
    drawnShapesRef.current = []
  }

  const handleDrawableChange = useCallback((shapes: DrawShape[]) => {
    drawnShapesRef.current = shapes
  }, [])

  useLayoutEffect(() => {
    cgRef.current?.cg.set({ drawable: { shapes: drawnShapesRef.current } })
  })

  const check = React.useMemo((): CheckColor => {
    const chess = new Chess(fen)
    if (!chess.inCheck()) return false
    return chess.turn() === 'w' ? 'white' : 'black'
  }, [fen])

  return (
    <div className="chess-board-container relative shrink-0" style={{ width: boardSize, height: boardSize }}>
      <Chessground
        ref={cgRef}
        key={boardKey}
        width={boardSize}
        height={boardSize}
        fen={fen}
        orientation={orientation}
        turnColor={orientation}
        coordinates={true}
        movable={{
          color: orientation,
          dests,
          showDests: true,
          free: false,
          events: { after: onMove },
        }}
        draggable={{ showGhost: true }}
        lastMove={lastMove}
        check={check}
        animation={{ enabled: animationEnabled, duration: 150 }}
        highlight={{ lastMove: true, check: true }}
        premovable={{ enabled: false }}
        drawable={{
          enabled: true,
          visible: true,
          eraseOnClick: false,
          defaultSnapToValidMove: false,
          autoShapes: hintSquare ? [{ orig: hintSquare, brush: 'yellow' }] : [],
          onChange: handleDrawableChange,
        }}
      />
      {pendingPromotion && (
        <PromotionPicker
          pending={pendingPromotion}
          orientation={orientation}
          onSelect={onPromotionSelect}
          onCancel={onPromotionCancel}
        />
      )}
      {moveFeedback.visible && moveFeedback.result && moveFeedback.square && (
        <MoveFeedbackBadge
          result={moveFeedback.result}
          square={moveFeedback.square}
          orientation={orientation}
        />
      )}
    </div>
  )
}
