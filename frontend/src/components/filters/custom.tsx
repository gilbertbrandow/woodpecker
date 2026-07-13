import type { FilterHandler, CustomFilterSpec } from './types'

export const customHandler: FilterHandler<unknown[], CustomFilterSpec<unknown>> = {
  defaultOperator: 'is',
  operatorOptions: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
  ],
  defaultValue: () => [],
  isEmpty: (value) => value.length === 0,
  // Async hydration means fromUrl just returns [] — ServerDataTable handles hydration separately
  toUrl: (value, spec) => spec.serialize(value),
  fromUrl: () => [],
  getFetchParams: (value, spec) => spec.serialize(value),
  getOperator: () => 'is',
  onOperatorSwitch: (_newOp, current) => ({ value: current, openEditor: false }),
  chipSummary: (value, spec) => {
    if (value.length === 0) return null
    return spec.getChipLabel
      ? spec.getChipLabel(value)
      : value.length === 1
        ? '1 selected'
        : `${value.length} selected`
  },
  renderChipValue: (value, spec) => {
    if (spec.renderChipValue && value.length > 0) return spec.renderChipValue(value)
    if (value.length === 0) return <span className="italic text-muted-foreground">…</span>
    const label = spec.getChipLabel
      ? spec.getChipLabel(value)
      : `${value.length} selected`
    return <span className="font-medium text-foreground">{label}</span>
  },
  renderEditor: (value, onChange, spec) => {
    const renderFn = spec.renderContent ?? spec.render
    return <div className="w-72">{renderFn(value, onChange)}</div>
  },
  getLabel: (spec) =>
    spec.label ?? (spec.key.charAt(0).toUpperCase() + spec.key.slice(1)),
  getIcon: (spec) => spec.icon ?? null,
  selectionCount: (value) => value.length,
}
