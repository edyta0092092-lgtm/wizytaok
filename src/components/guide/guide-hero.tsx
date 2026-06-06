"use client"

import Link from "next/link"
import { BookOpen } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type GuideHeroProps = {
  badge: string
  title: string
  description: string
  subtitle?: string
  /** Link do konfiguracji na dashboardzie (osobno od onboardingu). */
  setupCtaLabel?: string
  setupCtaHref?: string
}

export function GuideHero({
  badge,
  title,
  description,
  subtitle,
  setupCtaLabel,
  setupCtaHref = "/dashboard",
}: GuideHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-muted/30 via-card to-card shadow-sm">
      <div
        className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-primary/8 blur-3xl"
        aria-hidden
      />
      <div className="relative space-y-5 px-5 py-7 sm:px-8 sm:py-8" data-tour="guide-intro">
        <Badge
          variant="outline"
          className="rounded-full border-primary/25 bg-primary/8 px-3 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-primary"
        >
          {badge}
        </Badge>
        <div className="space-y-3">
          <p className="text-panel-section text-balance">{title}</p>
          <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>
          {subtitle ? (
            <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground/90">
              {subtitle}
            </p>
          ) : null}
        </div>
        {setupCtaLabel ? (
          <Button type="button" variant="outline" size="lg" className="h-11 rounded-xl" asChild>
            <Link href={setupCtaHref}>
              <BookOpen className="mr-2 size-4 shrink-0" aria-hidden />
              {setupCtaLabel}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
