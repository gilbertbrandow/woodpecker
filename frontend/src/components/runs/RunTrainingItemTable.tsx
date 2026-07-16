import * as React from 'react'
import { useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { ExternalLink, Play, Eye, Zap, Compass, Check, CheckCheck, Timer, Clock, XCircle } from 'lucide-react'
import { DATA_ICONS } from '../../lib/icons'
import { StatusBadge } from '../StatusBadge'
import { TrainingItemTypeBadge, ScarecrowIcon } from '../TrainingItemTypeBadge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { ServerDataTable, type FetchParams } from '../ServerDataTable'
import { col, actionCol } from '../DataTable'
import { type FilterSpec } from '../filters'
import { api, type RunTrainingItemListItem } from '../../lib/api'
import { formatSolveTimeMs } from '../../lib/utils'

const PAGE_SIZE = 25

const FILTERS: FilterSpec[] = [
  {
    type: 'multi',
    key: 'sourceType',
    label: 'Type',
    icon: DATA_ICONS.type,
    options: [
      { value: 'LICHESS_TACTIC', label: 'Tactical', icon: <Zap className="h-3.5 w-3.5" /> },
      { value: 'SCRAPED_POSITIONAL', label: 'Positional', icon: <Compass className="h-3.5 w-3.5" /> },
      { value: 'DECOY', label: 'Decoy', icon: <ScarecrowIcon className="h-3.5 w-3.5" /> },
    ],
  },
  {
    type: 'multi',
    key: 'positionStatus',
    label: 'Status',
    icon: DATA_ICONS.status,
    options: [
      { value: 'not_started', label: 'Not started', icon: <Timer className="h-3.5 w-3.5" /> },
      { value: 'in_progress', label: 'In progress', icon: <Clock className="h-3.5 w-3.5" /> },
      { value: 'solved', label: 'Solved', icon: <Check className="h-3.5 w-3.5" /> },
      { value: 'solved_with_retries', label: 'Solved (retries)', icon: <CheckCheck className="h-3.5 w-3.5" /> },
      { value: 'failed', label: 'Failed', icon: <XCircle className="h-3.5 w-3.5" /> },
    ],
  },
  {
    type: 'duration',
    key: 'timeMs',
    label: 'Time',
    icon: DATA_ICONS.time,
    min: 0,
    max: 600000,
    step: 5000,
    nullable: true,
  },
  {
    type: 'range',
    key: 'rating',
    label: 'Rating',
    icon: DATA_ICONS.rating,
    min: 0,
    max: 3500,
    step: 50,
    formatValue: (v) => (v >= 3500 ? '3500+' : String(v)),
  },
]

type Props = {
  runId: number
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

const columns: ColumnDef<RunTrainingItemListItem>[] = [
  actionCol({
    accessorKey: 'position',
    header: '#',
    enableSorting: false,
    meta: { className: 'w-0' },
    cell: ({ row }) => (
      <span className="font-mono text-sm text-muted-foreground">{row.original.position + 1}</span>
    ),
  }),
  col({
    id: 'sourceType',
    header: 'Type',
    meta: { icon: DATA_ICONS.type },
    enableSorting: false,
    cell: ({ row }) => <TrainingItemTypeBadge source={row.original.source.sourceType} />,
  }),
  col({
    id: 'rating',
    header: 'Rating',
    meta: { className: 'min-w-24', icon: DATA_ICONS.rating },
    enableSorting: false,
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
  }),
  col({
    accessorKey: 'positionStatus',
    header: 'Status',
    meta: { className: 'min-w-32', icon: DATA_ICONS.status },
    enableSorting: false,
    cell: ({ row }) => <StatusBadge status={row.original.positionStatus} />,
  }),
  col({
    accessorKey: 'timeMs',
    header: 'Time',
    meta: { className: 'min-w-28', icon: DATA_ICONS.time },
    enableSorting: false,
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.timeMs !== null ? formatSolveTimeMs(row.original.timeMs) : '—'}
      </span>
    ),
  }),
  col({
    accessorKey: 'tryCount',
    header: 'Tries',
    meta: { className: 'min-w-20 text-right', icon: DATA_ICONS.tries },
    enableSorting: false,
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.tryCount > 0 ? row.original.tryCount : '—'}</span>
    ),
  }),
]

export function RunTrainingItemTable({ runId, runIdStr, isActive }: Props): React.ReactElement {
  const navigate = useNavigate()

  const openSolveItem = (runTrainingItemId: number): void => {
    if (!isActive) return
    void navigate({
      to: '/app/runs/$runId/training-items/$runTrainingItemId',
      params: { runId: runIdStr, runTrainingItemId: String(runTrainingItemId) },
    })
  }

  const actionColumns = useMemo<ColumnDef<RunTrainingItemListItem>[]>(
    () => [
    ...columns,
    actionCol({
      id: 'actions',
      header: '',
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
    }),
  ],
    [isActive, runIdStr, navigate], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const fetchData = useCallback(
    async (params: FetchParams): Promise<{ items: RunTrainingItemListItem[]; total: number }> => {
      const result = await api.runs.listTrainingItems(runId, params)
      return { items: result.items, total: result.total }
    },
    [runId],
  )

  return (
    <ServerDataTable
      columns={actionColumns}
      fetchData={fetchData}
      pageSize={PAGE_SIZE}
      initialSorting={[]}
      filters={FILTERS}
      emptyMessage="No puzzles yet."
      onRowClick={isActive ? (item) => openSolveItem(item.runTrainingItemId) : undefined}
    />
  )
}
