import * as React from 'react'
import { AppLogo } from './AppLogo'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

export function SolveHeader(): React.ReactElement {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
      <AppLogo iconClassName="h-5 w-5" textClassName="text-sm" />
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
