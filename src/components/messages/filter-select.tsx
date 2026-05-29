"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Natywny <select> w stylu „chip" z własną strzałką (spójny z layoutem,
 * bez nachodzenia natywnej strzałki na obramowanie).
 */
export function FilterSelect({
  value,
  onChange,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
  children: React.ReactNode
  "aria-label"?: string
}) {
  return (
    <div className={cn("relative inline-flex", className)}>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-full border border-input bg-background pl-3 pr-8 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 sm:text-sm"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}
