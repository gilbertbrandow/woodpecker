import * as React from 'react'
import { ChevronUp } from 'lucide-react'
import { Drawer, DrawerContent, DrawerTrigger } from '../../components/ui/drawer'

type BoardPageShellProps = {
  boardSize: number
  left: React.ReactNode
  center: React.ReactNode
  right: React.ReactNode
  mobileHeader: React.ReactNode
  mobileExtras?: React.ReactNode
  mobileDrawerContent?: React.ReactNode
}

export function BoardPageShell({
  boardSize,
  left,
  center,
  right,
  mobileHeader,
  mobileExtras,
  mobileDrawerContent,
}: BoardPageShellProps): React.ReactElement {
  return (
    <div className="flex flex-1 flex-col overflow-x-hidden lg:px-0">
      <div className="flex-none px-3 pt-3 pb-2 lg:hidden">
        {mobileHeader}
      </div>
      <div className="flex flex-1 items-start justify-center lg:items-center lg:overflow-hidden lg:px-6">
        <div className="flex w-full items-start justify-center gap-6 lg:justify-center">
          <aside className="hidden flex-1 flex-col gap-4 lg:flex" style={{ height: boardSize }}>
            {left}
          </aside>
          {center}
          <aside className="hidden flex-1 flex-col gap-2 lg:flex" style={{ height: boardSize }}>
            {right}
          </aside>
        </div>
      </div>
      {mobileExtras && (
        <div className="px-3 lg:hidden">{mobileExtras}</div>
      )}
      {mobileDrawerContent && (
        <Drawer modal={false}>
          <div className="px-3 lg:hidden">
            <DrawerTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-md border border-border py-2 text-sm text-muted-foreground"
              >
                <ChevronUp className="h-4 w-4" />
                Stats &amp; history
              </button>
            </DrawerTrigger>
          </div>
          <DrawerContent className="flex h-[82dvh] flex-col">
            <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2" data-vaul-no-drag>
              {mobileDrawerContent}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  )
}
