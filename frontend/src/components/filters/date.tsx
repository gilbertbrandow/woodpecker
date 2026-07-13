import { Calendar } from '../ui/calendar'
import type { FilterHandler, DateFilterSpec, DateVal } from './types'
import { isoToDate, dateToIso, fmtDate } from './types'

const DATE_OPS = ['after', 'before', 'between', 'not_between'] as const

export const dateHandler: FilterHandler<DateVal | null, DateFilterSpec> = {
  defaultOperator: 'after',
  operatorOptions: [
    { value: 'after', label: 'after', symbol: '>' },
    { value: 'before', label: 'before', symbol: '<' },
    { value: 'between', label: 'is between', symbol: '∈' },
    { value: 'not_between', label: 'is not between', symbol: '∉' },
  ],
  defaultValue: () => null,
  isEmpty: (value) => !value?.from,
  toUrl: (value) => {
    if (!value?.from) return []
    const arr = [value.op, value.from]
    if ((value.op === 'between' || value.op === 'not_between') && value.to) arr.push(value.to)
    return arr
  },
  fromUrl: (tokens) => {
    if (tokens.length < 2) return null
    const [op, from, to] = tokens
    if (!DATE_OPS.includes(op as DateVal['op'])) return null
    return { op: op as DateVal['op'], from, to }
  },
  getFetchParams: (value) => {
    if (!value?.from) return []
    const arr = [value.op, value.from]
    if ((value.op === 'between' || value.op === 'not_between') && value.to) arr.push(value.to)
    return arr
  },
  getOperator: (value) => value?.op ?? 'after',
  onOperatorSwitch: (newOp, current) => {
    if (newOp === 'between' || newOp === 'not_between') {
      let from: string
      let to: string
      if (!current?.from) {
        const today = new Date()
        today.setHours(12, 0, 0, 0)
        from = dateToIso(today)
        const end = new Date(today)
        end.setDate(end.getDate() + 7)
        to = dateToIso(end)
      } else if (current.op === 'before') {
        // "before Jan 15" → "Jan 8 – Jan 15"
        const endDate = new Date(current.from + 'T12:00:00')
        const startDate = new Date(endDate)
        startDate.setDate(startDate.getDate() - 7)
        to = current.from
        from = dateToIso(startDate)
      } else {
        // "after Jan 15" → "Jan 15 – Jan 22"
        from = current.from
        const endDate = new Date(from + 'T12:00:00')
        endDate.setDate(endDate.getDate() + 7)
        to = dateToIso(endDate)
      }
      return { value: { op: newOp as DateVal['op'], from, to }, openEditor: true }
    }
    return {
      value: { op: newOp as DateVal['op'], from: current?.from ?? '' },
      openEditor: false,
    }
  },
  chipSummary: (value) => {
    if (!value?.from) return null
    if (value.op === 'between' || value.op === 'not_between') {
      return value.to ? `${fmtDate(value.from)} – ${fmtDate(value.to)}` : null
    }
    return fmtDate(value.from)
  },
  renderChipValue: (value) => {
    if (!value?.from) return <span className="italic text-muted-foreground">…</span>
    const isBetween = value.op === 'between' || value.op === 'not_between'
    const text = isBetween
      ? value.to ? `${fmtDate(value.from)} – ${fmtDate(value.to)}` : null
      : fmtDate(value.from)
    if (text) return <span className="font-medium text-foreground">{text}</span>
    return <span className="italic text-muted-foreground">…</span>
  },
  renderEditor: (value, onChange) => {
    const op = value?.op ?? 'after'
    const isBetween = op === 'between' || op === 'not_between'
    if (isBetween) {
      const range = { from: isoToDate(value?.from), to: isoToDate(value?.to) }
      return (
        <Calendar
          mode="range"
          defaultMonth={range.from}
          selected={range}
          onSelect={(r) => {
            onChange({
              op,
              from: r?.from ? dateToIso(r.from) : '',
              to: r?.to ? dateToIso(r.to) : undefined,
            })
          }}
          autoFocus
        />
      )
    }
    return (
      <Calendar
        mode="single"
        defaultMonth={isoToDate(value?.from)}
        selected={isoToDate(value?.from)}
        onSelect={(d) => onChange({ op, from: d ? dateToIso(d) : '' })}
        autoFocus
      />
    )
  },
  getLabel: (spec) => spec.label,
  getIcon: (spec) => spec.icon ?? null,
}
