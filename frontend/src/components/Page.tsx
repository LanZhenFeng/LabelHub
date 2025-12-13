import * as React from 'react'
import { cn } from '@/lib/utils'

export function Page({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[1440px] px-6 py-6 lg:px-8 lg:py-8 before:pointer-events-none before:absolute before:inset-x-0 before:-top-28 before:h-56 before:bg-gradient-to-r before:from-primary/10 before:via-accent/10 before:to-transparent before:blur-2xl before:content-['']",
        className
      )}
      {...props}
    />
  )
}

export function PageHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}
      {...props}
    />
  )
}

export function PageHeading({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-w-0', className)} {...props} />
}

export function PageTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(
        "relative text-2xl font-semibold tracking-tight sm:text-3xl after:absolute after:-bottom-2 after:left-0 after:h-1 after:w-10 after:rounded-full after:bg-gradient-to-r after:from-primary after:to-accent after:content-['']",
        className
      )}
      {...props}
    />
  )
}

export function PageDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-sm text-muted-foreground', className)} {...props} />
}

export function PageActions({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)} {...props} />
}


