"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type GuideStepCardProps = {
  index: number
  title: string
  description: string
  hint: string
  buttonLabel: string
  href: string
  icon: LucideIcon
  statusLabel: string
  statusClassName: string
  onCycleStatus: () => void
  onShowMe: () => void
}

export function GuideStepCard({
  index,
  title,
  description,
  hint,
  buttonLabel,
  href,
  icon: Icon,
  statusLabel,
  statusClassName,
  onCycleStatus,
  onShowMe,
}: GuideStepCardProps) {
  return (
    <Card className="rounded-2xl border border-border/70 bg-card/95 shadow-sm shadow-slate-900/5">
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-muted/65 text-xs font-semibold tabular-nums text-primary">
              {index}
            </span>
            <div className="min-w-0">
              <CardTitle className="flex flex-wrap items-center gap-2 text-[0.9375rem] font-semibold leading-snug">
                <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                <span>{title}</span>
              </CardTitle>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`cursor-pointer shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium transition-colors ${statusClassName}`}
            tabIndex={0}
            role="button"
            onClick={onCycleStatus}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onCycleStatus()
              }
            }}
            aria-label={statusLabel}
          >
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground/90">
          {hint}
        </p>
        <Button size="sm" className="h-10 rounded-xl" asChild>
          <Link href={href} aria-label={buttonLabel} onClick={onShowMe}>
            {buttonLabel}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
