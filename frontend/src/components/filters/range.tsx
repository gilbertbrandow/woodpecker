import { Slider } from '../ui/slider'
import { Input } from '../ui/input'
import type { FilterHandler, RangeFilterSpec, RangeVal } from './types'

const RANGE_OPS = ['is', 'is_not', 'gt', 'gte', 'lt', 'lte', 'between', 'not_between'] as const

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi)
}

export const rangeHandler: FilterHandler<RangeVal | null, RangeFilterSpec> = {
  defaultOperator: 'gte',
  operatorOptions: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
    { value: 'gt', label: 'greater than' },
    { value: 'gte', label: 'greater than or equal' },
    { value: 'lt', label: 'less than' },
    { value: 'lte', label: 'less than or equal' },
    { value: 'between', label: 'is between' },
    { value: 'not_between', label: 'is not between' },
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
    if (!RANGE_OPS.includes(op as RangeVal['op'])) return null
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
  chipSummary: (value, spec) => {
    if (value === null || value.from === undefined) return null
    const fmt = spec.formatValue ?? String
    if (value.op === 'between' || value.op === 'not_between') {
      return value.to !== undefined ? `${fmt(value.from)} – ${fmt(value.to)}` : null
    }
    return fmt(value.from)
  },
  renderChipValue: (value, spec) => {
    if (value === null || value.from === undefined)
      return <span className="italic text-muted-foreground">…</span>
    const fmt = spec.formatValue ?? String
    const isBetween = value.op === 'between' || value.op === 'not_between'
    const text = isBetween
      ? value.to !== undefined ? `${fmt(value.from)} – ${fmt(value.to)}` : null
      : fmt(value.from)
    if (text) return <span className="font-medium text-foreground">{text}</span>
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
          step={spec.step ?? 1}
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
            <Input
              type="number"
              className="h-7 w-20 text-xs px-2"
              value={from}
              min={spec.min}
              max={spec.max}
              onChange={(e) => {
                const v = clamp(Number(e.target.value), spec.min, to)
                onChange({ op, from: v, to })
              }}
            />
            <span className="text-muted-foreground w-7 shrink-0">Max</span>
            <Input
              type="number"
              className="h-7 w-20 text-xs px-2"
              value={to}
              min={spec.min}
              max={spec.max}
              onChange={(e) => {
                const v = clamp(Number(e.target.value), from, spec.max)
                onChange({ op, from, to: v })
              }}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-10 shrink-0">Value</span>
            <Input
              type="number"
              className="h-7 w-20 text-xs px-2"
              value={from}
              min={spec.min}
              max={spec.max}
              onChange={(e) => {
                const v = clamp(Number(e.target.value), spec.min, spec.max)
                onChange({ op, from: v })
              }}
            />
          </div>
        )}
      </div>
    )
  },
  getLabel: (spec) => spec.label,
  getIcon: (spec) => spec.icon ?? null,
}
