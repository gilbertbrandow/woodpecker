import * as React from 'react'
import * as RechartsPrimitive from 'recharts'
import { cn } from '../../lib/utils'

export type ChartConfig = Record<
  string,
  { label?: React.ReactNode; color?: string }
>

type ChartContextProps = { config: ChartConfig }
const ChartContext = React.createContext<ChartContextProps | null>(null)

export function useChart(): ChartContextProps {
  const ctx = React.useContext(ChartContext)
  if (!ctx) throw new Error('useChart must be used within ChartContainer')
  return ctx
}

export const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    config: ChartConfig
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children']
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uid = React.useId()
  const chartId = `chart-${id ?? uid.replace(/:/g, '')}`

  const cssVars = Object.entries(config)
    .filter(([, v]) => v.color)
    .map(([k, v]) => `[data-chart=${chartId}]{--color-${k}:${v.color}}`)
    .join('')

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          'flex justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50 [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none',
          className,
        )}
        {...props}
      >
        {cssVars && <style dangerouslySetInnerHTML={{ __html: cssVars }} />}
        <RechartsPrimitive.ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = 'ChartContainer'

export const ChartTooltip = RechartsPrimitive.Tooltip

type TooltipPayloadItem = {
  dataKey?: string | number | ((obj: unknown) => unknown)
  color?: string
  value?: unknown
  payload?: unknown
}

export type ChartTooltipContentProps = {
  active?: boolean
  payload?: readonly TooltipPayloadItem[]
  label?: unknown
  className?: string
  labelFormatter?: (label: string, payload: readonly TooltipPayloadItem[]) => React.ReactNode
  formatter?: (value: unknown, name: string, item: TooltipPayloadItem) => React.ReactNode
  hideLabel?: boolean
}

export const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  ({ active, payload, label, labelFormatter, formatter, hideLabel = false, className }, ref) => {
    const { config } = useChart()

    if (!active || !payload?.length) return null

    return (
      <div
        ref={ref}
        className={cn('rounded border bg-background px-3 py-2 text-xs shadow-md', className)}
      >
        {!hideLabel && (
          <p className="mb-1 font-medium text-foreground">
            {labelFormatter ? labelFormatter(String(label), payload) : String(label ?? '')}
          </p>
        )}
        <div className="flex flex-col gap-0.5">
          {payload.map((item, i) => {
            const key = typeof item.dataKey === 'string' ? item.dataKey : ''
            const cfg = config[key]
            const value = item.value
            const color = item.color ?? cfg?.color ?? `hsl(var(--chart-${i + 1}))`
            return (
              <div key={i} className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} />
                <span className="text-muted-foreground">{cfg?.label ?? key}</span>
                <span className="ml-auto pl-4 font-medium tabular-nums text-foreground">
                  {formatter ? formatter(value, key, item) : String(value ?? '')}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  },
)
ChartTooltipContent.displayName = 'ChartTooltipContent'
