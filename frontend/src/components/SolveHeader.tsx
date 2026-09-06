import * as React from 'react'
import { AppLogo } from './AppLogo'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { useSidebar } from './ui/sidebar'
import { cn } from '../lib/utils'
import { buttonVariants } from './ui/button'
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
        <a
          href="https://github.com/gilbertbrandow/woodpecker"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
          aria-label="GitHub"
        >
          <img src="/github.svg" alt="GitHub" className="h-4 w-4 dark:invert" />
        </a>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
