import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Home } from 'lucide-react'
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
  linksDisabled?: boolean
}

export function BoardBreadcrumbs({
  puzzle,
  participationId,
  runIdStr,
  linksDisabled = false,
}: BoardBreadcrumbsProps): React.ReactElement {
  const disabledClass = 'cursor-not-allowed text-muted-foreground/80'

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {linksDisabled ? (
            <BreadcrumbPage className={disabledClass} title="Navigation disabled while solving">
              <Home className="h-3.5 w-3.5" />
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link to="/app" aria-label="Dashboard"><Home className="h-3.5 w-3.5" /></Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {linksDisabled ? (
            <BreadcrumbPage
              className={disabledClass}
              title="Navigation disabled while solving"
            >
              {puzzle.scheduleName.length > 8 ? `${puzzle.scheduleName.slice(0, 5)}...` : puzzle.scheduleName}
            </BreadcrumbPage>
          ) : participationId !== null ? (
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
          {linksDisabled ? (
            <BreadcrumbPage className={disabledClass} title="Navigation disabled while solving">
              Run {puzzle.runIndex + 1}
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link to="/app/runs/$runId" params={{ runId: runIdStr }}>
                Run {puzzle.runIndex + 1}
              </Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Puzzle {puzzle.position + 1}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
