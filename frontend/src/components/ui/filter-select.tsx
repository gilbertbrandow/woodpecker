import * as React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

type FilterSelectOption = { value: string; label: string }

export function FilterSelect({
  value,
  onValueChange,
  placeholder,
  options,
  size = 'sm',
  className,
}: {
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  options: FilterSelectOption[]
  size?: 'sm' | 'default'
  className?: string
}): React.ReactElement {
  return (
    <Select
      value={value === '' ? '__all__' : value}
      onValueChange={(v) => onValueChange(v === '__all__' ? '' : v)}
    >
      <SelectTrigger size={size} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">{placeholder}</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
