import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type KpiCardProps = {
  label: string
  value: string | number
  helper?: string
  icon?: LucideIcon
  className?: string
}

/** Wspólna karta KPI panelu. */
export function KpiCard({ label, value, helper, icon: Icon, className }: KpiCardProps) {
  return (
    <Card
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5",
        className
      )}
    >
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              {value}
            </p>
          </div>
          {Icon ? (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-primary">
              <Icon className="size-4" aria-hidden />
            </span>
          ) : null}
        </div>
        {helper ? (
          <p className="mt-2 truncate text-xs text-muted-foreground">{helper}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
