import { Circle, CircleOff } from 'lucide-react'
import type { FilterHandler, OperatorOption } from './types'

export const NULL_OP_OPTIONS: OperatorOption[] = [
  { value: 'set', label: 'is set', icon: <Circle className="h-3.5 w-3.5" /> },
  { value: 'not_set', label: 'is not set', icon: <CircleOff className="h-3.5 w-3.5" /> },
]

export function isNullOp(op: string | undefined): op is 'set' | 'not_set' {
  return op === 'set' || op === 'not_set'
}

function getOp(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  return (value as { op?: string }).op
}

export function withNullable<TVal, TSpec extends { nullable?: boolean }>(
  handler: FilterHandler<TVal, TSpec>,
  makeNullOpVal: (op: 'set' | 'not_set') => TVal,
): FilterHandler<TVal, TSpec> {
  return {
    ...handler,
    getOperatorOptions(spec) {
      const base = handler.getOperatorOptions?.(spec) ?? handler.operatorOptions
      return spec.nullable ? [...base, ...NULL_OP_OPTIONS] : base
    },
    isEmpty: (value) => !isNullOp(getOp(value)) && handler.isEmpty(value),
    toUrl: (value, spec) => {
      const op = getOp(value)
      return isNullOp(op) ? [op] : handler.toUrl(value, spec)
    },
    fromUrl: (tokens, spec) => {
      if (tokens.length === 1 && isNullOp(tokens[0]))
        return makeNullOpVal(tokens[0] as 'set' | 'not_set')
      return handler.fromUrl(tokens, spec)
    },
    getFetchParams: (value, spec) => {
      const op = getOp(value)
      return isNullOp(op) ? [op] : handler.getFetchParams(value, spec)
    },
    chipSummary: (value, spec) =>
      isNullOp(getOp(value)) ? '' : handler.chipSummary(value, spec),
    isValueEditable: (value) => !isNullOp(getOp(value)),
    onOperatorSwitch: (newOp, current, spec) => {
      if (isNullOp(newOp))
        return { value: makeNullOpVal(newOp as 'set' | 'not_set'), openEditor: false }
      return handler.onOperatorSwitch(newOp, current, spec)
    },
  }
}
