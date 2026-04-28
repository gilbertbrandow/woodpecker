import * as React from 'react'
import { Link } from '@tanstack/react-router'
import woodpeckerLogo from '../assets/woodpecker.svg'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

export function SolveHeader(): React.ReactElement {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
      <Link to="/app" className="flex items-center gap-2">
        <img src={woodpeckerLogo} alt="Woodpecker logo" className="h-5 w-5 dark:invert" />
        <span className="text-sm font-semibold tracking-tight text-foreground">Woodpecker</span>
      </Link>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
