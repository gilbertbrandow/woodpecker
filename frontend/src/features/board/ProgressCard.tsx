import * as React from 'react'
import { ProgressBar } from '../../components/ProgressBar'
import { DeltaBadge } from './DeltaBadge'

type ProgressRowProps = {
  label: string
  value: number
  tooltipLabel: string
  delta: number | null
}

export type ProgressCardProps = {
  runProgress: ProgressRowProps
  trainingProgress: ProgressRowProps | null
}

function ProgressRow({ label, value, tooltipLabel, delta }: ProgressRowProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-6 items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <DeltaBadge delta={delta} goodWhenPositive={true} format={(n) => `${n.toFixed(2)}%`} />
      </div>
      <ProgressBar value={value} tooltipLabel={tooltipLabel} className="w-full" />
    </div>
  )
}

export function ProgressCard({ runProgress, trainingProgress }: ProgressCardProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        <span>Current progress</span>
      <ProgressRow {...runProgress} />
      {trainingProgress !== null && <ProgressRow {...trainingProgress} />}
    </div>
  )
}
