import * as React from 'react'
import { useState, useEffect } from 'react'
import { Input } from '../ui/input'

type SolveTimeInputProps = {
  value: number | null
  onChange: (seconds: number | null) => void
  disabled?: boolean
}

export function SolveTimeInput({ value, onChange, disabled }: SolveTimeInputProps): React.ReactElement {
  const [minutes, setMinutes] = useState<string>(
    value !== null ? String(Math.floor(value / 60)) : '',
  )
  const [seconds, setSeconds] = useState<string>(
    value !== null ? String(value % 60) : '',
  )

  useEffect(() => {
    if (value === null) {
      setMinutes('')
      setSeconds('')
    } else {
      setMinutes(String(Math.floor(value / 60)))
      setSeconds(String(value % 60))
    }
  }, [value])

  const emit = (m: string, s: string): void => {
    if (m === '' && s === '') {
      onChange(null)
      return
    }
    const mNum = m === '' ? 0 : parseInt(m, 10)
    const sNum = s === '' ? 0 : parseInt(s, 10)
    if (!isNaN(mNum) && !isNaN(sNum)) {
      onChange(mNum * 60 + sNum)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={0}
          max={99}
          placeholder="0"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          onBlur={() => emit(minutes, seconds)}
          disabled={disabled}
          className="h-8 w-14 text-sm tabular-nums"
        />
        <span className="text-sm">m</span>
      </div>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={0}
          max={59}
          placeholder="0"
          value={seconds}
          onChange={(e) => setSeconds(e.target.value)}
          onBlur={() => emit(minutes, seconds)}
          disabled={disabled}
          className="h-8 w-14 text-sm tabular-nums"
        />
        <span className="text-sm">s</span>
      </div>
    </div>
  )
}
