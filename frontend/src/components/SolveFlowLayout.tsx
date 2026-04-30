import * as React from 'react'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { SolveSessionProvider } from '../context/solveSession'
import { SolveHeader } from './SolveHeader'
import { Footer } from './Footer'

const BOARD_ROUTE_RE = /\/runs\/[^/]+\/(puzzles|solve)/

export function SolveFlowLayout(): React.ReactElement {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isBoardRoute = BOARD_ROUTE_RE.test(pathname)

  return (
    <SolveSessionProvider>
      <div className="flex min-h-dvh w-full flex-col">
        <SolveHeader />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Outlet />
        </div>
        <Footer className={isBoardRoute ? 'hidden sm:block' : ''} />
      </div>
    </SolveSessionProvider>
  )
}