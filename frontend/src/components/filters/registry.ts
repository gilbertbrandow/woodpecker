import type { FilterSpec, FilterHandler } from './types'
import { searchHandler } from './search'
import { multiHandler } from './multi'
import { customHandler } from './custom'
import { entityHandler } from './entity'
import { setHandler } from './set'
import { dateHandler } from './date'
import { rangeHandler } from './range'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FILTER_HANDLERS: Record<FilterSpec['type'], FilterHandler<any, any>> = {
  search: searchHandler,
  multi: multiHandler,
  custom: customHandler,
  entity: entityHandler,
  set: setHandler,
  date: dateHandler,
  range: rangeHandler,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getHandler(spec: FilterSpec): FilterHandler<any, any> {
  return FILTER_HANDLERS[spec.type]
}
