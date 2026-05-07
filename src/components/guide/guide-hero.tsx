"use client"

import { Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type GuideHeroProps = {
  badge: string
  title: string
  description: string
  subtitle?: string
  startTourLabel: string
  onStartTour: () => void
}

export function GuideHero({
  badge,
  title,
  description,
  subtitle,
  startTourLabel,
  onStartTour,
}: GuideHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-[color:var(--nav-active-bg)] via-card/90 to-card shadow-sm shadow-slate-900/5 dark:shadow-black/20">
      <div
        className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-primary/10 blur-3xl dark:bg-primary/15"
        aria-hidden
      />
      <div className="relative space-y-5 px-5 py-7 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="rounded-full border-primary/30 bg-primary/10 px-3 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-primary dark:border-primary/40 dark:bg-primary/15"
          >
            {badge}
          </Badge>
        </div>
        <div className="space-y-3">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>
          {subtitle ? (
            <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground/95 sm:text-base">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            size="lg"
            className="h-11 w-full rounded-2xl sm:w-auto sm:min-w-48"
            onClick={onStartTour}
          >
            <Sparkles className="mr-2 size-4 shrink-0" aria-hidden />
            {startTourLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
