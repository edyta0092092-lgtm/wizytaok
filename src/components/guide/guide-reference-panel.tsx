"use client"

import * as React from "react"
import Link from "next/link"

import { GuideExpandable } from "@/components/guide/guide-expandable"
import { GuideTip } from "@/components/guide/guide-tip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  HELP_CENTER_CATEGORIES,
  HELP_CENTER_SECTIONS,
  type HelpCenterCategoryId,
  type HelpCenterSection,
} from "@/lib/guide/help-center-sections"
import type { GuideReferenceBlock } from "@/lib/guide/guide-reference"
import { cn } from "@/lib/utils"
import { Lightbulb } from "lucide-react"

function linesFromTranslation(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function BlockView({ block, text }: { block: GuideReferenceBlock; text: string }) {
  if (block.type === "lead") {
    return <p className="text-sm font-medium text-foreground">{text}</p>
  }
  if (block.type === "body" || block.type === "tip") {
    return <p className="text-sm">{text}</p>
  }
  const lines = linesFromTranslation(text)
  const isBullets = block.type === "bullets"
  if (lines.length <= 1) {
    return <p className="text-sm">{text}</p>
  }
  return (
    <ul className={isBullets ? "list-disc space-y-1.5 pl-5" : "list-decimal space-y-1.5 pl-5"}>
      {lines.map((line) => {
        const cleaned = line.replace(/^[-•]\s*/, "").replace(/^\d+\.\s*/, "")
        return (
          <li key={line} className="text-sm">
            {cleaned}
          </li>
        )
      })}
    </ul>
  )
}

type GuideReferencePanelProps = {
  searchPlaceholder: string
  labelBullets: string
  labelSteps: string
  labelTip: string
  t: (key: string) => string
  bookingPath: string
}

export function GuideReferencePanel({
  searchPlaceholder,
  labelBullets,
  labelSteps,
  labelTip,
  t,
  bookingPath,
}: GuideReferencePanelProps) {
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState<HelpCenterCategoryId | "all">("all")

  const normalizedQuery = query.trim().toLowerCase()

  const filtered = React.useMemo(() => {
    return HELP_CENTER_SECTIONS.filter((section) => {
      if (category !== "all" && section.category !== category) return false
      if (!normalizedQuery) return true
      const title = t(section.titleKey).toLowerCase()
      if (title.includes(normalizedQuery)) return true
      if (section.searchTags.some((tag) => tag.includes(normalizedQuery))) return true
      for (const block of section.blocks) {
        if (t(block.key).toLowerCase().includes(normalizedQuery)) return true
      }
      return false
    })
  }, [category, normalizedQuery, t])

  const resolveHref = (section: HelpCenterSection) => {
    if (section.id === "booking-public-flow") return bookingPath
    return section.href ?? bookingPath
  }

  const grouped = React.useMemo(() => {
    const map = new Map<HelpCenterCategoryId, HelpCenterSection[]>()
    for (const cat of HELP_CENTER_CATEGORIES) {
      map.set(cat.id, [])
    }
    for (const section of filtered) {
      const list = map.get(section.category) ?? []
      list.push(section)
      map.set(section.category, list)
    }
    return map
  }, [filtered])

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {t("guide.sectionFullReference")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("guide.sectionFullReferenceHint")}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="max-w-md rounded-xl"
          aria-label={searchPlaceholder}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              category === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40",
            )}
          >
            {t("guide.catAll")}
          </button>
          {HELP_CENTER_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                category === cat.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/40",
              )}
            >
              {t(cat.titleKey)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("guide.moduleSearchEmpty")}</p>
      ) : category === "all" ? (
        <div className="space-y-8">
          {HELP_CENTER_CATEGORIES.map((cat) => {
            const sections = grouped.get(cat.id) ?? []
            if (sections.length === 0) return null
            return (
              <div key={cat.id} className="space-y-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">{t(cat.titleKey)}</h3>
                  <p className="text-xs text-muted-foreground">{t(cat.descriptionKey)}</p>
                </div>
                <SectionList
                  sections={sections}
                  t={t}
                  labelBullets={labelBullets}
                  labelSteps={labelSteps}
                  labelTip={labelTip}
                  resolveHref={resolveHref}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <SectionList
          sections={filtered}
          t={t}
          labelBullets={labelBullets}
          labelSteps={labelSteps}
          labelTip={labelTip}
          resolveHref={resolveHref}
        />
      )}
    </section>
  )
}

function SectionList({
  sections,
  t,
  labelBullets,
  labelSteps,
  labelTip,
  resolveHref,
}: {
  sections: HelpCenterSection[]
  t: (key: string) => string
  labelBullets: string
  labelSteps: string
  labelTip: string
  resolveHref: (section: HelpCenterSection) => string
}) {
  return (
    <div className="grid gap-3">
      {sections.map((section) => {
        const href = resolveHref(section)
        return (
          <GuideExpandable key={section.id} title={t(section.titleKey)} id={`guide-ref-${section.id}`}>
            <div className="space-y-3">
              {section.blocks.map((block) => {
                const text = t(block.key)
                if (block.type === "tip") {
                  return (
                    <GuideTip key={block.key} icon={<Lightbulb className="size-4" />} title={labelTip}>
                      <BlockView block={block} text={text} />
                    </GuideTip>
                  )
                }
                const label =
                  block.type === "bullets"
                    ? labelBullets
                    : block.type === "steps"
                      ? labelSteps
                      : null
                return (
                  <div key={block.key} className="space-y-1.5">
                    {label ? (
                      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                        {label}
                      </p>
                    ) : null}
                    <BlockView block={block} text={text} />
                  </div>
                )
              })}
              {section.ctaKey && href ? (
                <Button asChild variant="outline" size="sm" className="h-9 rounded-xl">
                  <Link href={href}>{t(section.ctaKey)}</Link>
                </Button>
              ) : null}
            </div>
          </GuideExpandable>
        )
      })}
    </div>
  )
}
