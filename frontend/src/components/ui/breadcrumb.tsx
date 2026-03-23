import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

function Breadcrumb({ className, ...props }: React.ComponentPropsWithoutRef<'nav'>): React.ReactElement {
  return <nav aria-label="breadcrumb" className={cn(className)} {...props} />
}

function BreadcrumbList({ className, ...props }: React.ComponentPropsWithoutRef<'ol'>): React.ReactElement {
  return (
    <ol
      className={cn('flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

function BreadcrumbItem({ className, ...props }: React.ComponentPropsWithoutRef<'li'>): React.ReactElement {
  return <li className={cn('inline-flex items-center gap-1.5', className)} {...props} />
}

function BreadcrumbLink({ className, ...props }: React.ComponentPropsWithoutRef<'a'>): React.ReactElement {
  return (
    <a
      className={cn('transition-colors hover:text-foreground', className)}
      {...props}
    />
  )
}

function BreadcrumbPage({ className, ...props }: React.ComponentPropsWithoutRef<'span'>): React.ReactElement {
  return (
    <span
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('text-foreground', className)}
      {...props}
    />
  )
}

function BreadcrumbSeparator({ className, ...props }: React.ComponentPropsWithoutRef<'li'>): React.ReactElement {
  return (
    <li role="presentation" aria-hidden="true" className={cn(className)} {...props}>
      <ChevronRight className="h-3.5 w-3.5" />
    </li>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
}
