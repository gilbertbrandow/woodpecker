import * as React from 'react'
import { Flag, CalendarDays } from 'lucide-react'
import { ProgressBar } from '../../components/ProgressBar'
import { DeltaBadge } from './DeltaBadge'

type ProgressRowProps = {
  label: string
  value: number
  tooltipLabel: string
  delta: number | null
  icon: React.ElementType
}

export type ProgressCardProps = {
  runProgress: Omit<ProgressRowProps, 'icon'>
  trainingProgress: Omit<ProgressRowProps, 'icon'> | null
}

function ProgressRow({ label, value, tooltipLabel, delta, icon: Icon }: ProgressRowProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-6 items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </div>
        <DeltaBadge delta={delta} goodWhenPositive={true} format={(n) => `${n.toFixed(2)}%`} />
      </div>
      <ProgressBar value={value} tooltipLabel={tooltipLabel} className="w-full" />
    </div>
  )
}

export function ProgressCard({ runProgress, trainingProgress }: ProgressCardProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <span>Progress</span>
      <ProgressRow {...runProgress} icon={Flag} />
      {trainingProgress !== null && <ProgressRow {...trainingProgress} icon={CalendarDays} />}
    </div>
  )
}
