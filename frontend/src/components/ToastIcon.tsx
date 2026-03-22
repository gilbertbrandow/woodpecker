import { Info } from 'lucide-react'

export function ToastIcon() {
  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground">
      <Info className="h-3 w-3 text-background" />
    </div>
  )
}
