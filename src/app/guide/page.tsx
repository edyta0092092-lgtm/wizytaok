"use client"

import * as React from "react"
import Link from "next/link"
import {
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Link2,
  type LucideIcon,
  Users,
} from "lucide-react"

import { GuideFinalChecklist } from "@/components/guide/guide-final-checklist"
import { GuideHero } from "@/components/guide/guide-hero"
import { GuideQuickStartCard } from "@/components/guide/guide-quick-start-card"
import { GuideReferencePanel } from "@/components/guide/guide-reference-panel"
import { GuideSetupProgress } from "@/components/guide/guide-setup-progress"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import {
  fetchGuideSetupAutoProgress,
  GUIDE_SETUP_STEP_IDS,
  type GuideSetupAutoProgress,
  type GuideSetupStepId,
} from "@/lib/guide/fetch-guide-setup"
import { GUIDE_FAQ_KEYS, GUIDE_PLAYBOOK_MODULES } from "@/lib/guide/guide-reference"
import {
  parseGuideSetupManual,
  writeGuideSetupManual,
  type GuideSetupManual,
} from "@/lib/guide/guide-setup-storage"
import { useTranslations } from "@/lib/i18n/use-translations"
import { useTour } from "@/lib/tour/tour-context"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

type QuickRow = {
  id: string
  href: string
  titleKey: string
  descriptionKey: string
  whereKey: string
  actionKey: string
  icon: LucideIcon
}

const quickRows: QuickRow[] = [
  {
    id: "qs1",
    href: "/settings",
    titleKey: "guide.qs1Title",
    descriptionKey: "guide.qs1Desc",
    whereKey: "guide.qs1Where",
    actionKey: "guide.navSettings",
    icon: Building2,
  },
  {
    id: "qs2",
    href: "/services",
    titleKey: "guide.qs2Title",
    descriptionKey: "guide.qs2Desc",
    whereKey: "guide.qs2Where",
    actionKey: "guide.navServices",
    icon: ClipboardList,
  },
  {
    id: "qs3",
    href: "/availability",
    titleKey: "guide.qs3Title",
    descriptionKey: "guide.qs3Desc",
    whereKey: "guide.qs3Where",
    actionKey: "guide.navAvailability",
    icon: CalendarClock,
  },
  {
    id: "qs4",
    href: "/team",
    titleKey: "guide.qs4Title",
    descriptionKey: "guide.qs4Desc",
    whereKey: "guide.qs4Where",
    actionKey: "guide.navTeam",
    icon: Users,
  },
  {
    id: "qs5",
    href: "/schedule",
    titleKey: "guide.qs5Title",
    descriptionKey: "guide.qs5Desc",
    whereKey: "guide.qs5Where",
    actionKey: "guide.navCalendar",
    icon: CalendarRange,
  },
  {
    id: "qs6",
    href: "/appointments",
    titleKey: "guide.qs6Title",
    descriptionKey: "guide.qs6Desc",
    whereKey: "guide.qs6Where",
    actionKey: "guide.navAppointments",
    icon: CalendarDays,
  },
  {
    id: "qs7",
    href: "/settings",
    titleKey: "guide.qs7Title",
    descriptionKey: "guide.qs7Desc",
    whereKey: "guide.qs7Where",
    actionKey: "guide.navBooking",
    icon: Link2,
  },
]

const SETUP_HREF: Record<GuideSetupStepId, string> = {
  business: "/settings",
  services: "/services",
  availability: "/availability",
  team: "/team",
  public_page: "/settings",
  test_booking: "/settings",
}

