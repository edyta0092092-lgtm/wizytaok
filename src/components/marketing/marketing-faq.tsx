"use client"

import * as React from "react"

import { useTranslations } from "@/lib/i18n/use-translations"

const FAQ_KEYS: ReadonlyArray<{ q: string; a: string }> = [
  { q: "marketing.faqQ1", a: "marketing.faqA1" },
  { q: "marketing.faqQ2", a: "marketing.faqA2" },
  { q: "marketing.faqQ3", a: "marketing.faqA3" },
  { q: "marketing.faqQ4", a: "marketing.faqA4" },
  { q: "marketing.faqQ5", a: "marketing.faqA5" },
  { q: "marketing.faqQ6", a: "marketing.faqA6" },
]

type MarketingFaqVariant = "home" | "pricing"

export function MarketingFaq({ variant = "home" }: { variant?: MarketingFaqVariant }) {
  const { t } = useTranslations()

  const sectionClass =
    variant === "home"
      ? "mx-auto max-w-6xl px-6 py-14"
      : "mx-auto mt-10 max-w-3xl px-3 sm:px-4"

  return (
    <section className={sectionClass} aria-labelledby="marketing-faq-heading">
      <h2 id="marketing-faq-heading" className="text-2xl font-semibold text-foreground">
        {t("marketing.faqTitle")}
      </h2>
      <div className="mt-6 space-y-3">
        {FAQ_KEYS.map(({ q, a }) => (
          <details
            key={q}
            className="group rounded-2xl border border-border bg-card px-4 py-3 shadow-sm"
          >
            <summary className="cursor-pointer list-none font-medium text-foreground">
              <span className="flex items-start justify-between gap-3">
                <span>{t(q as "marketing.faqQ1")}</span>
                <span
                  className="mt-0.5 shrink-0 text-muted-foreground transition group-open:rotate-45"
                  aria-hidden
                >
                  +
                </span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(a as "marketing.faqA1")}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
