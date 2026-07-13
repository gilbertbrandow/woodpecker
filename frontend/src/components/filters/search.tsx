import { Search as SearchIcon } from 'lucide-react'
import { Input } from '../ui/input'
import type { FilterHandler, SearchFilterSpec } from './types'

export const searchHandler: FilterHandler<string, SearchFilterSpec> = {
  defaultOperator: 'contains',
  operatorOptions: [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
  ],
  defaultValue: () => '',
  isEmpty: (value) => !value,
  toUrl: (value) => (value ? [value] : []),
  fromUrl: (tokens) => tokens[0] ?? '',
  getFetchParams: (value) => (value ? [value] : []),
  getOperator: () => 'contains',
  onOperatorSwitch: (_newOp, current) => ({ value: current, openEditor: false }),
  chipSummary: (value) => value || null,
  renderChipValue: (value) =>
    value ? (
      <span className="font-medium text-foreground">{value}</span>
    ) : (
      <span className="italic text-muted-foreground">…</span>
    ),
  renderEditor: (value, onChange, _spec) => (
    <div className="p-2 w-52">
      <Input
        autoFocus
        placeholder="Search…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-xs"
      />
    </div>
  ),
  getLabel: () => 'Search',
  getIcon: () => SearchIcon,
}
