import * as React from 'react'
import { Outlet } from '@tanstack/react-router'

export function Layout(): React.ReactElement {
  return (
    <div className="flex min-h-dvh bg-background">
      <Outlet />
    </div>
  )
}
