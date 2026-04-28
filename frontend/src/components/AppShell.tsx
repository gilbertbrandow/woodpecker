import * as React from 'react'
import { Outlet } from '@tanstack/react-router'
import { SidebarProvider, SidebarInset, SidebarTrigger } from './ui/sidebar'
import { Separator } from './ui/separator'
import { AppSidebar } from './AppSidebar'
import { Footer } from './Footer'
import { ThemeToggle } from './ThemeToggle'

export function AppShell(): React.ReactElement {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <ThemeToggle />
        </header>
        <div className="flex flex-1 flex-col">
          <Outlet />
        </div>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  )
}
