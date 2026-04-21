import * as React from 'react'
import { Link } from '@tanstack/react-router'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '../../components/ui/breadcrumb'
import type { RunPuzzleFull } from '../../lib/api'

type BoardBreadcrumbsProps = {
  puzzle: RunPuzzleFull
  participationId: number | null
  runIdStr: string
}

export function BoardBreadcrumbs({ puzzle, participationId, runIdStr }: BoardBreadcrumbsProps): React.ReactElement {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/app">Dashboard</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {participationId !== null ? (
            <BreadcrumbLink asChild>
              <Link
                to="/app/participations/$participationId"
                params={{ participationId: String(participationId) }}
                title={puzzle.scheduleName}
              >
                {puzzle.scheduleName.length > 8 ? `${puzzle.scheduleName.slice(0, 5)}...` : puzzle.scheduleName}
              </Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage title={puzzle.scheduleName}>
              {puzzle.scheduleName.length > 8 ? `${puzzle.scheduleName.slice(0, 5)}...` : puzzle.scheduleName}
            </BreadcrumbPage>
          )}
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/app/runs/$runId" params={{ runId: runIdStr }}>
              Run {puzzle.runIndex + 1}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Puzzle {puzzle.position + 1}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
