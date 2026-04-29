import * as React from 'react'
import { useEffect } from 'react'
import { Outlet, useNavigate } from '@tanstack/react-router'
import { SidebarProvider, SidebarInset, SidebarTrigger } from './ui/sidebar'
import { Separator } from './ui/separator'
import { AppSidebar } from './AppSidebar'
import { Footer } from './Footer'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '../context/auth'

export function AppShell(): React.ReactElement {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: '/' })
    }
  }, [user, loading, navigate])

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <ThemeToggle />
        </header>
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
