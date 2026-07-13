import type * as React from 'react'

// ---------------------------------------------------------------------------
// Filter spec types
// ---------------------------------------------------------------------------

export type SearchFilterSpec = {
  type: 'search'
  key: string
}

export type MultiFilterSpec = {
  type: 'multi'
  key: string
  label: string
  options: { label: string; value: string; icon?: React.ReactNode }[]
  icon?: React.ComponentType<{ className?: string }>
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
}

export type EntityVal = { op: 'is' | 'is_not'; items: unknown[] }

export type DateVal = {
  op: 'after' | 'before' | 'between' | 'not_between'
  from: string
  to?: string
}

export type RangeVal = {
  op: 'is' | 'is_not' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'not_between'
  from?: number
  to?: number
}

export type MultiVal = { op: 'is' | 'is_not'; values: string[] }

export type DateFilterSpec = {
  type: 'date'
  key: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
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
}

export type FilterSpec =
  | SearchFilterSpec
  | MultiFilterSpec
  | CustomFilterSpec<any>
  | EntityFilterSpec<any>
  | DateFilterSpec
  | RangeFilterSpec

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
  operatorOptions: { value: string; label: string }[]
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
