import * as React from 'react'
import { Outlet } from '@tanstack/react-router'
import { SolveSessionProvider } from '../context/solveSession'

export function SolveFlowLayout(): React.ReactElement {
  return (
    <SolveSessionProvider>
      <Outlet />
    </SolveSessionProvider>
  )
}