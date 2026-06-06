import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type PanelEmptyStateProps = {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  actionHref?: string
  className?: string
}

/** Pusty stan panelu: nagłówek, opis, jedno CTA — bez ilustracji. */
export function PanelEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className,
}: PanelEmptyStateProps) {
  return (
    <Card
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5",
        className
      )}
    >
      <CardContent className="py-10 text-center">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        {actionLabel && (onAction || actionHref) ? (
          <div className="mt-6 flex justify-center">
            {actionHref ? (
              <Button asChild className="h-10 rounded-xl">
                <Link href={actionHref}>{actionLabel}</Link>
              </Button>
            ) : (
              <Button type="button" className="h-10 rounded-xl" onClick={onAction}>
                {actionLabel}
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
