import * as React from 'react'
import { cn } from '../lib/utils'

export function PageWrapper({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}): React.ReactElement {
  return (
    <div className={cn('mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 3xl:max-w-8xl', className)}>
      {children}
    </div>
  )
}
