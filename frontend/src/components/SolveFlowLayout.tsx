import * as React from 'react'
import { Outlet } from '@tanstack/react-router'
import { SolveSessionProvider } from '../context/solveSession'
import { SolveHeader } from './SolveHeader'

export function SolveFlowLayout(): React.ReactElement {
  return (
    <SolveSessionProvider>
      <SolveHeader />
      <Outlet />
    </SolveSessionProvider>
  )
}