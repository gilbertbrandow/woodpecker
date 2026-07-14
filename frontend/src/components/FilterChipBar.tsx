import * as React from 'react'
import { useState } from 'react'
import { Funnel, FunnelPlus, FunnelX, X, Check, ChevronDown } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover'
import { Command, CommandList, CommandGroup, CommandItem } from './ui/command'
import { cn } from '../lib/utils'
import type { FilterSpec, FilterValues } from './filters'
import { getHandler } from './filters'

export type FilterChipBarProps = {
  specs: FilterSpec[]
  values: FilterValues
  onChange: (key: string, value: unknown) => void
  onClear: () => void
  hasActiveFilters: boolean
  compact?: boolean
}

function SpecIcon({
  spec,
  className,
}: {
  spec: FilterSpec
  className?: string
}): React.ReactElement | null {
  const Icon = getHandler(spec).getIcon(spec)
  if (!Icon) return null
  return <Icon className={className} />
}

export function FilterChipBar({
  specs,
  values,
  onChange,
  onClear,
  hasActiveFilters,
  compact = false,
}: FilterChipBarProps): React.ReactElement {
  const [addOpen, setAddOpen] = useState(false)
  const [valueOpenKey, setValueOpenKey] = useState<string | null>(null)
  const [operatorOpenKey, setOperatorOpenKey] = useState<string | null>(null)
  // Tracks a just-added filter with no value yet, keeping its chip visible until
  // the editor closes (regardless of whether a value was entered).
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const showContainer = hasActiveFilters || pendingKey !== null || valueOpenKey !== null

  const allFiltered = specs.every((spec) => {
    const handler = getHandler(spec)
    return !handler.isEmpty(values[spec.key] ?? handler.defaultValue(spec))
  })

  const handleAddFilter = (spec: FilterSpec) => {
    setAddOpen(false)
    const handler = getHandler(spec)
    const rawValue = values[spec.key] ?? handler.defaultValue(spec)
    const alreadyActive = !handler.isEmpty(rawValue)

    if (alreadyActive) {
      setValueOpenKey(spec.key)
      return
    }

    if (spec.type === 'entity' && spec.defaultItems?.length) {
      onChange(spec.key, { op: 'is', items: spec.defaultItems })
      return
    }
    if (spec.type === 'custom' && spec.defaultItems?.length) {
      onChange(spec.key, spec.defaultItems)
      return
    }

    setPendingKey(spec.key)
    setValueOpenKey(spec.key)
  }

  const handleValueOpenChange = (spec: FilterSpec, open: boolean) => {
    if (open) {
      setValueOpenKey(spec.key)
    } else {
      setValueOpenKey(null)
      const handler = getHandler(spec)
      const rawValue = values[spec.key] ?? handler.defaultValue(spec)
      if (handler.isEmpty(rawValue)) setPendingKey(spec.key)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 [&>*]:shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        showContainer && 'h-8 rounded-lg border border-input bg-muted/50 px-[3px] py-0.5',
      )}
    >
      {/* ── Filter picker button ─────────────────────────────────────── */}
      {!allFiltered && (
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                showContainer
                  ? 'flex h-6 items-center gap-1.5 rounded-md text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground'
                  : 'flex h-8 items-center gap-1.5 rounded-md border border-input text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                showContainer
                  ? compact ? 'px-1.5' : 'px-2'
                  : compact ? 'px-2' : 'px-2.5',
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
                    const handler = getHandler(spec)
                    const rawValue = values[spec.key] ?? handler.defaultValue(spec)
                    const active = !handler.isEmpty(rawValue)
                    return (
                      <CommandItem
                        key={spec.key}
                        value={handler.getLabel(spec)}
                        onSelect={() => handleAddFilter(spec)}
                        className="text-xs"
                      >
                        <SpecIcon
                          spec={spec}
                          className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        />
                        <span className="flex-1">{handler.getLabel(spec)}</span>
                        {active && <Check className="h-3 w-3 text-muted-foreground" />}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {/* ── Active filter chips ──────────────────────────────────────── */}
      {specs.map((spec) => {
        const handler = getHandler(spec)
        const rawValue = values[spec.key] ?? handler.defaultValue(spec)
        const summary = handler.chipSummary(rawValue, spec)
        const showChip =
          summary !== null || valueOpenKey === spec.key || pendingKey === spec.key
        if (!showChip) return null

        const operator = handler.getOperator(rawValue)
        const operatorOptions = handler.operatorOptions
        const selectionCount = handler.selectionCount?.(rawValue) ?? 1
        const operatorOpt = operatorOptions.find((o) => o.value === operator)
        const baseLabel = operatorOpt?.label ?? operator
        const operatorLabel =
          selectionCount > 1 && operator === 'is'
            ? 'is any of'
            : selectionCount > 1 && operator === 'is_not'
              ? 'is none of'
              : baseLabel
        const operatorSymbol =
          selectionCount > 1
            ? (operatorOpt?.symbolPlural ?? operatorOpt?.symbol)
            : operatorOpt?.symbol

        return (
          <div
            key={spec.key}
            className="flex h-6 items-stretch overflow-hidden rounded-md border border-input bg-background text-xs"
          >
            {/* Type: icon + label */}
            <span className="flex items-center gap-1.5 border-r border-input px-2 text-muted-foreground">
              <SpecIcon spec={spec} className="h-3 w-3 shrink-0" />
              {handler.getLabel(spec)}
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
                  {operatorSymbol ?? operatorLabel}
                  <ChevronDown className="h-2.5 w-2.5 opacity-40" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto min-w-max p-0">
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
                        const symbol =
                          selectionCount > 1
                            ? (op.symbolPlural ?? op.symbol)
                            : op.symbol
                        return (
                          <CommandItem
                            key={op.value}
                            value={op.value}
                            onSelect={() => {
                              const { value: next, openEditor } =
                                handler.onOperatorSwitch(op.value, rawValue, spec)
                              onChange(spec.key, next)
                              setOperatorOpenKey(null)
                              if (openEditor) setValueOpenKey(spec.key)
                            }}
                            className="text-xs whitespace-nowrap"
                          >
                            <Check
                              className={cn(
                                'mr-2 h-3.5 w-3.5',
                                operator === op.value ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            {symbol && (
                              <span className="mr-2 w-3 text-center text-muted-foreground">
                                {symbol}
                              </span>
                            )}
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
                  {handler.renderChipValue(rawValue, spec)}
                  <ChevronDown className="h-2.5 w-2.5 opacity-40" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0">
                {handler.renderEditor(rawValue, (v) => onChange(spec.key, v), spec)}
              </PopoverContent>
            </Popover>

            {/* Remove */}
            <button
              type="button"
              onClick={() => {
                onChange(spec.key, handler.defaultValue(spec))
                if (pendingKey === spec.key) setPendingKey(null)
              }}
              className="flex items-center border-l border-input px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={`Remove ${handler.getLabel(spec)} filter`}
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
          onClick={() => { onClear(); setPendingKey(null); setValueOpenKey(null) }}
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
