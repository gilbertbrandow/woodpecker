import * as React from 'react'
import { Outlet } from '@tanstack/react-router'
import { SidebarNav } from './Sidebar'

export function AppShell(): React.ReactElement {
  return (
    <div className="flex flex-1">
      <aside className="hidden w-52 shrink-0 border-r border-border md:block">
        <SidebarNav />
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
