import { useMemo } from 'react'
import { ScheduleSelectorContent } from '../components/ScheduleSelector'
import { api, type SelectableSchedule } from '../lib/api'
import type { SetFilterSpec } from '../components/filters'
import { CalendarDays } from 'lucide-react'

export function useScheduleSetFilterSpec(urlKey: string, label = 'Schedules'): SetFilterSpec<SelectableSchedule> {
  return useMemo<SetFilterSpec<SelectableSchedule>>(() => ({
    type: 'set',
    key: urlKey,
    label,
    icon: CalendarDays,
    render: (value, onChange) => <ScheduleSelectorContent value={value} onChange={onChange} />,
    renderContent: (value, onChange) => <ScheduleSelectorContent value={value} onChange={onChange} />,
    serialize: (schedules) => schedules.map((s) => String(s.id)),
    resolveInstant: () => null,
    resolveIds: (ids) => api.schedules.getByIds(ids.map(Number)),
    getChipLabel: (schedules) => {
      if (schedules.length === 0) return ''
      if (schedules.length === 1) return schedules[0].name
      return `${schedules.length} schedules`
    },
    renderChipValue: (schedules) => {
      if (schedules.length === 0) return null
      const chipLabel = schedules.length === 1 ? schedules[0].name : `${schedules.length} schedules`
      return <span className="font-medium text-foreground">{chipLabel}</span>
    },
  }), [urlKey, label])
}
