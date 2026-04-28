import * as React from 'react'
import { Outlet } from '@tanstack/react-router'
import { SolveSessionProvider } from '../context/solveSession'
import { SolveHeader } from './SolveHeader'
import { Footer } from './Footer'

export function SolveFlowLayout(): React.ReactElement {
  return (
    <SolveSessionProvider>
      <div className="flex min-h-dvh w-full flex-col">
        <SolveHeader />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Outlet />
        </div>
        <Footer />
      </div>
    </SolveSessionProvider>
  )
}