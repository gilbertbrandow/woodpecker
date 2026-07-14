import * as React from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { cn } from '../lib/utils'

type SelectorTriggerProps = {
  open: boolean
  disabled?: boolean
  className?: string
  children: React.ReactNode
}

export function SelectorTrigger({
  open,
  disabled,
  className,
  children,
}: SelectorTriggerProps): React.ReactElement {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'flex h-8 w-fit items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50',
        open && 'border-ring ring-1 ring-ring',
        className,
      )}
    >
      {children}
      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
    </button>
  )
}
