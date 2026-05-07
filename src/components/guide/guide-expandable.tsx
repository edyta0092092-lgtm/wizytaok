"use client"

import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

type GuideExpandableProps = {
  title: string
  id?: string
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}

export function GuideExpandable({
  title,
  id,
  defaultOpen = false,
  children,
  className,
}: GuideExpandableProps) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className={cn(
        "group rounded-2xl border border-border/70 bg-card/80 shadow-sm shadow-slate-900/5 open:border-border dark:bg-card/60 dark:shadow-black/10",
        className
      )}
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-left text-[0.9375rem] font-semibold text-foreground sm:px-5 sm:py-4 [&::-webkit-details-marker]:hidden"
      >
        <span className="min-w-0 pr-2">{title}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-3 border-t border-border/60 px-4 pb-4 pt-3 text-sm leading-relaxed text-muted-foreground sm:px-5 sm:pb-5">
        {children}
      </div>
    </details>
  )
}
