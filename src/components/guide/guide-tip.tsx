import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type GuideTipProps = {
  icon: ReactNode
  title?: string
  children: ReactNode
  variant?: "default" | "muted"
}

export function GuideTip({
  icon,
  title,
  children,
  variant = "default",
}: GuideTipProps) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed",
        variant === "default" &&
          "border-primary/20 bg-primary/5 text-foreground dark:border-primary/25 dark:bg-primary/10",
        variant === "muted" &&
          "border-border/80 bg-muted/30 text-muted-foreground dark:bg-muted/20"
      )}
    >
      <span className="mt-0.5 shrink-0 text-primary" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-medium text-foreground">{title}</p> : null}
        <div className="text-pretty">{children}</div>
      </div>
    </div>
  )
}
