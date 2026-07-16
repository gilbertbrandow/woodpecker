import type { FilterHandler, EntityFilterSpec, EntityVal } from './types'
import { withNullable } from './null-ops'

const baseEntityHandler: FilterHandler<EntityVal, EntityFilterSpec<unknown>> = {
  defaultOperator: 'is',
  operatorOptions: [
    { value: 'is', label: 'is', symbol: '=', symbolPlural: '∈' },
    { value: 'is_not', label: 'is not', symbol: '≠', symbolPlural: '∉' },
  ],
  defaultValue: () => ({ op: 'is', items: [] }),
  isEmpty: (value) => value.items.length === 0,
  toUrl: (value, spec) => {
    const ids = spec.serialize(value.items)
    return ids.length > 0 ? [value.op, ...ids] : []
  },
  // fromUrl returns items:[] — ServerDataTable fills items via its hydration mechanism
  fromUrl: (tokens) => {
    const op = tokens[0] === 'is' || tokens[0] === 'is_not' ? tokens[0] : 'is'
    return { op, items: [] }
  },
  getFetchParams: (value, spec) => {
    const ids = spec.serialize(value.items)
    return ids.length > 0 ? [value.op, ...ids] : []
  },
  getOperator: (value) => value.op,
  onOperatorSwitch: (newOp, current) => ({
    value: { op: newOp as 'is' | 'is_not', items: current.items },
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

export const entityHandler = withNullable(
  baseEntityHandler,
  (op) => ({ op, items: [] } as EntityVal),
)
