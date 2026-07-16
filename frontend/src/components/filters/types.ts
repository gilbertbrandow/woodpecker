import type * as React from 'react'

// ---------------------------------------------------------------------------
// Filter spec types
// ---------------------------------------------------------------------------

export type SearchFilterSpec = {
  type: 'search'
  key: string
}

export type OperatorOption = {
  value: string
  label: string
  symbol?: string
  symbolPlural?: string
  icon?: React.ReactNode
  iconPlural?: React.ReactNode
}

export type MultiFilterSpec = {
  type: 'multi'
  key: string
  label: string
  options: { label: string; value: string; icon: React.ReactNode }[]
  icon?: React.ComponentType<{ className?: string }>
  nullable?: boolean
}

export type CustomFilterSpec<TItem> = {
  type: 'custom'
  key: string
  render: (value: TItem[], onChange: (items: TItem[]) => void) => React.ReactNode
  serialize: (items: TItem[]) => string[]
  resolveInstant?: (id: string) => TItem | null
  resolveIds?: (ids: string[]) => Promise<TItem[]>
  label?: string
  icon?: React.ComponentType<{ className?: string }>
  defaultItems?: TItem[]
  renderContent?: (value: TItem[], onChange: (items: TItem[]) => void) => React.ReactNode
  getChipLabel?: (items: TItem[]) => string
  renderChipValue?: (items: TItem[]) => React.ReactNode
}

// Entity filter: multi-select of async-resolved entities (users, subsets, schedules, etc.).
// Same data contract as multi — op is URL-persisted and sent to the backend.
// Only differs from multi in: async ID resolution and a custom editor/chip component.
export type EntityFilterSpec<TItem> = {
  type: 'entity'
  key: string
  render: (value: TItem[], onChange: (items: TItem[]) => void) => React.ReactNode
  serialize: (items: TItem[]) => string[]
  resolveInstant?: (id: string) => TItem | null
  resolveIds?: (ids: string[]) => Promise<TItem[]>
  label?: string
  icon?: React.ComponentType<{ className?: string }>
  defaultItems?: TItem[]
  renderContent?: (value: TItem[], onChange: (items: TItem[]) => void) => React.ReactNode
  getChipLabel?: (items: TItem[]) => string
  renderChipValue?: (items: TItem[]) => React.ReactNode
  nullable?: boolean
}

export type EntityVal = { op: 'is' | 'is_not' | 'set' | 'not_set'; items: unknown[] }

// Set filter: the row value is a set; operators describe the relationship between
// the filter selection (F) and the row's set (R).
//   overlaps  — R ∩ F ≠ ∅  — row has at least one selected item
//   superset  — F ⊆ R      — row has all selected items
//   subset    — R ⊆ F      — row's items are all within the selection
//   disjoint  — R ∩ F = ∅  — row has none of the selected items
export type SetVal = { op: 'overlaps' | 'superset' | 'subset' | 'disjoint'; items: unknown[] }

export type SetFilterSpec<TItem> = {
  type: 'set'
  key: string
  render: (value: TItem[], onChange: (items: TItem[]) => void) => React.ReactNode
  serialize: (items: TItem[]) => string[]
  resolveInstant?: (id: string) => TItem | null
  resolveIds?: (ids: string[]) => Promise<TItem[]>
  label?: string
  icon?: React.ComponentType<{ className?: string }>
  getChipLabel?: (items: TItem[]) => string
  renderChipValue?: (items: TItem[]) => React.ReactNode
  renderContent?: (value: TItem[], onChange: (items: TItem[]) => void) => React.ReactNode
}

export type DateVal = {
  op: 'after' | 'before' | 'between' | 'not_between' | 'set' | 'not_set'
  from: string
  to?: string
}

export type RangeVal = {
  op: 'is' | 'is_not' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'not_between' | 'set' | 'not_set'
  from?: number
  to?: number
}

export type MultiVal = { op: 'is' | 'is_not' | 'set' | 'not_set'; values: string[] }

export type DateFilterSpec = {
  type: 'date'
  key: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  nullable?: boolean
}

export type RangeFilterSpec = {
  type: 'range'
  key: string
  label: string
  min: number
  max: number
  step?: number
  icon?: React.ComponentType<{ className?: string }>
  formatValue?: (value: number) => string
  nullable?: boolean
}

export type DurationFilterSpec = {
  type: 'duration'
  key: string
  label: string
  min: number
  max: number
  step?: number
  icon?: React.ComponentType<{ className?: string }>
  nullable?: boolean
}

export type FilterSpec =
  | SearchFilterSpec
  | MultiFilterSpec
  | CustomFilterSpec<any>
  | EntityFilterSpec<any>
  | SetFilterSpec<any>
  | DateFilterSpec
  | RangeFilterSpec
  | DurationFilterSpec

// ---------------------------------------------------------------------------
// Handler interface
// ---------------------------------------------------------------------------

export type FilterValues = Record<string, unknown>

export interface FilterHandler<TValue = unknown, TSpec = FilterSpec> {
  defaultValue(spec: TSpec): TValue
  isEmpty(value: TValue): boolean
  /** Serialise value to URL tokens. Return [] when filter is inactive. */
  toUrl(value: TValue, spec: TSpec): string[]
  /** Parse URL tokens back to a value. Return defaultValue when invalid. */
  fromUrl(tokens: string[], spec: TSpec): TValue
  /** What to include in fetchData filters. Same shape as toUrl for date/range/search. */
  getFetchParams(value: TValue, spec: TSpec): string[]
  getOperator(value: TValue): string
  operatorOptions: OperatorOption[]
  /** Override to return spec-dependent operator options (e.g. appending null-ops when spec.nullable). */
  getOperatorOptions?(spec: TSpec): OperatorOption[]
  defaultOperator: string
  onOperatorSwitch(
    newOp: string,
    current: TValue,
    spec: TSpec,
  ): { value: TValue; openEditor: boolean }
  chipSummary(value: TValue, spec: TSpec): string | null
  renderChipValue(value: TValue, spec: TSpec): React.ReactNode
  renderEditor(value: TValue, onChange: (v: TValue) => void, spec: TSpec): React.ReactNode
  getLabel(spec: TSpec): string
  getIcon(spec: TSpec): React.ComponentType<{ className?: string }> | null
  /** For pluralised operator labels ("is any of"). Return number of active selections. */
  selectionCount?(value: TValue): number
  /** Return false to remove the value box entirely (no popover, no chevron). */
  isValueEditable?(value: TValue): boolean
}

// ---------------------------------------------------------------------------
// Shared date helpers
// ---------------------------------------------------------------------------

export function isoToDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined
  const d = new Date(iso + 'T12:00:00')
  return isNaN(d.getTime()) ? undefined : d
}

export function dateToIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}
