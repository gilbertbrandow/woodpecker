import * as React from 'react'
import { Link } from '@tanstack/react-router'
import woodpeckerLogo from '../assets/woodpecker.svg'
import { cn } from '../lib/utils'

type Props = {
  iconClassName?: string
  textClassName?: string
}

export function AppLogo({ iconClassName, textClassName }: Props): React.ReactElement {
  return (
    <Link to="/app" className="flex items-center gap-2">
      <div className="flex size-8 shrink-0 items-center justify-center">
        <img
          src={woodpeckerLogo}
          alt=""
          className={cn('shrink-0 dark:invert -mr-1', iconClassName)}
        />
      </div>
      <span className={cn('font-semibold text-foreground', textClassName)}>
        Woodpecker
      </span>
    </Link>
  )
}
