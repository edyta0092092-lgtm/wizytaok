"use client"

import Link from "next/link"

import { cn } from "@/lib/utils"

type DashboardDayStatTileProps = {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  href: string
  className?: string
}

export function DashboardDayStatTile({
  label,
  value,
  icon: Icon,
  href,
  className,
}: DashboardDayStatTileProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[4.75rem] min-w-0 touch-manipulation flex-col rounded-2xl border border-border bg-card px-2.5 py-3 shadow-sm shadow-slate-900/5 outline-none transition-colors hover:border-primary/40 hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-ring sm:px-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-xs font-medium leading-snug text-muted-foreground">{label}</p>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-2xl bg-muted text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </Link>
  )
}
