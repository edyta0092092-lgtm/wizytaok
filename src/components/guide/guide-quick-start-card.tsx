"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
type GuideQuickStartCardProps = {
  index: number
  title: string
  description: string
  whereToClick: string
  actionLabel: string
  href: string
  secondary?: { label: string; href: string }
  icon: LucideIcon
  statusLabel: string
  statusClassName: string
  onCycleStatus: () => void
  onShowMe: () => void
}

export function GuideQuickStartCard({
  index,
  title,
  description,
  whereToClick,
  actionLabel,
  href,
  secondary,
  icon: Icon,
  statusLabel,
  statusClassName,
  onCycleStatus,
  onShowMe,
}: GuideQuickStartCardProps) {
  return (
    <Card className="h-full rounded-2xl border border-border/70 bg-card/95 shadow-sm shadow-slate-900/5 dark:shadow-black/15">
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-teal-500/20 bg-muted/65 text-xs font-semibold tabular-nums text-teal-700 dark:border-teal-400/25 dark:bg-muted/40 dark:text-teal-400">
              {index}
            </span>
            <CardTitle className="flex flex-wrap items-center gap-2 pt-0.5 text-[0.9375rem] font-semibold leading-snug">
              <Icon className="size-4 shrink-0 text-primary" aria-hidden />
              <span>{title}</span>
            </CardTitle>
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
      <CardContent className="space-y-4 pt-0">
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/90">{whereToClick}</span>
        </p>
        <div className="flex w-full flex-col gap-2">
          <Button asChild variant="outline" className="h-11 w-full rounded-xl sm:h-10">
            <Link href={href} onClick={onShowMe}>
              {actionLabel}
            </Link>
          </Button>
          {secondary ? (
            <Button
              asChild
              variant="ghost"
              className="h-11 w-full rounded-xl border border-dashed border-border/80 bg-muted/20 sm:h-10"
            >
              <Link href={secondary.href} onClick={onShowMe}>
                {secondary.label}
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
