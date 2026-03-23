import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'

type ThemeSliderProps = {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}

const INTERNAL_MID = 50
const SNAP_THRESHOLD = 0.1

function weightToInternal(weight: number): number {
  if (weight <= 1) return weight * INTERNAL_MID
  return INTERNAL_MID + ((weight - 1) / 3) * INTERNAL_MID
}

function internalToWeight(internal: number): number {
  if (internal <= INTERNAL_MID) return internal / INTERNAL_MID
  return 1 + ((internal - INTERNAL_MID) / INTERNAL_MID) * 3
}

function snapWeight(weight: number): number {
  return Math.abs(weight - 1) <= SNAP_THRESHOLD ? 1 : Math.round(weight * 100) / 100
}

export function ThemeSlider({ value, onChange, disabled = false }: ThemeSliderProps): React.ReactElement {
  const internal = Math.round(weightToInternal(value) * 2) / 2

  return (
    <div className="relative flex w-full items-center">
      <SliderPrimitive.Root
        min={0}
        max={100}
        step={0.5}
        value={[internal]}
        onValueChange={(vals) => {
          const v = vals[0]
          if (v !== undefined) {
            onChange(snapWeight(internalToWeight(v)))
          }
        }}
        disabled={disabled}
        className="relative flex h-5 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-px w-full grow bg-border">
          <SliderPrimitive.Range className="absolute h-full bg-transparent" />
        </SliderPrimitive.Track>
        <div
          className="pointer-events-none absolute h-2.5 w-px -translate-x-1/2 bg-muted-foreground/40"
          style={{ left: `${INTERNAL_MID}%` }}
        />
        <SliderPrimitive.Thumb className="block h-3.5 w-3.5 cursor-grab rounded-full bg-foreground shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:cursor-grabbing active:shadow-md disabled:pointer-events-none disabled:opacity-50" />
      </SliderPrimitive.Root>
    </div>
  )
}
