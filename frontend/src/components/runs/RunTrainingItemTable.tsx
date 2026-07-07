import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { ExternalLink, Play, Eye } from 'lucide-react'
import { DATA_ICONS } from '../../lib/icons'
import { StatusBadge } from '../StatusBadge'
import { TrainingItemTypeBadge } from '../TrainingItemTypeBadge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { DataTable } from '../DataTable'
import { type RunTrainingItemListItem } from '../../lib/api'
import { formatSolveTimeMs } from '../../lib/utils'

const PAGE_SIZE = 25

type RunTrainingItemTableProps = {
  trainingItems: RunTrainingItemListItem[]
  runIdStr: string
  isActive: boolean
}

type ActionButtonProps = {
  tooltip: string
  onClick?: (e: React.MouseEvent) => void
  disabled?: boolean
  children: React.ReactNode
}

function ActionButton({ tooltip, onClick, disabled = false, children }: ActionButtonProps): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors ${
              disabled
                ? 'cursor-not-allowed opacity-35'
                : 'hover:bg-accent hover:text-foreground'
            }`}
          >
            {children}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function RunTrainingItemTable({ trainingItems, runIdStr, isActive }: RunTrainingItemTableProps): React.ReactElement {
  const navigate = useNavigate()

  const openSolveItem = (runTrainingItemId: number): void => {
    if (!isActive) return
    void navigate({
      to: '/app/runs/$runId/training-items/$runTrainingItemId',
      params: { runId: runIdStr, runTrainingItemId: String(runTrainingItemId) },
    })
  }

  const columns: ColumnDef<RunTrainingItemListItem>[] = [
    {
      accessorKey: 'position',
      header: '#',
      enableSorting: false,
      meta: { className: 'w-0' },
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground">{row.original.position + 1}</span>
      ),
    },
    {
      id: 'sourceType',
      header: 'Type',
      meta: { icon: DATA_ICONS.type },
      enableSorting: false,
      cell: ({ row }) => <TrainingItemTypeBadge source={row.original.source.sourceType} />,
    },
    {
      id: 'rating',
      header: 'Rating / Level',
      meta: { className: 'min-w-24', icon: DATA_ICONS.rating },
      accessorFn: (row) =>
        row.source.sourceType === 'LICHESS_TACTIC' ? row.source.rating : null,
      cell: ({ row }) => {
        const src = row.original.source
        if (src.sourceType === 'LICHESS_TACTIC') {
          return <span className="tabular-nums">{src.rating}</span>
        }
        if (src.sourceType === 'SCRAPED_POSITIONAL') {
          const { minRating, maxRating } = src.difficulty
          if (minRating != null && maxRating != null) {
            return <span className="tabular-nums">{minRating}–{maxRating}</span>
          }
          return <span className="text-sm">{src.difficulty.label}</span>
        }
        return <span className="text-muted-foreground">—</span>
      },
    },
    {
      accessorKey: 'positionStatus',
      header: 'Status',
      meta: { className: 'min-w-32', icon: DATA_ICONS.status },
      enableSorting: false,
      cell: ({ row }) => <StatusBadge status={row.original.positionStatus} />,
    },
    {
      accessorKey: 'timeMs',
      header: 'Time',
      meta: { className: 'min-w-28', icon: DATA_ICONS.time },
      sortUndefined: 'last',
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.timeMs !== null ? formatSolveTimeMs(row.original.timeMs) : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'tryCount',
      header: 'Tries',
      meta: { className: 'min-w-20 text-right', icon: DATA_ICONS.tries },
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.tryCount > 0 ? row.original.tryCount : '—'}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      meta: { className: 'sticky right-0 bg-background w-0' },
      cell: ({ row }) => {
        const item = row.original
        const src = item.source
        const externalUrl = src.sourceType === 'LICHESS_TACTIC'
          ? `https://lichess.org/training/${src.displayId}`
          : src.sourceType === 'SCRAPED_POSITIONAL'
            ? src.lichessUrl
            : null
        return (
          <div className="flex items-center gap-0.5">
            {externalUrl !== null && (
              <ActionButton
                tooltip="Open on Lichess"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(externalUrl, '_blank', 'noopener,noreferrer')
                }}
              >
                <ExternalLink className="h-4 w-4" />
              </ActionButton>
            )}
            <ActionButton
              tooltip={isActive ? 'Solve this puzzle' : 'Run is not active'}
              disabled={!isActive}
              onClick={(e) => {
                e.stopPropagation()
                openSolveItem(item.runTrainingItemId)
              }}
            >
              <Play className="h-4 w-4" />
            </ActionButton>
            <ActionButton
              tooltip="See overview"
              onClick={(e) => {
                e.stopPropagation()
                void navigate({
                  to: '/app/runs/$runId/training-items/$runTrainingItemId/overview',
                  params: {
                    runId: runIdStr,
                    runTrainingItemId: String(item.runTrainingItemId),
                  },
                })
              }}
            >
              <Eye className="h-4 w-4" />
            </ActionButton>
          </div>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={trainingItems}
      hideSearch={true}
      pageSize={PAGE_SIZE}
      emptyMessage="No puzzles yet."
      onRowClick={isActive ? (item) => openSolveItem(item.runTrainingItemId) : undefined}
    />
  )
}
