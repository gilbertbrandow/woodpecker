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

type BoardBreadcrumbsProps = {
  runIndex: number
  position: number
  trainingId: number | null
  scheduleName: string | null
  runIdStr: string
  linksDisabled?: boolean
}

export function BoardBreadcrumbs({
  runIndex,
  position,
  trainingId,
  scheduleName,
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
        {scheduleName !== null && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {linksDisabled ? (
                <BreadcrumbPage
                  className={disabledClass}
                  title="Navigation disabled while solving"
                >
                  {scheduleName.length > 8 ? `${scheduleName.slice(0, 5)}...` : scheduleName}
                </BreadcrumbPage>
              ) : trainingId !== null ? (
                <BreadcrumbLink asChild>
                  <Link
                    to="/app/training/$trainingId"
                    params={{ trainingId: String(trainingId) }}
                    title={scheduleName}
                  >
                    {scheduleName.length > 8 ? `${scheduleName.slice(0, 5)}...` : scheduleName}
                  </Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage title={scheduleName}>
                  {scheduleName.length > 8 ? `${scheduleName.slice(0, 5)}...` : scheduleName}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </>
        )}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {linksDisabled ? (
            <BreadcrumbPage className={disabledClass} title="Navigation disabled while solving">
              Run {runIndex + 1}
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link to="/app/runs/$runId" params={{ runId: runIdStr }}>
                Run {runIndex + 1}
              </Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Puzzle {position + 1}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