export default function GuidePage() {
  const { t } = useTranslations()
  const { startTour } = useTour()
  const access = useBusinessAccess()

  const [bookingSlug, setBookingSlug] = React.useState("")
  const [setupAuto, setSetupAuto] = React.useState<GuideSetupAutoProgress>(() =>
    Object.fromEntries(GUIDE_SETUP_STEP_IDS.map((id) => [id, false])) as GuideSetupAutoProgress,
  )
  const [setupManual, setSetupManual] = React.useState<GuideSetupManual>({})

  React.useEffect(() => {
    queueMicrotask(() => setSetupManual(parseGuideSetupManual(window.localStorage.getItem("wizytaok-guide-setup-progress"))))
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (!isSupabaseConfigured()) return
        const client = getBrowserClient()
        if (!client) return

        if (access.businessId) {
          const { data } = await client
            .from("business_profiles")
            .select("slug")
            .eq("id", access.businessId)
            .maybeSingle()
          if (!cancelled && typeof data?.slug === "string" && data.slug.trim()) {
            setBookingSlug(data.slug.trim())
          }
        }

        const {
          data: { user },
        } = await client.auth.getUser()
        if (!user?.id) return
        const progress = await fetchGuideSetupAutoProgress(client, user.id)
        if (!cancelled) {
          setSetupAuto(progress.auto)
          if (progress.slug) setBookingSlug((prev) => prev || progress.slug || "")
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [access.businessId])

  const bookingPath = bookingSlug ? `/rezerwacje/${bookingSlug}` : "/settings"

  const quickRowsResolved = React.useMemo(() => {
    return quickRows.map((row) => {
      if (row.id === "qs7") return { ...row, href: bookingPath }
      return row
    })
  }, [bookingPath])

  const setupLabels = React.useMemo(
    () =>
      Object.fromEntries(
        GUIDE_SETUP_STEP_IDS.map((id) => [id, t(`guide.setupStep${id.charAt(0).toUpperCase()}${id.slice(1).replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}` as never)]),
      ) as Record<GuideSetupStepId, string>,
    [t],
  )

  const setupLabelsFixed = React.useMemo(
    (): Record<GuideSetupStepId, string> => ({
      business: t("guide.setupStepBusiness"),
      services: t("guide.setupStepServices"),
      availability: t("guide.setupStepAvailability"),
      team: t("guide.setupStepTeam"),
      public_page: t("guide.setupStepPublic"),
      test_booking: t("guide.setupStepTest"),
    }),
    [t],
  )

  const hrefForSetupStep = React.useCallback(
    (id: GuideSetupStepId) => {
      if (id === "public_page" || id === "test_booking") return bookingPath
      return SETUP_HREF[id]
    },
    [bookingPath],
  )

  const setManualOverride = React.useCallback((id: GuideSetupStepId, value: boolean | null) => {
    setSetupManual((prev) => {
      const next = { ...prev }
      if (value === null) {
        delete next[id]
      } else {
        next[id] = value
      }
      writeGuideSetupManual(next)
      return next
    })
  }, [])

  const playbookResolved = React.useMemo(() => {
    return GUIDE_PLAYBOOK_MODULES.map((item) => ({
      ...item,
      href: item.href === "booking" ? bookingPath : item.href,
      title: t(item.titleKey),
      body: t(item.leadKey),
      cta: t(item.ctaKey),
    }))
  }, [bookingPath, t])

  const whatsNextItems = React.useMemo(
    () => [
      { id: "chk1", label: t("guide.chk1") },
      { id: "chk2", label: t("guide.chk2") },
      { id: "chk3", label: t("guide.chk3") },
      { id: "chk4", label: t("guide.chk4") },
      { id: "chk5", label: t("guide.chk5") },
    ],
    [t],
  )

  return (
    <AppShell title={t("guide.title")} pageDescription={t("guide.description")}>
      <PageShell>
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 sm:gap-12 lg:gap-14">
          <GuideHero
            badge={t("guide.heroBadge")}
            title={t("guide.title")}
            description={t("guide.description")}
            subtitle={t("guide.heroSub")}
            startTourLabel={t("guide.introStart")}
            onStartTour={() => startTour(0)}
          />

          <GuideSetupProgress
            title={t("guide.sectionSetupProgress")}
            hint={t("guide.setupProgressHint")}
            labels={setupLabelsFixed}
            auto={setupAuto}
            manual={setupManual}
            hrefForStep={hrefForSetupStep}
            onSetManualOverride={setManualOverride}
            statusDetectedAutoLabel={t("guide.detectedAutomatically")}
            statusMarkedManualLabel={t("guide.markedManually")}
            statusUncheckedManualLabel={t("guide.uncheckedManually")}
            statusNotCompletedLabel={t("guide.notCompleted")}
            markDoneLabel={t("guide.markStepDone")}
            undoLabel={t("guide.undoMarkedStep")}
            useAutomaticStatusLabel={t("guide.useAutomaticStatus")}
            stepAriaLabel={(id, checked) =>
              checked ? t("guide.setupStepDoneAria").replace("{step}", setupLabelsFixed[id]) : setupLabelsFixed[id]
            }
            stepNoteForStep={() => null}
            goLabel={t("guide.setupGo")}
            percentLabel={(n) => t("guide.setupPercent").replace("{n}", String(n))}
          />

          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                {t("guide.sectionQuickStart")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("guide.tipInteractiveChecklist")}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {quickRowsResolved.map((row, idx) => (
                <GuideQuickStartCard
                  key={row.id}
                  index={idx + 1}
                  title={t(row.titleKey)}
                  description={t(row.descriptionKey)}
                  whereToClick={t(row.whereKey)}
                  actionLabel={t(row.actionKey)}
                  href={row.href}
                  icon={row.icon}
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {t("guide.sectionCoreModules")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {playbookResolved.map((item, idx) => (
                <Card
                  key={item.id}
                  className="flex h-full flex-col rounded-2xl border border-border/70 bg-card/95 shadow-sm shadow-slate-900/5"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {idx + 1}. {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3">
                    <p className="text-sm text-muted-foreground">{item.body}</p>
                    <Button asChild className="mt-auto h-9 w-full">
                      <Link href={item.href}>{item.cta}</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <GuideReferencePanel
            searchPlaceholder={t("guide.moduleSearchPlaceholder")}
            labelBullets={t("guide.labelBullets")}
            labelSteps={t("guide.labelSteps")}
            labelTip={t("guide.labelTip")}
            t={t}
            bookingPath={bookingPath}
          />

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{t("guide.faqTitle")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {GUIDE_FAQ_KEYS.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-2xl border border-border/60 bg-muted/20 p-4 dark:bg-muted/10"
                >
                  <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
                    <span>{t(faq.q)}</span>
                  </summary>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t(faq.a)}</p>
                </details>
              ))}
            </div>
          </section>

          <GuideFinalChecklist
            title={t("guide.sectionWhatsNext")}
            subtitle={t("guide.whatsNextSubtitle")}
            items={whatsNextItems}
          />

          <div className="flex justify-center pb-4">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => startTour(0)}>
              {t("guide.restartTour")}
            </Button>
          </div>
        </div>
      </PageShell>
    </AppShell>
  )
}
