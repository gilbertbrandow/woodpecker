import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from '../../lib/utils'

function Avatar({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>): React.ReactElement {
  return (
    <AvatarPrimitive.Root
      className={cn('relative flex shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>): React.ReactElement {
  return (
    <AvatarPrimitive.Image
      className={cn('aspect-square h-full w-full object-cover', className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>): React.ReactElement {
  return (
    <AvatarPrimitive.Fallback
      className={cn('flex h-full w-full items-center justify-center rounded-full', className)}
      {...props}
    />
  )
}

function AvatarGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn('flex items-center [&>*:not(:first-child)]:-ml-2', className)}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>): React.ReactElement {
  return (
    <span
      className={cn(
        'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount }
