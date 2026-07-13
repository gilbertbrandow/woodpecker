import * as React from 'react'
import { useState } from 'react'
import { Funnel, FunnelPlus, FunnelX, X, Check, ChevronDown, Search as SearchIcon } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover'
import { Command, CommandList, CommandGroup, CommandItem } from './ui/command'
import { Input } from './ui/input'
import { cn } from '../lib/utils'
import { Slider } from './ui/slider'
import { Calendar } from './ui/calendar'
import type { FilterSpec, CustomFilterSpec, RangeFilterSpec, DateVal, RangeVal } from './ServerDataTable'

export type FilterChipBarProps = {
  specs: FilterSpec[]
  searchValues: Record<string, string>
  multiValues: Record<string, string[]>
  customValues: Record<string, unknown[]>
  dateValues: Record<string, DateVal>
  rangeValues: Record<string, RangeVal>
  onSearchChange: (key: string, value: string) => void
  onMultiChange: (key: string, values: string[]) => void
  onCustomChange: (key: string, items: unknown[]) => void
  onDateChange: (key: string, val: DateVal) => void
  onRangeChange: (key: string, val: RangeVal) => void
  onClearAll: () => void
  hasActiveFilters: boolean
  compact?: boolean
}

// ---------------------------------------------------------------------------
// Operator options per filter type
// ---------------------------------------------------------------------------
const OPERATOR_OPTIONS = {
  search: [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
  ],
  multi: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
  ],
  custom: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
  ],
  date: [
    { value: 'after', label: 'after' },
    { value: 'before', label: 'before' },
    { value: 'between', label: 'is between' },
    { value: 'not_between', label: 'is not between' },
  ],
  range: [
    { value: 'gte', label: 'at least' },
    { value: 'lte', label: 'at most' },
    { value: 'between', label: 'is between' },
    { value: 'not_between', label: 'is not between' },
  ],
} satisfies Record<FilterSpec['type'], { value: string; label: string }[]>

const DEFAULT_OPERATOR: Record<FilterSpec['type'], string> = {
  search: 'contains',
  multi: 'is',
  custom: 'is',
  date: 'after',
  range: 'gte',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function specLabel(spec: FilterSpec): string {
  if (spec.type === 'search') return 'Search'
  if (spec.type === 'multi')
    return spec.label.charAt(0).toUpperCase() + spec.label.slice(1)
  const cs = spec as CustomFilterSpec<unknown>
  return cs.label ?? (spec.key.charAt(0).toUpperCase() + spec.key.slice(1))
}

function SpecIcon({
  spec,
  className,
}: {
  spec: FilterSpec
  className?: string
}): React.ReactElement | null {
  if (spec.type === 'search') return <SearchIcon className={className} />
  const Icon =
    (spec as { icon?: React.ComponentType<{ className?: string }> }).icon ?? null
  if (!Icon) return null
  return <Icon className={className} />
}

function renderChipValueDisplay(
  spec: FilterSpec,
  multiValues: Record<string, string[]>,
  customValues: Record<string, unknown[]>,
  summary: string | null,
): React.ReactNode {
  if (spec.type === 'multi') {
    const selected = multiValues[spec.key] ?? []
    const selectedOptions = spec.options.filter((o) => selected.includes(o.value))
    if (selectedOptions.length === 0) {
      return <span className="italic text-muted-foreground">…</span>
    }
    const visible = selectedOptions.slice(0, 4)
    const overflow = selectedOptions.length - 4
    return (
      <div className="flex items-center gap-1">
        {visible.map((o) => (
          <span key={o.value} className="flex items-center">{o.icon}</span>
        ))}
        {overflow > 0 && (
          <span className="font-mono text-xs text-muted-foreground">+{overflow}</span>
        )}
      </div>
    )
  }

  if (spec.type === 'custom') {
    const cs = spec as CustomFilterSpec<unknown>
    const items = customValues[spec.key] ?? []
    if (cs.renderChipValue && items.length > 0) {
      return cs.renderChipValue(items)
    }
  }

  if (summary) return <span className="font-medium text-foreground">{summary}</span>
  return <span className="italic text-muted-foreground">…</span>
}

function isoToDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined
  const d = new Date(iso + 'T12:00:00')
  return isNaN(d.getTime()) ? undefined : d
}

function dateToIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso))
  } catch { return iso }
}

