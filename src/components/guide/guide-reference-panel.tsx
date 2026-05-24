"use client"

import * as React from "react"
import Link from "next/link"

import { GuideExpandable } from "@/components/guide/guide-expandable"
import { GuideTip } from "@/components/guide/guide-tip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GUIDE_REFERENCE_SECTIONS } from "@/lib/guide/guide-reference"
import type { GuideReferenceBlock } from "@/lib/guide/guide-reference"
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

  const normalizedQuery = query.trim().toLowerCase()

  const filtered = React.useMemo(() => {
    if (!normalizedQuery) return GUIDE_REFERENCE_SECTIONS
    return GUIDE_REFERENCE_SECTIONS.filter((section) => {
      const title = t(section.titleKey).toLowerCase()
      if (title.includes(normalizedQuery)) return true
      if (section.searchTags.some((tag) => tag.includes(normalizedQuery))) return true
      for (const block of section.blocks) {
        if (t(block.key).toLowerCase().includes(normalizedQuery)) return true
      }
      return false
    })
  }, [normalizedQuery, t])

  const resolveHref = (href?: string) => {
    if (!href) return bookingPath
    if (href === bookingPath || href.startsWith("/rezerwacje/")) return bookingPath
    return href
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {t("guide.sectionFullReference")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("guide.sectionFullReferenceHint")}</p>
      </div>
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        className="max-w-md rounded-xl"
        aria-label={searchPlaceholder}
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("guide.moduleSearchEmpty")}</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((section) => {
            const href = section.id === "booking" ? bookingPath : resolveHref(section.href)
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
      )}
    </section>
  )
}
