import { useState, useEffect } from 'react'
import { Slider } from '../ui/slider'
import { Input } from '../ui/input'
import type { DurationFilterSpec, FilterHandler, RangeVal } from './types'
import { withNullable } from './null-ops'

const RANGE_OPS = ['is', 'is_not', 'gt', 'gte', 'lt', 'lte', 'between', 'not_between'] as const

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi)
}

function fmtMs(ms: number): string {
  const totalSecs = Math.round(ms / 1000)
  const m = Math.floor(totalSecs / 60)
  const s = totalSecs % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function parseMs(text: string): number | null {
  const trimmed = text.trim()
  const colonMatch = trimmed.match(/^(\d+):(\d{1,2})$/)
  if (colonMatch) {
    const mins = parseInt(colonMatch[1], 10)
    const secs = parseInt(colonMatch[2], 10)
    if (secs < 60) return (mins * 60 + secs) * 1000
  }
  const rawMatch = trimmed.match(/^\d+$/)
  if (rawMatch) return parseInt(trimmed, 10) * 1000
  return null
}

type DurationInputProps = {
  valueMs: number
  min: number
  max: number
  onChange: (ms: number) => void
}

function DurationInput({ valueMs, min, max, onChange }: DurationInputProps) {
  const [text, setText] = useState(() => fmtMs(valueMs))

  useEffect(() => {
    setText(fmtMs(valueMs))
  }, [valueMs])

  const commit = () => {
    const ms = parseMs(text)
    if (ms !== null) {
      onChange(clamp(ms, min, max))
    } else {
      setText(fmtMs(valueMs))
    }
  }

  return (
    <Input
      type="text"
      className="h-7 w-20 text-xs px-2 font-mono"
      value={text}
      placeholder="mm:ss"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
      }}
    />
  )
}

const baseDurationHandler: FilterHandler<RangeVal | null, DurationFilterSpec> = {
  defaultOperator: 'gte',
  operatorOptions: [
    { value: 'is', label: 'is', symbol: '=' },
    { value: 'is_not', label: 'is not', symbol: '≠' },
    { value: 'gt', label: 'greater than', symbol: '>' },
    { value: 'gte', label: 'greater than or equal', symbol: '≥' },
    { value: 'lt', label: 'less than', symbol: '<' },
    { value: 'lte', label: 'less than or equal', symbol: '≤' },
    { value: 'between', label: 'is between', symbol: '∈' },
    { value: 'not_between', label: 'is not between', symbol: '∉' },
  ],
  defaultValue: () => null,
  isEmpty: (value) => value === null || value.from === undefined,
  toUrl: (value) => {
    if (value === null || value.from === undefined) return []
    const arr = [value.op, String(value.from)]
    if ((value.op === 'between' || value.op === 'not_between') && value.to !== undefined)
      arr.push(String(value.to))
    return arr
  },
  fromUrl: (tokens) => {
    if (tokens.length < 2) return null
    const [op, fromStr, toStr] = tokens
    if (!RANGE_OPS.includes(op as (typeof RANGE_OPS)[number])) return null
    const from = parseFloat(fromStr)
    if (isNaN(from)) return null
    const to = toStr !== undefined ? parseFloat(toStr) : undefined
    return {
      op: op as RangeVal['op'],
      from,
      to: to !== undefined && !isNaN(to) ? to : undefined,
    }
  },
  getFetchParams: (value) => {
    if (value === null || value.from === undefined) return []
    const arr = [value.op, String(value.from)]
    if ((value.op === 'between' || value.op === 'not_between') && value.to !== undefined)
      arr.push(String(value.to))
    return arr
  },
  getOperator: (value) => value?.op ?? 'gte',
  onOperatorSwitch: (newOp, current, spec) => {
    if (newOp === 'between' || newOp === 'not_between') {
      return {
        value: {
          op: newOp as RangeVal['op'],
          from: current?.from ?? spec.min,
          to: current?.to ?? spec.max,
        },
        openEditor: true,
      }
    }
    return {
      value: { op: newOp as RangeVal['op'], from: current?.from ?? spec.min },
      openEditor: false,
    }
  },
  chipSummary: (value) => {
    if (value === null || value.from === undefined) return null
    if (value.op === 'between' || value.op === 'not_between') {
      return value.to !== undefined ? `${fmtMs(value.from)} – ${fmtMs(value.to)}` : null
    }
    return fmtMs(value.from)
  },
  renderChipValue: (value) => {
    if (value === null || value.from === undefined)
      return <span className="italic text-muted-foreground">…</span>
    const isBetween = value.op === 'between' || value.op === 'not_between'
    const text = isBetween
      ? value.to !== undefined ? `${fmtMs(value.from)} – ${fmtMs(value.to)}` : null
      : fmtMs(value.from)
    if (text) return <span className="font-medium text-foreground font-mono">{text}</span>
    return <span className="italic text-muted-foreground">…</span>
  },
  renderEditor: (value, onChange, spec) => {
    const op = value?.op ?? 'gte'
    const isBetween = op === 'between' || op === 'not_between'
    const from = value?.from ?? spec.min
    const to = value?.to ?? spec.max
    const sliderValue = isBetween ? [from, to] : [from]
    return (
      <div className="flex flex-col gap-4 p-3">
        <Slider
          min={spec.min}
          max={spec.max}
          step={spec.step ?? 1000}
          value={sliderValue}
          onValueChange={(vals) => {
            if (isBetween) {
              onChange({ op, from: vals[0], to: vals[1] })
            } else {
              onChange({ op, from: vals[0] })
            }
          }}
        />
        {isBetween ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-7 shrink-0">Min</span>
            <DurationInput
              valueMs={from}
              min={spec.min}
              max={to}
              onChange={(ms) => onChange({ op, from: ms, to })}
            />
            <span className="text-muted-foreground w-7 shrink-0">Max</span>
            <DurationInput
              valueMs={to}
              min={from}
              max={spec.max}
              onChange={(ms) => onChange({ op, from, to: ms })}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-10 shrink-0">Value</span>
            <DurationInput
              valueMs={from}
              min={spec.min}
              max={spec.max}
              onChange={(ms) => onChange({ op, from: ms })}
            />
          </div>
        )}
      </div>
    )
  },
  getLabel: (spec) => spec.label,
  getIcon: (spec) => spec.icon ?? null,
}

export const durationHandler = withNullable(baseDurationHandler, (op) => ({ op } as RangeVal))
