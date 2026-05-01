import * as React from 'react'
import { useEffect } from 'react'
import { Outlet, useNavigate } from '@tanstack/react-router'
import { SidebarProvider, SidebarInset, SidebarTrigger, useSidebar } from './ui/sidebar'
import { Separator } from './ui/separator'
import { AppSidebar } from './AppSidebar'
import { Footer } from './Footer'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '../context/auth'
import { Menu, Play } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import woodpeckerLogo from '../assets/woodpecker.svg'
import { useActiveRun } from '../hooks/useActiveRun'
import type { ActiveRun } from '../lib/api'
import { buttonVariants } from './ui/button'
import { cn } from '../lib/utils'

function AppShellHeader({ activeRun }: { activeRun: ActiveRun | null }): React.ReactElement {
  const { toggleSidebar } = useSidebar()
  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border px-4">
      {/* Mobile: logo left, controls right */}
      <div className="flex w-full items-center justify-between sm:hidden">
        <Link to="/app" className="flex items-center gap-2">
          <img src={woodpeckerLogo} alt="Woodpecker logo" className="h-5 w-5 dark:invert" />
          <span className="text-sm font-semibold">Woodpecker</span>
        </Link>
        <div className="flex items-center gap-1">
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
      </div>
      {/* Desktop: sidebar trigger left, continue button far right */}
      <div className="hidden w-full sm:flex sm:items-center sm:gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        <ThemeToggle />
        {activeRun !== null && (
          <Link
            to="/app/runs/$runId/solve"
            params={{ runId: String(activeRun.runId) }}
            className={cn(buttonVariants({ size: 'sm' }), 'ml-auto h-7 gap-1.5 whitespace-nowrap text-xs')}
          >
            <Play className="h-3 w-3 shrink-0" />
            Continue Run {activeRun.runIndex + 1}
          </Link>
        )}
      </div>
    </header>
  )
}

export function AppShell(): React.ReactElement {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const { data: activeRun } = useActiveRun()

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, loading, navigate])

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar activeRun={activeRun} />
      <SidebarInset className="h-svh overflow-hidden">
        <AppShellHeader activeRun={activeRun} />
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-1 flex-col">
            <Outlet />
          </div>
          <Footer />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
