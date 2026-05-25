import * as React from 'react'
import { AppLogo } from './AppLogo'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { useSidebar } from './ui/sidebar'
import { Menu } from 'lucide-react'

export function SolveHeader(): React.ReactElement {
  const { toggleSidebar } = useSidebar()
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
      <AppLogo iconClassName="h-5 w-5" textClassName="text-sm" />
      <div className="flex items-center gap-1 sm:hidden">
        <ThemeToggle />
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <div className="hidden items-center gap-1 sm:flex">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
