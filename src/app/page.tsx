"use client"

import Link from "next/link"
import { CalendarCheck, MessageCircle, ShieldCheck } from "lucide-react"

import { MarketingFaq } from "@/components/marketing/marketing-faq"
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
              href="/start-trial"
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
            <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {t("marketing.heroAudience")}
            </span>
            <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
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
                href="/start-trial"
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

      <div className="border-b border-border/90 bg-muted/20">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <p
            role="status"
            className="text-center text-sm leading-relaxed text-muted-foreground sm:text-left"
          >
            {t("marketing.homeBetaNotice")}
          </p>
        </div>
      </div>

      <section className="border-y border-border/90 bg-muted/25">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-2xl font-semibold">{t("marketing.whoForTitle")}</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {(
              [
                "marketing.whoForBullet1",
                "marketing.whoForBullet2",
                "marketing.whoForBullet3",
                "marketing.whoForBullet4",
                "marketing.whoForBullet5",
                "marketing.whoForBullet6",
                "marketing.whoForBullet7",
                "marketing.whoForBullet8",
              ] as const
            ).map((key) => (
              <li
                key={key}
                className="flex gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-relaxed"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="text-2xl font-semibold">{t("marketing.gainsTitle")}</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {(
            [
              "marketing.gainBullet1",
              "marketing.gainBullet2",
              "marketing.gainBullet3",
              "marketing.gainBullet4",
              "marketing.gainBullet5",
              "marketing.gainBullet6",
              "marketing.gainBullet7",
            ] as const
          ).map((key) => (
            <li
              key={key}
              className="flex gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm leading-relaxed"
            >
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
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
          <Step number="4" title={t("marketing.step4Title")} text={t("marketing.step4Text")} />
          <Step number="5" title={t("marketing.step5Title")} text={t("marketing.step5Text")} />
        </div>
      </section>

      <MarketingFaq variant="home" />

      <section className="border-y border-border/90 bg-primary/10">
        <div className="mx-auto max-w-6xl px-6 py-14 text-center">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
            {t("marketing.ctaPilotTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("marketing.ctaHelper")}
          </p>
          <Link
            href="/start-trial"
            className="mt-8 inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-hover)]"
          >
            {t("marketing.ctaTryFree")}
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/90 bg-card/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-foreground">{BRAND.name}</p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/pricing" className="hover:text-foreground">
              {t("marketing.navPricing")}
            </Link>
            <Link href="/login" className="hover:text-foreground">
              {t("marketing.navLogin")}
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              {t("marketing.footerTerms")}
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              {t("marketing.footerPrivacy")}
            </Link>
          </nav>
        </div>
      </footer>
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
  const detail = text.trim()
  return (
    <div className="flex gap-4 border-b border-border p-5 last:border-b-0">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-sm font-medium">
        {number}
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        {detail ? (
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </div>
  )
}
