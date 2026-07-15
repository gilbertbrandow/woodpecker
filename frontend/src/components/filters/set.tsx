import { SquaresExclude, SquaresIntersect } from 'lucide-react'
import type { FilterHandler, SetFilterSpec, SetVal } from './types'

// Operators describe the relationship between the filter selection (F) and
// the row's set (R), using standard set-theory notation.
const SET_OPS = ['overlaps', 'superset', 'subset', 'disjoint'] as const

export const setHandler: FilterHandler<SetVal, SetFilterSpec<unknown>> = {
  defaultOperator: 'overlaps',
  operatorOptions: [
    { value: 'overlaps', label: 'has any of',     icon: <SquaresIntersect className="h-3 w-3" /> },
    { value: 'superset', label: 'has all of',     symbol: '⊇' },
    { value: 'subset',   label: 'is only within', symbol: '⊆' },
    { value: 'disjoint', label: 'has none of',    icon: <SquaresExclude className="h-3 w-3" />   },
  ],
  defaultValue: () => ({ op: 'overlaps', items: [] }),
  isEmpty: (value) => value.items.length === 0,
  toUrl: (value, spec) => {
    const ids = spec.serialize(value.items)
    return ids.length > 0 ? [value.op, ...ids] : []
  },
  fromUrl: (tokens) => {
    const op = SET_OPS.includes(tokens[0] as (typeof SET_OPS)[number])
      ? (tokens[0] as SetVal['op'])
      : 'overlaps'
    return { op, items: [] }
  },
  getFetchParams: (value, spec) => {
    const ids = spec.serialize(value.items)
    return ids.length > 0 ? [value.op, ...ids] : []
  },
  getOperator: (value) => value.op,
  onOperatorSwitch: (newOp, current) => ({
    value: { op: newOp as SetVal['op'], items: current.items },
    openEditor: false,
  }),
  chipSummary: (value, spec) => {
    if (value.items.length === 0) return null
    return spec.getChipLabel
      ? spec.getChipLabel(value.items)
      : value.items.length === 1
        ? '1 selected'
        : `${value.items.length} selected`
  },
  renderChipValue: (value, spec) => {
    if (spec.renderChipValue && value.items.length > 0) return spec.renderChipValue(value.items)
    if (value.items.length === 0) return <span className="italic text-muted-foreground">…</span>
    const label = spec.getChipLabel
      ? spec.getChipLabel(value.items)
      : `${value.items.length} selected`
    return <span className="font-medium text-foreground">{label}</span>
  },
  renderEditor: (value, onChange, spec) => {
    const renderFn = spec.renderContent ?? spec.render
    return (
      <div className="w-72">
        {renderFn(value.items, (items) => onChange({ ...value, items }))}
      </div>
    )
  },
  getLabel: (spec) =>
    spec.label ?? (spec.key.charAt(0).toUpperCase() + spec.key.slice(1)),
  getIcon: (spec) => spec.icon ?? null,
  selectionCount: (value) => value.items.length,
}
