"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

export type NativeSelectProps = React.ComponentProps<"select"> & {
  wrapperClassName?: string
  chevronClassName?: string
}

/**
 * Native <select> with a consistently positioned chevron that does not collide
 * with rounded borders. Visual/sizing classes go on `className` (applied to the
 * select); layout classes such as width or margins go on `wrapperClassName`.
 */
export function NativeSelect({
  className,
  wrapperClassName,
  chevronClassName,
  children,
  ...props
}: NativeSelectProps) {
  return (
    <div className={cn("relative flex w-full max-w-full items-center", wrapperClassName)}>
      <select
        className={cn(
          "h-11 w-full min-w-0 cursor-pointer appearance-none rounded-xl border border-input bg-card px-3 py-2 pr-9 text-base text-foreground transition-colors outline-none scheme-light-dark focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/30 disabled:opacity-60 sm:h-10 sm:text-sm dark:bg-input/20 dark:scheme-dark dark:hover:bg-input/35 dark:disabled:bg-input/60 [&>option]:bg-popover [&>option]:text-popover-foreground",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground",
          chevronClassName
        )}
      />
    </div>
  )
}
