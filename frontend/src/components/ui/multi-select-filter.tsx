import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from './popover'
import { Command, CommandList, CommandGroup, CommandItem } from './command'
import { cn } from '../../lib/utils'

export type MultiSelectOption = {
  value: string
  label: string
  icon?: React.ReactNode
}

type MultiSelectFilterProps = {
  label: string
  options: MultiSelectOption[]
  selected: string[]
  onChange: (values: string[]) => void
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: MultiSelectFilterProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)

  const toggle = (value: string): void => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const noneSelected = selected.length === 0
  const isPartial = selected.length > 0 && selected.length < options.length

  const selectedOptions = options.filter((o) => selected.includes(o.value))
  const visibleOptions = selectedOptions.slice(0, 2)
  const overflow = selectedOptions.length - visibleOptions.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
            open && 'border-ring ring-1 ring-ring',
          )}
        >
          {noneSelected ? (
            <span>{`Select ${label}…`}</span>
          ) : isPartial ? (
            <>
              {visibleOptions.map((o) => (
                <span
                  key={o.value}
                  className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-foreground"
                >
                  {o.icon}
                  {o.label}
                </span>
              ))}
              {overflow > 0 && (
                <span className="rounded-sm bg-muted px-1 font-mono text-xs text-foreground">
                  +{overflow}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="text-foreground">{`All ${label}`}</span>
              <span className="rounded-sm bg-muted px-1 font-mono text-xs text-foreground">
                {selected.length}
              </span>
            </>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-48 p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => toggle(option.value)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div
                    className={cn(
                      'mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary',
                      selected.includes(option.value)
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
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
