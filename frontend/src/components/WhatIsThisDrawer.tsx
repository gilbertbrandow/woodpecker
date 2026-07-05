import * as React from 'react'
import { Info } from 'lucide-react'
import { Drawer, DrawerTrigger, DrawerContent } from './ui/drawer'

interface Props {
  title: React.ReactNode
  description: React.ReactNode
  triggerLabel?: string
}

export function WhatIsThisDrawer({ title, description, triggerLabel = 'What is this?' }: Props): React.ReactElement {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          {triggerLabel}
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-2xl px-8 py-6">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">{title}</div>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
