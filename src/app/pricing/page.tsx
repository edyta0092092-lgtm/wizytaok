"use client"

import Link from "next/link"
import { Check } from "lucide-react"

import { Logo } from "@/components/brand/logo"
import { MarketingFaq } from "@/components/marketing/marketing-faq"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useTranslations } from "@/lib/i18n/use-translations"

const PRICING_FEATURE_KEYS = [
  "marketing.pricingFeatureReminders",
  "marketing.pricingFeatureConfirm",
  "marketing.pricingFeatureOnlineBooking",
  "marketing.pricingFeatureAppointments",
  "marketing.pricingFeatureAvailability",
  "marketing.pricingFeatureTeam",
  "marketing.pricingFeatureTemplates",
  "marketing.pricingFeatureSupport",
] as const

const PRICING_TRIAL_KEYS = [
  "marketing.pricingTrialNoCard",
  "marketing.pricingTrialSetup",
  "marketing.pricingTrialGoLive",
] as const

export default function PricingPage() {
  const { t } = useTranslations()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-11 max-w-[1180px] items-center justify-between px-3 sm:px-4">
          <Logo />
          <div className="flex max-w-[min(100%,14rem)] flex-wrap items-center justify-end gap-1.5 sm:max-w-none sm:gap-2">
            <Button variant="ghost" size="sm" className="h-8 shrink-0 text-xs" asChild>
              <Link href="/login">{t("marketing.navLogin")}</Link>
            </Button>
            <Button size="sm" className="h-auto min-h-8 shrink px-2 text-center text-[11px] leading-tight sm:h-8 sm:px-3 sm:text-xs" asChild>
              <Link href="/signup">{t("marketing.ctaTryFree")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-3 py-8 sm:px-4 sm:py-10">
        <div className="mx-auto max-w-[1180px] text-left sm:text-center">
          <div className="inline-flex flex-col items-start gap-2 sm:items-center">
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {t("marketing.freeDaysBadge")}
            </span>
            <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-[1.65rem]">
              {t("marketing.pricingTitle")}
            </h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t("marketing.pricingLead")}</p>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
            {t("marketing.ctaHelper")}
          </p>
        </div>

        <div className="mx-auto mt-6 grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <Card className="border-border shadow-none sm:mx-auto">
            <CardHeader className="space-y-1 pb-2 text-left sm:text-left">
              <CardTitle className="text-lg font-medium">{t("marketing.pricingPlanName")}</CardTitle>
              <CardDescription className="text-sm">{t("marketing.pricingPlanDescription")}</CardDescription>
              <p className="pt-3 text-3xl font-medium tabular-nums text-foreground">
                {t("marketing.pricingPlanPrice")}
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  {t("marketing.pricingPerMonth")}
                </span>
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("marketing.pricingIncludesTitle")}
              </p>
              <ul className="space-y-2 text-left text-sm text-muted-foreground">
                {PRICING_FEATURE_KEYS.map((key) => (
                  <li key={key} className="flex gap-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    <span className="leading-relaxed text-foreground">{t(key)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 border-t border-border/60 bg-muted/20 py-4 sm:flex-row">
              <Button className="h-auto min-h-9 w-full whitespace-normal rounded-lg px-3 py-2 text-center text-sm leading-snug sm:flex-1" asChild>
                <Link href="/signup">{t("marketing.ctaTryFree")}</Link>
              </Button>
              <Button
                variant="outline"
                className="h-9 w-full rounded-lg sm:flex-1"
                asChild
              >
                <Link href="/dashboard">{t("marketing.ctaDashboard")}</Link>
              </Button>
            </CardFooter>
          </Card>

          <div className="space-y-4">
            <Card className="border-border shadow-none">
              <CardHeader className="pb-2 text-left">
                <CardTitle className="text-base font-medium">
                  {t("marketing.pricingTrialTitle")}
                </CardTitle>
                <CardDescription>{t("marketing.pricingTrialLead")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-foreground">
                  {PRICING_TRIAL_KEYS.map((key) => (
                    <li key={key} className="flex gap-3">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      <span>{t(key)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border shadow-none">
              <CardHeader className="pb-2 text-left">
                <CardTitle className="text-base font-medium">
                  {t("marketing.pricingWhoTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("marketing.pricingWhoLead")}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <MarketingFaq variant="pricing" />
      </main>
    </div>
  )
}
