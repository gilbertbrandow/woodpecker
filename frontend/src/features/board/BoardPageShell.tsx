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

  const handleOpen = (): void => {
    setOpen(true)
    if (!hasOpened) setHasOpened(true)
  }

  return (
    <div className="flex flex-1 flex-col overflow-x-hidden pb-3 lg:pb-0 lg:px-0">
      <div className="flex flex-1 items-start justify-center lg:items-center lg:overflow-hidden lg:px-6">
        <div className="flex w-full items-start justify-center gap-6 lg:justify-center">
          <aside className="hidden min-w-0 flex-1 flex-col gap-4 lg:flex" style={{ height: boardSize }}>
            {left}
          </aside>
          {center}
          <aside className="hidden min-w-0 flex-1 flex-col gap-2 lg:flex" style={{ height: boardSize }}>
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
                onClick={() => setOpen(false)}
              />
              {/* Panel — mounted once, slides in/out via CSS transform */}
              <div
                role="dialog"
                aria-modal="true"
                className={cn(
                  'fixed inset-x-0 bottom-0 z-50 mt-24 flex h-[70dvh] flex-col rounded-t-[10px] border bg-background',
                  'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                  open ? 'translate-y-0' : 'translate-y-full',
                )}
              >
                <div
                  className="mx-auto mt-4 mb-4 h-2 w-[100px] cursor-pointer rounded-full bg-muted"
                  onClick={() => setOpen(false)}
                />
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
