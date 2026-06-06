"use client"

import * as React from "react"
import Link from "next/link"
import {
  Ban,
  CalendarDays,
  CalendarOff,
  CircleHelp,
  CreditCard,
  Globe,
  LayoutGrid,
  Mail,
  MessageCircle,
  RotateCcw,
  Search,
  Sparkles,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  HELP_CENTER_CATEGORIES,
  HELP_CENTER_FAQ_KEYS,
  HELP_CENTER_SECTIONS,
  type HelpCenterCategoryId,
  type HelpCenterSection,
} from "@/lib/guide/help-center-sections"
import type { GuideReferenceBlock } from "@/lib/guide/guide-reference"
import { useOnboarding } from "@/lib/onboarding/onboarding-provider"
import { cn } from "@/lib/utils"

const CATEGORY_ICONS: Record<HelpCenterCategoryId, LucideIcon> = {
  "first-setup": Sparkles,
  "schedule-availability": CalendarDays,
  "schedule-exceptions": CalendarOff,
  team: Users,
  services: Wrench,
  "appointments-statuses": LayoutGrid,
  "cancel-appointments": Ban,
  "online-booking": Globe,
  notifications: Mail,
  "billing-trial": CreditCard,
}

function linesFromTranslation(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-•]\s*/, "").replace(/^\d+\.\s*/, ""))
}

function pickDisplayBlocks(blocks: GuideReferenceBlock[]): GuideReferenceBlock[] {
  const lead = blocks.find((b) => b.type === "lead")
  const steps = blocks.find((b) => b.type === "steps")
  const tip = blocks.find((b) => b.type === "tip")
  const result: GuideReferenceBlock[] = []
  if (lead) result.push(lead)
  if (steps) result.push(steps)
  else if (blocks.find((b) => b.type === "bullets")) {
    result.push(blocks.find((b) => b.type === "bullets")!)
  }
  if (tip && result.length < 2) result.push(tip)
  return result.slice(0, 2)
}

export type HelpCenterHubProps = {
  t: (key: string) => string
  bookingPath: string
  isAdmin: boolean
}

