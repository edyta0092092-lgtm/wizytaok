"use client"

import * as React from "react"
import Link from "next/link"
import { Moon, Sun } from "lucide-react"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n/use-translations"
import { marketingSignupHref } from "@/lib/marketing/signup-href"
import { cn } from "@/lib/utils"

function Section({
  id,
  className,
  children,
}: {
  id?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 px-4 py-16 sm:py-20 md:py-24", className)}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  )
}

export function LandingView() {
  const { t, language, setLanguage, theme, setTheme } = useTranslations()

  const scrollToFeatures = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Logo href="/" />
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <Button variant="ghost" size="sm" className="h-9 text-xs" asChild>
              <Link href="/">{t("landing.navHome")}</Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-9 text-xs" asChild>
              <Link href="/login">{t("landing.navLogin")}</Link>
            </Button>
            <div className="flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5">
              <button
                type="button"
                className={cn(
                  "rounded-md px-2 py-1 text-[0.65rem] font-medium uppercase",
                  language === "pl" ? "bg-card shadow-sm" : "text-muted-foreground"
                )}
                onClick={() => setLanguage("pl")}
              >
                PL
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-2 py-1 text-[0.65rem] font-medium uppercase",
                  language === "en" ? "bg-card shadow-sm" : "text-muted-foreground"
                )}
                onClick={() => setLanguage("en")}
              >
                EN
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button size="sm" className="h-9 px-3 text-xs font-semibold sm:text-sm" asChild>
              <Link href={marketingSignupHref()}>{t("landing.ctaPrimary")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <Section className="relative overflow-hidden bg-gradient-to-b from-primary/[0.07] via-background to-background pb-12 pt-10 sm:pb-16 md:pt-14">
        <div className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full bg-primary/[0.12] blur-3xl dark:bg-primary/20" aria-hidden />
        <div className="relative grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10">
          <div className="space-y-8">
            <div className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              WizytaOK
            </div>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-[2.35rem] md:leading-tight">
              {t("landing.heroTitle")}
            </h1>
            <p className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("landing.heroSubtitle")}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button size="lg" className="h-12 w-full rounded-xl px-6 text-base font-semibold sm:w-auto sm:min-w-[220px]" asChild>
                <Link href={marketingSignupHref()}>{t("landing.ctaPrimary")}</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 w-full rounded-xl border-primary/25 bg-background/80 px-6 text-base font-medium sm:w-auto"
                asChild
              >
                <a href="#features" onClick={scrollToFeatures}>
                  {t("landing.ctaSecondary")}
                </a>
              </Button>
            </div>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">{t("landing.trustLine")}</p>
          </div>

          <div className="relative">
            <div className="rounded-3xl border border-border/70 bg-card/90 p-4 shadow-xl shadow-slate-900/10 ring-1 ring-primary/10 dark:bg-card/70 dark:shadow-black/40 dark:ring-primary/15">
              <div className="mb-4 flex flex-wrap gap-2 border-b border-border/60 pb-3">
                <span className="rounded-lg bg-[color:var(--nav-active-bg)] px-3 py-1.5 text-xs font-semibold text-primary">
                  {t("landing.mockNavDay")}
                </span>
                <span className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {t("landing.mockNavAppts")}
                </span>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[0.65rem] font-medium text-muted-foreground">
                  {t("landing.mockStatTodo")}
                </span>
                <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[0.65rem] font-medium text-[color:rgb(21_128_61)] dark:text-success">
                  {t("landing.mockStatConfirmed")}
                </span>
                <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[0.65rem] font-medium text-amber-900 dark:text-amber-100">
                  {t("landing.mockStatNeeds")}
                </span>
              </div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("landing.mockListTitle")}
              </p>
              <ul className="space-y-2">
                {[
                  ["10:00", "Anna K.", t("landing.mockStatConfirmed")],
                  ["11:30", "Piotr N.", t("landing.mockStatTodo")],
                  ["14:00", "Magda W.", t("landing.mockStatNeeds")],
                ].map(([time, name, badge]) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 dark:bg-muted/15"
                  >
                    <div>
                      <p className="text-xs font-medium tabular-nums text-foreground">{time}</p>
                      <p className="text-xs text-muted-foreground">{name}</p>
                    </div>
                    <span className="max-w-[10rem] truncate rounded-full border border-border bg-card px-2 py-0.5 text-[0.65rem]">
                      {badge}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      <Section className="bg-muted/25 dark:bg-muted/10">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t("landing.problemTitle")}
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">{t("landing.problemLead")}</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[t("landing.problem1"), t("landing.problem2"), t("landing.problem3"), t("landing.problem4")].map(
            (label) => (
              <div
                key={label}
                className="rounded-2xl border border-border/70 bg-card/80 p-5 text-center shadow-sm dark:bg-card/60"
              >
                <p className="text-sm font-medium leading-snug text-foreground">{label}</p>
              </div>
            )
          )}
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t("landing.solutionTitle")}
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">{t("landing.solutionLead")}</p>
        </div>
        <ol className="mx-auto mt-12 max-w-2xl space-y-4">
          {[
            t("landing.solutionStep1"),
            t("landing.solutionStep2"),
            t("landing.solutionStep3"),
            t("landing.solutionStep4"),
            t("landing.solutionStep5"),
          ].map((step, i) => (
            <li key={step} className="flex gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4 dark:bg-muted/10">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <p className="pt-1 text-sm leading-relaxed text-foreground sm:text-base">{step}</p>
            </li>
          ))}
        </ol>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
          {t("landing.solutionReminderNote")}
        </p>
      </Section>

      <Section id="features" className="bg-muted/25 dark:bg-muted/10">
        <h2 className="mx-auto max-w-3xl text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("landing.featuresTitle")}
        </h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["feature1Title", "feature1Desc"],
              ["feature2Title", "feature2Desc"],
              ["feature3Title", "feature3Desc"],
              ["feature4Title", "feature4Desc"],
              ["feature5Title", "feature5Desc"],
              ["feature6Title", "feature6Desc"],
              ["feature7Title", "feature7Desc"],
              ["feature8Title", "feature8Desc"],
            ] as const
          ).map(([tk, dk]) => (
            <div
              key={tk}
              className="rounded-2xl border border-border/70 bg-card/90 p-6 shadow-sm transition-colors hover:border-primary/25 dark:bg-card/70"
            >
              <h3 className="font-semibold text-foreground">{t(`landing.${tk}`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`landing.${dk}`)}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t("landing.audienceTitle")}
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">{t("landing.audienceLead")}</p>
        </div>
        <ul className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-2">
          {[
            t("landing.audience1"),
            t("landing.audience2"),
            t("landing.audience3"),
            t("landing.audience4"),
            t("landing.audience5"),
            t("landing.audience6"),
            t("landing.audience7"),
            t("landing.audience8"),
          ].map((label) => (
            <li
              key={label}
              className="rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-foreground dark:bg-primary/10"
            >
              {label}
            </li>
          ))}
        </ul>
      </Section>

      <Section className="bg-muted/25 dark:bg-muted/10">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("landing.benefitsTitle")}
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[t("landing.benefit1"), t("landing.benefit2"), t("landing.benefit3"), t("landing.benefit4"), t("landing.benefit5"), t("landing.benefit6")].map(
            (b) => (
              <div
                key={b}
                className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/80 p-5 dark:bg-card/60"
              >
                <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  ✓
                </span>
                <p className="text-sm font-medium leading-snug text-foreground">{b}</p>
              </div>
            )
          )}
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t("landing.statusesTitle")}
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">{t("landing.statusesLead")}</p>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {[
            t("landing.stBooked"),
            t("landing.stToConfirm"),
            t("landing.stConfirmed"),
            t("landing.stChangeReq"),
            t("landing.stBizChange"),
            t("landing.stCancelled"),
            t("landing.stNoShow"),
          ].map((s) => (
            <span
              key={s}
              className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground dark:bg-muted/20"
            >
              {s}
            </span>
          ))}
        </div>
      </Section>

      <Section className="border-y border-primary/15 bg-gradient-to-b from-primary/[0.06] to-background dark:from-primary/10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t("landing.trialTitle")}
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">{t("landing.trialLead")}</p>
          <p className="mt-3 text-sm text-muted-foreground">{t("landing.trialNoCard")}</p>
          <Button size="lg" className="mt-8 h-12 rounded-xl px-8 text-base font-semibold" asChild>
            <Link href={marketingSignupHref()}>{t("landing.ctaPrimary")}</Link>
          </Button>
        </div>
      </Section>

      <Section className="bg-muted/25 dark:bg-muted/10">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("landing.faqHeading")}
        </h2>
        <div className="mx-auto mt-10 grid max-w-3xl gap-3">
          {(
            [
              ["faq1Q", "faq1A"],
              ["faq2Q", "faq2A"],
              ["faq3Q", "faq3A"],
              ["faq4Q", "faq4A"],
              ["faq5Q", "faq5A"],
              ["faq6Q", "faq6A"],
            ] as const
          ).map(([qk, ak]) => (
            <details
              key={qk}
              className="group rounded-2xl border border-border/60 bg-card/90 p-4 dark:bg-card/70"
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                {t(`landing.${qk}`)}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`landing.${ak}`)}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-2xl rounded-3xl border border-primary/20 bg-primary/[0.06] px-6 py-12 text-center dark:bg-primary/10">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{t("landing.finalTitle")}</h2>
          <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">{t("landing.finalLead")}</p>
          <Button size="lg" className="mt-8 h-12 rounded-xl px-8 text-base font-semibold" asChild>
            <Link href={marketingSignupHref()}>{t("landing.ctaPrimary")}</Link>
          </Button>
        </div>
      </Section>

      <footer className="border-t border-border/80 bg-muted/30 px-4 py-12 dark:bg-muted/15">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Logo href="/" />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{t("landing.footerLine")}</p>
          </div>
          <nav className="flex flex-col gap-2 text-sm sm:items-end">
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">
              {t("landing.footerTerms")}
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">
              {t("landing.footerPrivacy")}
            </Link>
            <Link href="/developer-contact" className="text-muted-foreground hover:text-foreground">
              {t("landing.footerContact")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
