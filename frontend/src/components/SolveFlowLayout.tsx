import * as React from 'react'
import { Outlet } from '@tanstack/react-router'
import { SolveSessionProvider } from '../context/solveSession'
import { SolveHeader } from './SolveHeader'
import { Footer } from './Footer'
import { SidebarProvider, SidebarInset } from './ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { useActiveRun } from '../hooks/useActiveRun'

export function SolveFlowLayout(): React.ReactElement {
  const { data: activeRun } = useActiveRun()

  return (
    <SolveSessionProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar activeRun={activeRun} collapsible="offcanvas" />
        <SidebarInset className="flex min-h-dvh flex-col">
          <SolveHeader />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Outlet />
          </div>
          <Footer className="hidden sm:block" />
        </SidebarInset>
      </SidebarProvider>
    </SolveSessionProvider>
  )
}
