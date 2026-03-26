import * as React from 'react'
import { useState, useEffect } from 'react'
import { Input } from '../ui/input'

type Unit = 'hours' | 'days' | 'weeks' | 'months'

type DurationInputProps = {
  value: number
  onChange: (hours: number) => void
  disabled?: boolean
  allowZero?: boolean
}

const MULTIPLIERS: Record<Unit, number> = {
  hours: 1,
  days: 24,
  weeks: 168,
  months: 720,
}

function smartUnit(hours: number): Unit {
  if (hours === 0) return 'hours'
  if (hours >= 720 && hours % 720 === 0) return 'months'
  if (hours >= 168 && hours % 168 === 0) return 'weeks'
  if (hours >= 24 && hours % 24 === 0) return 'days'
  return 'hours'
}

export function formatDuration(hours: number): string {
  if (hours === 0) return 'no break'
  if (hours % 720 === 0) return `${hours / 720} month${hours / 720 !== 1 ? 's' : ''}`
  if (hours % 168 === 0) return `${hours / 168} week${hours / 168 !== 1 ? 's' : ''}`
  if (hours % 24 === 0) return `${hours / 24} day${hours / 24 !== 1 ? 's' : ''}`
  return `${hours} hour${hours !== 1 ? 's' : ''}`
}

export function DurationInput({ value, onChange, disabled, allowZero }: DurationInputProps): React.ReactElement {
  const [unit, setUnit] = useState<Unit>(() => smartUnit(value))
  const [displayValue, setDisplayValue] = useState<number>(() => value / MULTIPLIERS[smartUnit(value)] || (allowZero ? 0 : 1))

  useEffect(() => {
    const newUnit = smartUnit(value)
    setUnit(newUnit)
    setDisplayValue(value === 0 ? (allowZero ? 0 : 1) : value / MULTIPLIERS[newUnit])
  }, [value, allowZero])

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const newUnit = e.target.value as Unit
    const currentHours = displayValue * MULTIPLIERS[unit]
    const newDisplay = Math.max(allowZero ? 0 : 1, Math.round(currentHours / MULTIPLIERS[newUnit]))
    setUnit(newUnit)
    setDisplayValue(newDisplay)
    onChange(newDisplay * MULTIPLIERS[newUnit])
  }

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const parsed = parseInt(e.target.value, 10)
    if (isNaN(parsed)) return
    const clamped = Math.max(allowZero ? 0 : 1, parsed)
    setDisplayValue(clamped)
    onChange(clamped * MULTIPLIERS[unit])
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min={allowZero ? 0 : 1}
        value={displayValue}
        onChange={handleNumberChange}
        disabled={disabled}
        className="h-8 w-20 text-sm tabular-nums"
      />
      <select
        value={unit}
        onChange={handleUnitChange}
        disabled={disabled}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="hours">hours</option>
        <option value="days">days</option>
        <option value="weeks">weeks</option>
        <option value="months">months</option>
      </select>
    </div>
  )
}
