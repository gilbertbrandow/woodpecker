import * as React from 'react'

type BoardResizeHandleProps = {
  boardSize: number
  onResize: (size: number) => void
  onCommit: () => void
}

type DragStart = { x: number; y: number; size: number }

export function BoardResizeHandle({ boardSize, onResize, onCommit }: BoardResizeHandleProps): React.ReactElement {
  const dragStartRef = React.useRef<DragStart | null>(null)

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartRef.current = { x: e.clientX, y: e.clientY, size: boardSize }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>): void => {
    const start = dragStartRef.current
    if (!start) return
    // The board is centred, so its corner moves half as far as it grows: summing both
    // axes keeps the handle under the cursor on a diagonal drag.
    onResize(start.size + (e.clientX - start.x) + (e.clientY - start.y))
  }

  const endDrag = (): void => {
    if (!dragStartRef.current) return
    dragStartRef.current = null
    onCommit()
  }

  const handleDoubleClick = (): void => {
    onResize(Number.POSITIVE_INFINITY)
    onCommit()
  }

  return (
    <button
      type="button"
      aria-label="Resize board"
      title="Drag to resize · double-click to reset"
      className="group absolute -bottom-3 -right-3 z-30 hidden h-6 w-6 cursor-nwse-resize touch-none items-end justify-end p-1 lg:flex"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={handleDoubleClick}
    >
      <span className="h-2.5 w-2.5 rounded-br-[3px] border-b-2 border-r-2 border-muted-foreground/40 transition-colors group-hover:border-foreground group-active:border-foreground" />
    </button>
  )
}
