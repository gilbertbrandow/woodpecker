import { ScheduleSelector, ScheduleSelectorContent } from '../components/ScheduleSelector'
import { api, type SelectableSchedule } from '../lib/api'
import type { EntityFilterSpec } from '../components/ServerDataTable'
import { CalendarDays } from 'lucide-react'

// Returns a ready-made ServerDataTable EntityFilterSpec for a schedule selector filter.
// Pass the urlKey that matches the backend query param (e.g. 'scheduleId').
export function useScheduleFilterSpec(urlKey: string, label = 'Schedule'): EntityFilterSpec<SelectableSchedule> {
  return {
    type: 'entity',
    key: urlKey,
    label,
    icon: CalendarDays,
    render: (value, onChange) => (
      <ScheduleSelector value={value} onChange={onChange} />
    ),
    renderContent: (value, onChange) => (
      <ScheduleSelectorContent value={value} onChange={onChange} />
    ),
    serialize: (schedules) => schedules.map((s) => String(s.id)),
    resolveInstant: () => null,
    resolveIds: (ids) => api.selectableSchedules.getByIds(ids.map(Number)),
    getChipLabel: (schedules) => {
      if (schedules.length === 0) return ''
      if (schedules.length === 1) return schedules[0].name
      return `${schedules.length} schedules`
    },
    renderChipValue: (schedules) => {
      if (schedules.length === 0) return null
      const label = schedules.length === 1 ? schedules[0].name : `${schedules.length} schedules`
      return <span className="font-medium text-foreground">{label}</span>
    },
  }
}
