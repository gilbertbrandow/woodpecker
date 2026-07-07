import * as React from 'react'
import { useEffect } from 'react'
import { Outlet, useNavigate, useMatches, Link } from '@tanstack/react-router'
import { SidebarProvider, SidebarInset, SidebarTrigger, useSidebar } from './ui/sidebar'
import { Separator } from './ui/separator'
import { AppSidebar } from './AppSidebar'
import { Footer } from './Footer'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '../context/auth'
import { Menu, Play } from 'lucide-react'
import { CONCEPT_ICONS } from '../lib/icons'
import { AppLogo } from './AppLogo'
import { useActiveRun } from '../hooks/useActiveRun'
import type { ActiveRun } from '../lib/api'
import { buttonVariants } from './ui/button'
import { cn } from '../lib/utils'
import { BreadcrumbProvider, useBreadcrumbContext } from '../context/breadcrumb'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb'


function AppBreadcrumb(): React.ReactElement | null {
  const matches = useMatches()
  const { title, concept, dynamicParents } = useBreadcrumbContext()
  const LeafIcon = concept ? CONCEPT_ICONS[concept as keyof typeof CONCEPT_ICONS] ?? null : null

  const crumbList = matches.map((m) => m.staticData?.crumb).filter(Boolean)
  const crumb = crumbList[crumbList.length - 1]
  if (!crumb) return null

  const leafLabel = crumb.leaf ?? title ?? '…'
  const allParents = [...(crumb.parents ?? []), ...dynamicParents]

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <span className="text-muted-foreground text-sm">{crumb.group}</span>
        </BreadcrumbItem>
        {allParents.map((parent, i) => (
          <React.Fragment key={i}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={parent.to} className="text-sm">{parent.label}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </React.Fragment>
        ))}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="text-sm">
            {LeafIcon ? (
              <span className="flex items-center gap-1.5">
                <LeafIcon className="h-3.5 w-3.5 shrink-0" />
                {leafLabel}
              </span>
            ) : leafLabel}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function AppShellHeader({ activeRun }: { activeRun: ActiveRun | null }): React.ReactElement {
  const { toggleSidebar } = useSidebar()
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
      {/* Mobile: logo left, controls right */}
      <div className="flex w-full items-center justify-between sm:hidden">
        <AppLogo iconClassName="h-5 w-5" textClassName="text-sm" />
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
      {/* Desktop: sidebar trigger left, breadcrumb center, continue button far right */}
      <div className="hidden w-full sm:flex sm:items-center sm:gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        <ThemeToggle />
        <Separator orientation="vertical" className="h-4 mr-1" />
        <AppBreadcrumb />
        {activeRun !== null && (
          <Link
            to="/app/runs/$runId/solve"
            params={{ runId: String(activeRun.runId) }}
            className={cn(buttonVariants({ size: 'sm' }), 'ml-auto h-7 gap-1.5 whitespace-nowrap text-xs')}
          >
            <Play className="h-3 w-3 shrink-0" />
            Continue training
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
    <BreadcrumbProvider>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar activeRun={activeRun} />
        <SidebarInset className="h-dvh overflow-hidden">
          <AppShellHeader activeRun={activeRun} />
          <div className="flex flex-1 flex-col overflow-y-auto">
            <div className="flex flex-1 flex-col">
              <Outlet />
            </div>
            <Footer className="hidden sm:block" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </BreadcrumbProvider>
  )
}
