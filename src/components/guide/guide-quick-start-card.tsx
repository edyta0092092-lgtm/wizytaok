"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"

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
}: GuideQuickStartCardProps) {
  return (
    <Card className="flex h-full flex-col rounded-2xl border border-border/70 bg-card/95 shadow-sm shadow-slate-900/5 dark:shadow-black/15">
      <CardHeader className="shrink-0 space-y-3 pb-2">
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-teal-500/20 bg-muted/65 text-xs font-semibold tabular-nums text-teal-700 dark:border-teal-400/25 dark:bg-muted/40 dark:text-teal-400">
              {index}
            </span>
            <CardTitle className="flex flex-wrap items-center gap-2 pt-0.5 text-[0.9375rem] font-semibold leading-snug">
              <Icon className="size-4 shrink-0 text-primary" aria-hidden />
              <span>{title}</span>
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 pt-0">
        <p className="min-h-[5rem] text-sm leading-relaxed text-muted-foreground sm:min-h-[4.5rem]">
          {description}
        </p>
        <p className="shrink-0 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/90">{whereToClick}</span>
        </p>
        <div className="min-h-0 flex-1" />
        <div className="flex w-full shrink-0 flex-col gap-2">
          <Button asChild variant="outline" className="h-11 w-full rounded-xl sm:h-10">
            <Link href={href}>
              {actionLabel}
            </Link>
          </Button>
          {secondary ? (
            <Button
              asChild
              variant="ghost"
              className="h-11 w-full rounded-xl border border-dashed border-border/80 bg-muted/20 sm:h-10"
            >
              <Link href={secondary.href}>
                {secondary.label}
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
