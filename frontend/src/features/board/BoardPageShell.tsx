import * as React from 'react'
import { ChevronUp } from 'lucide-react'
import { cn } from '../../lib/utils'

type BoardPageShellProps = {
  boardSize: number
  left: React.ReactNode
  center: React.ReactNode
  right: React.ReactNode
  mobileExtras?: React.ReactNode
  mobileDrawerContent?: React.ReactNode
}

const DRAG_CLOSE_THRESHOLD_PX = 100

export function BoardPageShell({
  boardSize,
  left,
  center,
  right,
  mobileExtras,
  mobileDrawerContent,
}: BoardPageShellProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  // Panel is mounted once (after first open) and stays alive so filter state persists
  // across close/open cycles without a portal unmount.
  const [hasOpened, setHasOpened] = React.useState(false)

  const panelRef = React.useRef<HTMLDivElement>(null)
  // touchstart Y captured only when the drag handle is the origin touch target
  const dragStartYRef = React.useRef<number | null>(null)

  const closePanel = React.useCallback((): void => setOpen(false), [])

  const handleOpen = (): void => {
    setOpen(true)
    if (!hasOpened) setHasOpened(true)
  }

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, closePanel])

  // Drag starts only when the user touches the dedicated drag handle, so scroll
  // interactions in the content area never trigger a close gesture.
  const handleDragHandleTouchStart = (e: React.TouchEvent): void => {
    dragStartYRef.current = e.touches[0].clientY
    if (panelRef.current) panelRef.current.style.transition = 'none'
  }

  // Tracked on the panel so the gesture continues even if the finger leaves the handle.
  const handlePanelTouchMove = (e: React.TouchEvent): void => {
    if (dragStartYRef.current === null) return
    const delta = Math.max(0, e.touches[0].clientY - dragStartYRef.current)
    if (panelRef.current) panelRef.current.style.transform = `translateY(${delta}px)`
  }

  const handlePanelTouchEnd = (): void => {
    if (dragStartYRef.current === null) return
    const panel = panelRef.current
    dragStartYRef.current = null
    if (!panel) return

    // Read current offset from the inline style we set during the drag.
    const match = /translateY\(([^)]+)px\)/.exec(panel.style.transform)
    const currentOffset = match ? parseFloat(match[1]) : 0

    panel.style.transition = 'transform 0.3s cubic-bezier(0.32,0.72,0,1)'

    if (currentOffset >= DRAG_CLOSE_THRESHOLD_PX) {
      // Animate to fully off-screen, then flip the React state.
      panel.style.transform = 'translateY(100%)'
      setTimeout(() => {
        setOpen(false)
        if (panelRef.current) {
          panelRef.current.style.transform = ''
          panelRef.current.style.transition = ''
        }
      }, 300)
    } else {
      // Snap back: animate to 0, then let CSS classes take over.
      panel.style.transform = 'translateY(0)'
      setTimeout(() => {
        if (panelRef.current) {
          panelRef.current.style.transform = ''
          panelRef.current.style.transition = ''
        }
      }, 300)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-x-hidden pb-3 lg:pb-0 lg:px-0">
      <div className="flex flex-1 items-start justify-center lg:items-center lg:overflow-hidden lg:px-4">
        <div className="flex w-full items-start justify-center gap-6 lg:justify-center">
          <aside className="hidden min-w-0 flex-1 flex-col gap-4 lg:flex" style={{ height: boardSize + 36 }}>
            {left}
          </aside>
          {center}
          <aside className="hidden min-w-0 flex-1 flex-col gap-2 lg:flex" style={{ height: boardSize + 36 }}>
            {right}
          </aside>
        </div>
      </div>
      {mobileExtras && (
        <div className="px-3 lg:hidden">{mobileExtras}</div>
      )}
      {mobileDrawerContent && (
        <div className="lg:hidden">
          <div className="px-3">
            <button
              type="button"
              onClick={handleOpen}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-border py-2 text-sm text-muted-foreground"
            >
              <ChevronUp className="h-4 w-4" />
              Stats &amp; history
            </button>
          </div>

          {hasOpened && (
            <>
              {/* Backdrop */}
              <div
                aria-hidden
                className={cn(
                  'fixed inset-0 z-40 bg-black/80 transition-opacity duration-300',
                  open ? 'opacity-100' : 'opacity-0 pointer-events-none',
                )}
                onClick={closePanel}
              />
              {/* Panel — mounted once, slides in/out via CSS transform.
                  Touch-move and touch-end are on the panel so the gesture tracks
                  past the handle bounds; drag only activates when started on the handle. */}
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Stats & history"
                onTouchMove={handlePanelTouchMove}
                onTouchEnd={handlePanelTouchEnd}
                className={cn(
                  'fixed inset-x-0 bottom-0 z-50 mt-24 flex h-[70dvh] flex-col rounded-t-[10px] border bg-background',
                  'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                  open ? 'translate-y-0' : 'translate-y-full',
                )}
              >
                <button
                  type="button"
                  aria-label="Close panel"
                  className="group flex w-full items-center justify-center py-4 touch-none"
                  onClick={closePanel}
                  onTouchStart={handleDragHandleTouchStart}
                >
                  <div className="h-2 w-[100px] rounded-full bg-muted transition-colors group-hover:bg-muted-foreground/30" />
                </button>
                <div className="flex-1 overflow-y-auto px-4 pb-6">
                  {mobileDrawerContent}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
