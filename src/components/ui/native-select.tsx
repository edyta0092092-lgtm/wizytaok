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
    <div className={cn("relative inline-flex max-w-full items-center", wrapperClassName)}>
      <select
        className={cn("max-w-full cursor-pointer appearance-none pr-9", className)}
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