export function HelpCenterHub({ t, bookingPath, isAdmin }: HelpCenterHubProps) {
  const { restartOnboarding, eligible } = useOnboarding()
  const [query, setQuery] = React.useState("")
  const [activeCategory, setActiveCategory] = React.useState<HelpCenterCategoryId | null>(null)

  const normalizedQuery = query.trim().toLowerCase()

  const visibleCategories = React.useMemo(
    () => HELP_CENTER_CATEGORIES.filter((cat) => isAdmin || !cat.adminOnly),
    [isAdmin],
  )

  const visibleSections = React.useMemo(
    () => HELP_CENTER_SECTIONS.filter((section) => isAdmin || !section.adminOnly),
    [isAdmin],
  )

  const filteredSections = React.useMemo(() => {
    return visibleSections.filter((section) => {
      if (activeCategory && section.category !== activeCategory) return false
      if (!normalizedQuery) return true
      const title = t(section.titleKey).toLowerCase()
      if (title.includes(normalizedQuery)) return true
      if (section.searchTags.some((tag) => tag.includes(normalizedQuery))) return true
      for (const block of section.blocks) {
        if (t(block.key).toLowerCase().includes(normalizedQuery)) return true
      }
      return false
    })
  }, [activeCategory, isAdmin, normalizedQuery, t, visibleSections])

  const resolveHref = (section: HelpCenterSection) => {
    if (section.id === "booking-public-flow") return bookingPath
    return section.href ?? "/dashboard"
  }

  const showOnboardingRestart = isAdmin && eligible

  return (
    <div className="flex flex-col gap-8">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
        <div
          className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <div className="relative space-y-4 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {t("guide.helpCenterBadge")}
          </p>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("guide.helpCenterDescription")}
          </p>
          <div className="relative max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("guide.helpCenterSearchPlaceholder")}
              className="h-11 rounded-xl pl-10"
              aria-label={t("guide.helpCenterSearchPlaceholder")}
            />
          </div>
        </div>
      </div>

      {showOnboardingRestart ? (
        <Card className="rounded-2xl border border-primary/25 bg-primary/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("guide.helpCenterRestartTitle")}</CardTitle>
            <CardDescription>{t("guide.helpCenterRestartDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              className="h-10 rounded-xl"
              onClick={() => restartOnboarding()}
            >
              <RotateCcw className="mr-2 size-4" aria-hidden />
              {t("guide.helpCenterRestartCta")}
            </Button>
            <Button type="button" variant="outline" className="h-10 rounded-xl" asChild>
              <Link href="/dashboard">{t("guide.navDashboard")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("guide.helpCenterCategoriesTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCategories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.id]
            const selected = activeCategory === cat.id
            const count = visibleSections.filter((s) => s.category === cat.id).length
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory((prev) => (prev === cat.id ? null : cat.id))
                }}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-xl",
                    selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="text-sm font-semibold text-foreground">{t(cat.titleKey)}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{t(cat.descriptionKey)}</span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {t("guide.helpCenterArticleCount").replace("{count}", String(count))}
                </span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => {
              setActiveCategory(null)
              document.getElementById("help-center-faq")?.scrollIntoView({ behavior: "smooth" })
            }}
            className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-muted text-foreground">
              <CircleHelp className="size-4" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-foreground">{t("guide.faqTitle")}</span>
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {t("guide.helpCenterFaqCardDesc")}
            </span>
          </button>
        </div>
        {activeCategory ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg text-muted-foreground"
            onClick={() => setActiveCategory(null)}
          >
            {t("guide.helpCenterShowAllCategories")}
          </Button>
        ) : null}
      </section>

      <section className="space-y-3" id="help-center-articles">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {activeCategory
              ? t(visibleCategories.find((c) => c.id === activeCategory)?.titleKey ?? "guide.helpCenterArticlesTitle")
              : normalizedQuery
                ? t("guide.helpCenterSearchResults")
                : t("guide.helpCenterArticlesTitle")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {filteredSections.length}{" "}
            {filteredSections.length === 1
              ? t("guide.helpCenterArticleSingular")
              : t("guide.helpCenterArticlePlural")}
          </p>
        </div>

        {filteredSections.length === 0 ? (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {t("guide.moduleSearchEmpty")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredSections.map((section) => (
              <HelpCenterArticleCard
                key={section.id}
                section={section}
                t={t}
                href={resolveHref(section)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 scroll-mt-20" id="help-center-faq">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{t("guide.faqTitle")}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {HELP_CENTER_FAQ_KEYS.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-xl border border-border bg-card px-4 py-3 shadow-sm shadow-slate-900/5"
            >
              <summary className="cursor-pointer list-none text-sm font-medium [&::-webkit-details-marker]:hidden">
                {t(faq.q)}
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t(faq.a)}</p>
            </details>
          ))}
        </div>
      </section>

      <Card className="rounded-2xl border border-border bg-muted/20">
        <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-foreground">{t("guide.modHelpTitle")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("guide.helpCenterSupportLead")}</p>
            </div>
          </div>
          <Button asChild variant="outline" className="h-10 shrink-0 rounded-xl">
            <Link href="/help">{t("guide.navHelp")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function HelpCenterArticleCard({
  section,
  t,
  href,
}: {
  section: HelpCenterSection
  t: (key: string) => string
  href: string
}) {
  const blocks = pickDisplayBlocks(section.blocks)

  return (
    <Card className="rounded-2xl border border-border shadow-sm shadow-slate-900/5">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-base font-semibold leading-snug">{t(section.titleKey)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {blocks.map((block) => {
          const text = t(block.key)
          if (block.type === "lead") {
            return (
              <p key={block.key} className="text-sm text-muted-foreground">
                {text}
              </p>
            )
          }
          if (block.type === "tip") {
            return (
              <p
                key={block.key}
                className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-950 dark:text-amber-100"
              >
                {text}
              </p>
            )
          }
          const lines = linesFromTranslation(text)
          const ordered = block.type === "steps"
          return (
            <ol
              key={block.key}
              className={cn(
                "space-y-1.5 text-sm text-foreground",
                ordered ? "list-decimal pl-5" : "list-disc pl-5",
              )}
            >
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          )
        })}
        {section.ctaKey ? (
          <Button asChild variant="outline" size="sm" className="h-9 rounded-xl">
            <Link href={href}>{t(section.ctaKey)}</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
