import * as React from 'react'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import woodpeckerLogo from '../assets/woodpecker.svg'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { SidebarNav } from './Sidebar'

export function Header(): React.ReactElement {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <img
              src={woodpeckerLogo}
              alt="Woodpecker logo"
              className="h-6 w-6 dark:invert"
            />
            <span className="text-base font-semibold tracking-tight text-foreground">Woodpecker</span>
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border bg-background">
            <div className="flex h-14 items-center justify-end border-b border-border px-4">
              <button
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
