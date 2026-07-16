import { Check } from 'lucide-react'
import { Command, CommandList, CommandGroup, CommandItem } from '../ui/command'
import { cn } from '../../lib/utils'
import type { FilterHandler, MultiFilterSpec, MultiVal } from './types'
import { withNullable } from './null-ops'

const baseMultiHandler: FilterHandler<MultiVal, MultiFilterSpec> = {
  defaultOperator: 'is',
  operatorOptions: [
    { value: 'is', label: 'is', symbol: '=', symbolPlural: '∈' },
    { value: 'is_not', label: 'is not', symbol: '≠', symbolPlural: '∉' },
  ],
  defaultValue: () => ({ op: 'is', values: [] }),
  isEmpty: (value) => value.values.length === 0,
  toUrl: (value) => (value.values.length > 0 ? [value.op, ...value.values] : []),
  fromUrl: (tokens) => {
    if (tokens.length === 0) return { op: 'is', values: [] }
    const [first, ...rest] = tokens
    // Backward-compat: old URLs have no op prefix
    if (first === 'is' || first === 'is_not') return { op: first, values: rest }
    return { op: 'is', values: tokens }
  },
  // [op, ...values] — matches the date/range convention; backends parse arr[0] as operator
  getFetchParams: (value) => (value.values.length > 0 ? [value.op, ...value.values] : []),
  getOperator: (value) => value.op,
  onOperatorSwitch: (newOp, current) => ({
    value: { op: newOp as MultiVal['op'], values: current.values },
    openEditor: false,
  }),
  chipSummary: (value, spec) => {
    const labels = spec.options
      .filter((o) => value.values.includes(o.value))
      .map((o) => o.label)
    if (labels.length === 0) return null
    return labels.length <= 2
      ? labels.join(', ')
      : `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`
  },
  renderChipValue: (value, spec) => {
    const selected = spec.options.filter((o) => value.values.includes(o.value))
    if (selected.length === 0)
      return <span className="italic text-muted-foreground">…</span>
    const visible = selected.slice(0, 4)
    const overflow = selected.length - 4
    return (
      <div className="flex items-center gap-1">
        {visible.map((o) => (
          <span key={o.value} className="flex items-center">
            {o.icon}
          </span>
        ))}
        {overflow > 0 && (
          <span className="font-mono text-xs text-muted-foreground">+{overflow}</span>
        )}
      </div>
    )
  },
  renderEditor: (value, onChange, spec) => {
    const toggle = (val: string) => {
      const next = value.values.includes(val)
        ? value.values.filter((v) => v !== val)
        : [...value.values, val]
      onChange({ ...value, values: next })
    }
    return (
      <Command>
        <CommandList>
          <CommandGroup>
            {spec.options.map((option) => {
              const checked = value.values.includes(option.value)
              return (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => toggle(option.value)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="text-xs"
                >
                  <div
                    className={cn(
                      'mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary',
                      checked
                        ? 'bg-primary text-primary-foreground'
                        : 'opacity-50 [&_svg]:invisible',
                    )}
                  >
                    <Check className="h-3 w-3" />
                  </div>
                  <span className="mr-2 flex items-center">{option.icon}</span>
                  {option.label}
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    )
  },
  getLabel: (spec) => spec.label.charAt(0).toUpperCase() + spec.label.slice(1),
  getIcon: (spec) => spec.icon ?? null,
  selectionCount: (value) => value.values.length,
}

export const multiHandler = withNullable(
  baseMultiHandler,
  (op) => ({ op, values: [] } as MultiVal),
)
