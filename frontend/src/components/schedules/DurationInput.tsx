import * as React from 'react'
import { useState, useEffect, useRef } from 'react'
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
  const [displayValue, setDisplayValue] = useState<string>(() => {
    const u = smartUnit(value)
    return value === 0 ? (allowZero ? '0' : '1') : String(value / MULTIPLIERS[u])
  })
  const lastEmittedRef = useRef<number>(value)

  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value
      const newUnit = smartUnit(value)
      setUnit(newUnit)
      setDisplayValue(
        value === 0
          ? (allowZero ? '0' : '1')
          : String(value / MULTIPLIERS[newUnit])
      )
    }
  }, [value, allowZero])

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const newUnit = e.target.value as Unit
    const parsed = parseInt(displayValue, 10)
    const displayNum = isNaN(parsed) ? (allowZero ? 0 : 1) : parsed
    setUnit(newUnit)
    lastEmittedRef.current = displayNum * MULTIPLIERS[newUnit]
    onChange(displayNum * MULTIPLIERS[newUnit])
  }

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const raw = e.target.value
    setDisplayValue(raw)
    const parsed = parseInt(raw, 10)
    if (!isNaN(parsed) && parsed >= (allowZero ? 0 : 1)) {
      lastEmittedRef.current = parsed * MULTIPLIERS[unit]
      onChange(parsed * MULTIPLIERS[unit])
    }
  }

  const handleBlur = (): void => {
    const parsed = parseInt(displayValue, 10)
    const valid = !isNaN(parsed) ? Math.max(allowZero ? 0 : 1, parsed) : (allowZero ? 0 : 1)
    setDisplayValue(String(valid))
    lastEmittedRef.current = valid * MULTIPLIERS[unit]
    onChange(valid * MULTIPLIERS[unit])
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min={allowZero ? 0 : 1}
        value={displayValue}
        onChange={handleNumberChange}
        onBlur={handleBlur}
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
