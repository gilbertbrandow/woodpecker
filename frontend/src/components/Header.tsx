import * as React from 'react'
import { Link } from '@tanstack/react-router'
import woodpeckerLogo from '../assets/woodpecker.svg'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

export function Header(): React.ReactElement {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-6">
      <Link to="/" className="flex items-center gap-2">
        <img
          src={woodpeckerLogo}
          alt="Woodpecker logo"
          className="h-6 w-6 dark:invert"
        />
        <span className="text-base font-semibold tracking-tight text-foreground">Woodpecker</span>
      </Link>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