function chipSummary(
  spec: FilterSpec,
  searchValues: Record<string, string>,
  multiValues: Record<string, string[]>,
  customValues: Record<string, unknown[]>,
  dateValues: Record<string, DateVal>,
  rangeValues: Record<string, RangeVal>,
): string | null {
  if (spec.type === 'search') {
    const v = searchValues[spec.key]
    return v || null
  }
  if (spec.type === 'multi') {
    const sel = multiValues[spec.key] ?? []
    const labels = spec.options.filter((o) => sel.includes(o.value)).map((o) => o.label)
    if (labels.length === 0) return null
    return labels.length <= 2
      ? labels.join(', ')
      : `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`
  }
  if (spec.type === 'date') {
    const val = dateValues[spec.key]
    if (!val?.from) return null
    if (val.op === 'between' || val.op === 'not_between') return val.to ? `${fmtDate(val.from)} – ${fmtDate(val.to)}` : null
    return fmtDate(val.from)
  }
  if (spec.type === 'range') {
    const s = spec as RangeFilterSpec
    const val = rangeValues[spec.key]
    if (val?.from === undefined) return null
    const fmt = s.formatValue ?? String
    if (val.op === 'between' || val.op === 'not_between') return val.to !== undefined ? `${fmt(val.from)} – ${fmt(val.to)}` : null
    return fmt(val.from)
  }
  const cs = spec as CustomFilterSpec<unknown>
  const items = customValues[spec.key] ?? []
  if (items.length === 0) return null
  return cs.getChipLabel
    ? cs.getChipLabel(items)
    : items.length === 1
    ? '1 selected'
    : `${items.length} selected`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function FilterChipBar({
  specs,
  searchValues,
  multiValues,
  customValues,
  dateValues,
  rangeValues,
  onSearchChange,
  onMultiChange,
  onCustomChange,
  onDateChange,
  onRangeChange,
  onClearAll,
  hasActiveFilters,
  compact = false,
}: FilterChipBarProps): React.ReactElement {
  const [addOpen, setAddOpen] = useState(false)
  const [operators, setOperators] = useState<Record<string, string>>({})
  const [valueOpenKey, setValueOpenKey] = useState<string | null>(null)
  const [operatorOpenKey, setOperatorOpenKey] = useState<string | null>(null)
  // Tracks a filter that was just added with no value yet, so its chip stays visible
  // until the value editor closes (regardless of whether a value was entered).
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const getOperator = (spec: FilterSpec) => {
    if (spec.type === 'date') return dateValues[spec.key]?.op ?? 'after'
    if (spec.type === 'range') return rangeValues[spec.key]?.op ?? 'gte'
    return operators[spec.key] ?? DEFAULT_OPERATOR[spec.type]
  }

  const showContainer = hasActiveFilters || pendingKey !== null

  const allFiltered = specs.every(
    (spec) => chipSummary(spec, searchValues, multiValues, customValues, dateValues, rangeValues) !== null,
  )

  // When a filter is picked from the picker list
  const handleAddFilter = (spec: FilterSpec) => {
    setAddOpen(false)

    const alreadyActive = chipSummary(spec, searchValues, multiValues, customValues, dateValues, rangeValues) !== null

    if (alreadyActive) {
      // Already has a value — just re-open its value editor
      setValueOpenKey(spec.key)
      return
    }

    if (spec.type === 'custom') {
      const cs = spec as CustomFilterSpec<unknown>
      if (cs.defaultItems?.length) {
        // Immediately set the default (e.g. "me") — no editor needed
        onCustomChange(spec.key, cs.defaultItems)
        return
      }
    }

    // No value yet: show chip in pending state and open value editor
    setPendingKey(spec.key)
    setValueOpenKey(spec.key)
  }

  const handleValueOpenChange = (spec: FilterSpec, open: boolean) => {
    if (open) {
      setValueOpenKey(spec.key)
    } else {
      setValueOpenKey(null)
      if (pendingKey === spec.key) setPendingKey(null)
    }
  }

  const clearFilter = (spec: FilterSpec) => {
    if (spec.type === 'search') onSearchChange(spec.key, '')
    else if (spec.type === 'multi') onMultiChange(spec.key, [])
    else if (spec.type === 'date') onDateChange(spec.key, { op: 'after', from: '' })
    else if (spec.type === 'range') onRangeChange(spec.key, { op: 'gte' })
    else onCustomChange(spec.key, [])
  }

  // Value editor content rendered inside each chip's popover
  const renderValueEditor = (spec: FilterSpec): React.ReactNode => {
    if (spec.type === 'search') {
      const val = searchValues[spec.key] ?? ''
      return (
        <div className="p-2 w-52">
          <Input
            autoFocus
            placeholder="Search…"
            value={val}
            onChange={(e) => onSearchChange(spec.key, e.target.value)}
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') setValueOpenKey(null)
            }}
          />
        </div>
      )
    }

    if (spec.type === 'multi') {
      const selected = multiValues[spec.key] ?? []
      const toggle = (value: string) => {
        const next = selected.includes(value)
          ? selected.filter((v) => v !== value)
          : [...selected, value]
        onMultiChange(spec.key, next)
      }
      return (
        <Command>
          <CommandList>
            <CommandGroup>
              {spec.options.map((option) => {
                const checked = selected.includes(option.value)
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
                    {option.icon && (
                      <span className="mr-2 flex items-center">{option.icon}</span>
                    )}
                    {option.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      )
    }

    if (spec.type === 'date') {
      const val = dateValues[spec.key]
      const op = val?.op ?? 'after'
      const isBetween = op === 'between' || op === 'not_between'
      if (isBetween) {
        const range = { from: isoToDate(val?.from), to: isoToDate(val?.to) }
        return (
          <Calendar
            mode="range"
            defaultMonth={range.from}
            selected={range}
            onSelect={(r) => {
              onDateChange(spec.key, {
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
          defaultMonth={isoToDate(val?.from)}
          selected={isoToDate(val?.from)}
          onSelect={(d) => onDateChange(spec.key, { op, from: d ? dateToIso(d) : '' })}
          autoFocus
        />
      )
    }

    if (spec.type === 'range') {
      const s = spec as RangeFilterSpec
      const val = rangeValues[spec.key]
      const op = val?.op ?? 'gte'
      const isBetween = op === 'between' || op === 'not_between'
      const fmt = s.formatValue ?? String
      const from = val?.from ?? s.min
      const to = val?.to ?? s.max
      const sliderValue = isBetween ? [from, to] : [from]
      return (
        <div className="flex flex-col gap-3 p-3 w-52">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{fmt(s.min)}</span>
            <span className="font-medium tabular-nums">
              {isBetween ? `${fmt(from)} – ${fmt(to)}` : fmt(from)}
            </span>
            <span className="text-muted-foreground">{fmt(s.max)}</span>
          </div>
          <Slider
            min={s.min}
            max={s.max}
            step={s.step ?? 1}
            value={sliderValue}
            onValueChange={(vals) => {
              if (isBetween) {
                onRangeChange(spec.key, { op, from: vals[0], to: vals[1] })
              } else {
                onRangeChange(spec.key, { op, from: vals[0] })
              }
            }}
          />
        </div>
      )
    }

    // custom
    const cs = spec as CustomFilterSpec<unknown>
    const items = customValues[spec.key] ?? []
    const renderFn = cs.renderContent ?? cs.render
    return <div className="w-72">{renderFn(items, (newItems) => onCustomChange(spec.key, newItems))}</div>
  }

  return (
    <div className={cn(
      'flex items-center gap-1 [&>*]:shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      showContainer && 'h-8 rounded-lg border border-input bg-muted/50 px-[3px] py-0.5',
    )}>
      {/* ── Filter picker button ─────────────────────────────────────── */}
      {!allFiltered && <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              showContainer
                ? 'flex h-6 items-center gap-1.5 rounded-md text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground'
                : 'flex h-8 items-center gap-1.5 rounded-md border border-input text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              showContainer ? (compact ? 'px-1.5' : 'px-2') : (compact ? 'px-2' : 'px-2.5'),
              addOpen && 'bg-accent text-foreground',
            )}
          >
            {showContainer ? (
              <FunnelPlus className="h-3 w-3" />
            ) : (
              <Funnel className="h-3 w-3" />
            )}
            {!compact && (showContainer ? 'Add' : 'Filter')}
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-44 p-0">
          <Command>
            <CommandList>
              <CommandGroup heading="Filterable columns">
                {specs.map((spec) => {
                  const active =
                    chipSummary(spec, searchValues, multiValues, customValues, dateValues, rangeValues) !== null
                  return (
                    <CommandItem
                      key={spec.key}
                      value={specLabel(spec)}
                      onSelect={() => handleAddFilter(spec)}
                      className="text-xs"
                    >
                      <SpecIcon
                        spec={spec}
                        className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      />
                      <span className="flex-1">{specLabel(spec)}</span>
                      {active && <Check className="h-3 w-3 text-muted-foreground" />}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>}

      {/* ── Active filter chips ──────────────────────────────────────── */}
      {specs.map((spec) => {
        const summary = chipSummary(spec, searchValues, multiValues, customValues, dateValues, rangeValues)
        const showChip = summary !== null || valueOpenKey === spec.key || pendingKey === spec.key
        if (!showChip) return null

        const operator = getOperator(spec)
        const operatorOptions = OPERATOR_OPTIONS[spec.type]
        const selectionCount =
          spec.type === 'multi'
            ? (multiValues[spec.key] ?? []).length
            : spec.type === 'custom'
            ? (customValues[spec.key] ?? []).length
            : 1
        const operatorLabel =
          selectionCount > 1 && operator === 'is'
            ? 'is any of'
            : selectionCount > 1 && operator === 'is_not'
            ? 'is none of'
            : (operatorOptions.find((o) => o.value === operator)?.label ?? operator)

        return (
          <div
            key={spec.key}
            className="flex h-6 items-stretch overflow-hidden rounded-md border border-input bg-background text-xs"
          >
            {/* Type: icon + label */}
            <span className="flex items-center gap-1.5 border-r border-input px-2 text-muted-foreground">
              <SpecIcon spec={spec} className="h-3 w-3 shrink-0" />
              {specLabel(spec)}
            </span>

            {/* Operator dropdown */}
            <Popover
              open={operatorOpenKey === spec.key}
              onOpenChange={(open) => setOperatorOpenKey(open ? spec.key : null)}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-0.5 border-r border-input px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {operatorLabel}
                  <ChevronDown className="h-2.5 w-2.5 opacity-40" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-40 p-0">
                <Command>
                  <CommandList>
                    <CommandGroup heading="Operator">
                      {operatorOptions.map((op) => {
                        const label =
                          selectionCount > 1 && op.value === 'is'
                            ? 'is any of'
                            : selectionCount > 1 && op.value === 'is_not'
                            ? 'is none of'
                            : op.label
                        return (
                          <CommandItem
                            key={op.value}
                            value={op.value}
                            onSelect={() => {
                              if (spec.type === 'date') {
                                const cur = dateValues[spec.key]
                                if (op.value === 'between' || op.value === 'not_between') {
                                  let from = cur?.from ?? ''
                                  let to: string | undefined
                                  if (!from) {
                                    const today = new Date()
                                    today.setHours(12, 0, 0, 0)
                                    from = dateToIso(today)
                                    const end = new Date(today)
                                    end.setDate(end.getDate() + 7)
                                    to = dateToIso(end)
                                  } else if (cur?.op === 'before') {
                                    // "before Jan 15" → "Jan 8 – Jan 15"
                                    const endDate = new Date(from + 'T12:00:00')
                                    const startDate = new Date(endDate)
                                    startDate.setDate(startDate.getDate() - 7)
                                    to = from
                                    from = dateToIso(startDate)
                                  } else {
                                    // "after Jan 15" → "Jan 15 – Jan 22"
                                    const startDate = new Date(from + 'T12:00:00')
                                    const endDate = new Date(startDate)
                                    endDate.setDate(endDate.getDate() + 7)
                                    to = dateToIso(endDate)
                                  }
                                  onDateChange(spec.key, { op: op.value as DateVal['op'], from, to })
                                  setOperatorOpenKey(null)
                                  setValueOpenKey(spec.key)
                                } else {
                                  onDateChange(spec.key, { op: op.value as DateVal['op'], from: cur?.from ?? '' })
                                  setOperatorOpenKey(null)
                                }
                              } else if (spec.type === 'range') {
                                const cur = rangeValues[spec.key]
                                const isRangeBetween = op.value === 'between' || op.value === 'not_between'
                                onRangeChange(spec.key, { op: op.value as RangeVal['op'], from: cur?.from, to: isRangeBetween ? cur?.to : undefined })
                                setOperatorOpenKey(null)
                              } else {
                                setOperators((prev) => ({ ...prev, [spec.key]: op.value }))
                                setOperatorOpenKey(null)
                              }
                            }}
                            className="text-xs"
                          >
                            <Check
                              className={cn(
                                'mr-2 h-3.5 w-3.5',
                                operator === op.value ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            {label}
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Value selector */}
            <Popover
              open={valueOpenKey === spec.key}
              onOpenChange={(open) => handleValueOpenChange(spec, open)}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 px-2 transition-colors hover:bg-accent"
                >
                  {renderChipValueDisplay(spec, multiValues, customValues, summary)}
                  <ChevronDown className="h-2.5 w-2.5 opacity-40" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0">
                {renderValueEditor(spec)}
              </PopoverContent>
            </Popover>

            {/* Remove */}
            <button
              type="button"
              onClick={() => clearFilter(spec)}
              className="flex items-center border-l border-input px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={`Remove ${specLabel(spec)} filter`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      })}

      {/* Quick clear */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearAll}
          className={cn(
            'flex h-6 items-center gap-1.5 rounded-md bg-destructive text-xs text-destructive-foreground transition-colors hover:bg-destructive/90',
            compact ? 'px-1.5' : 'px-2',
          )}
        >
          <FunnelX className="h-3 w-3" />
          {!compact && 'Clear'}
        </button>
      )}
    </div>
  )
}
