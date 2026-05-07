"use client"

import Link from "next/link"
import { CalendarCheck, MessageCircle, ShieldCheck } from "lucide-react"

import { BRAND } from "@/config/brand"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function HomePage() {
  const { t } = useTranslations()

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/90 bg-card/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <CalendarCheck className="h-4 w-4" />
            </span>
            {BRAND.name}
          </Link>

          <nav className="flex flex-wrap items-center justify-end gap-2 text-sm sm:gap-4">
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
              {t("marketing.navPricing")}
            </Link>
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              {t("marketing.navLogin")}
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-primary px-3 py-2 text-center text-xs font-medium text-primary-foreground hover:bg-[var(--primary-hover)] sm:px-4 sm:text-sm"
            >
              {t("marketing.ctaTryFree")}
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <p className="inline-flex rounded-full border border-border bg-card px-3 py-1 text-sm text-primary">
              {t("marketing.heroAudience")}
            </p>
            <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {t("marketing.freeDaysBadge")}
            </span>
          </div>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            {BRAND.tagline}
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            {BRAND.description}
          </p>

          <div className="mt-8 flex flex-col gap-2">
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-semibold leading-snug text-primary-foreground hover:bg-[var(--primary-hover)]"
              >
                {t("marketing.ctaTryFree")}
              </Link>

              <Link
                href="/dashboard"
                className="rounded-xl border border-border bg-card px-5 py-3 text-center text-sm font-semibold leading-snug hover:bg-muted/60"
              >
                {t("marketing.ctaDashboard")}
              </Link>
            </div>
            <p className="max-w-xl text-sm text-muted-foreground">{t("marketing.ctaHelper")}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm shadow-slate-900/5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">{t("marketing.previewCardTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("marketing.previewCardSubtitle")}</p>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-primary">
              {t("marketing.previewToday")}
            </span>
          </div>

          <div className="space-y-3">
            {[
              ["previewTime100", "previewName1", "previewStatusConfirmed"],
              ["previewTime1130", "previewName2", "previewStatusPending"],
              ["previewTime1400", "previewName3", "previewStatusNeeds"],
            ].map(([timeKey, nameKey, statusKey]) => (
              <div
                key={timeKey}
                className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{t(`marketing.${timeKey}`)}</p>
                  <p className="text-sm text-muted-foreground">{t(`marketing.${nameKey}`)}</p>
                </div>

                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs">
                  {t(`marketing.${statusKey}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border/90 bg-card/70">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 py-10 md:grid-cols-3">
          <Feature
            icon={<MessageCircle className="h-5 w-5" />}
            title={t("marketing.featureRemindersTitle")}
            description={t("marketing.featureRemindersDesc")}
          />
          <Feature
            icon={<ShieldCheck className="h-5 w-5" />}
            title={t("marketing.featureStatusTitle")}
            description={t("marketing.featureStatusDesc")}
          />
          <Feature
            icon={<CalendarCheck className="h-5 w-5" />}
            title={t("marketing.featureEmptyTitle")}
            description={t("marketing.featureEmptyDesc")}
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="text-2xl font-semibold">{t("marketing.howItWorksTitle")}</h2>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <Step number="1" title={t("marketing.step1Title")} text={t("marketing.step1Text")} />
          <Step number="2" title={t("marketing.step2Title")} text={t("marketing.step2Text")} />
          <Step number="3" title={t("marketing.step3Title")} text={t("marketing.step3Text")} />
        </div>
      </section>
    </main>
  )
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/35 p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-primary">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function Step({
  number,
  title,
  text,
}: {
  number: string
  title: string
  text: string
}) {
  return (
    <div className="flex gap-4 border-b border-border p-5 last:border-b-0">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-sm font-medium">
        {number}
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}
