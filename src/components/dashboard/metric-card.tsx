import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type MetricCardProps = {
  label: string
  value: string | number
  hint?: string
  icon: LucideIcon
  className?: string
}

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: MetricCardProps) {
  return (
    <Card
      size="sm"
      className={cn("rounded-xl border border-border/70 bg-card/80 shadow-none", className)}
    >
      <CardContent className="flex items-start justify-between gap-2 px-3 py-2.5 sm:px-3.5 sm:py-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tabular-nums text-foreground sm:text-xl">
            {value}
          </p>
          {hint ? (
            <p className="text-[0.7rem] leading-snug text-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>
        <span className="hidden shrink-0 sm:flex size-8 items-center justify-center rounded-lg bg-muted/50 text-primary">
          <Icon className="size-3.5" aria-hidden />
        </span>
      </CardContent>
    </Card>
  )
}
