"use client"

import * as React from "react"
import Link from "next/link"
import { Building2, CalendarClock, CalendarDays, ClipboardList, Link2, type LucideIcon, Users } from "lucide-react"

import { GuideFinalChecklist } from "@/components/guide/guide-final-checklist"
import { GuideHero } from "@/components/guide/guide-hero"
import { GuideQuickStartCard } from "@/components/guide/guide-quick-start-card"
import { GuideSetupProgress } from "@/components/guide/guide-setup-progress"
import { GuideTip } from "@/components/guide/guide-tip"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchGuideSetupAutoProgress, type GuideSetupStepId } from "@/lib/guide/fetch-guide-setup"
import {
  GUIDE_SETUP_MANUAL_KEY,
  parseGuideSetupManual,
  writeGuideSetupManual,
  type GuideSetupManual,
} from "@/lib/guide/guide-setup-storage"
import { useTranslations } from "@/lib/i18n/use-translations"
import { useTour } from "@/lib/tour/tour-context"
import type { ChecklistStatus } from "@/lib/tour/tour-storage"
import { parseChecklistProgress, TOUR_KEYS } from "@/lib/tour/tour-storage"
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
    href: "/appointments",
    titleKey: "guide.qs5Title",
    descriptionKey: "guide.qs5Desc",
    whereKey: "guide.qs5Where",
    actionKey: "guide.navCalendar",
    icon: Link2,
  },
  {
    id: "qs6",
    href: "/settings",
    titleKey: "guide.qs6Title",
    descriptionKey: "guide.qs6Desc",
    whereKey: "guide.qs6Where",
    actionKey: "guide.navBooking",
    icon: CalendarDays,
  },
]

function statusLabel(status: ChecklistStatus, tl: (k: string) => string) {
  if (status === "todo") return tl("guide.statusTodo")
  if (status === "progress") return tl("guide.statusProgress")
  return tl("guide.statusDone")
}

function badgeClass(status: ChecklistStatus) {
  if (status === "todo") {
    return "border-border/70 bg-muted/50 text-muted-foreground"
  }
  if (status === "progress") {
    return "border-primary/35 bg-[color:var(--nav-active-bg)] text-primary"
  }
  return "border-success/40 bg-success/10 text-[color:rgb(21_128_61)] dark:text-success"
}

function labelsForAria(labels: Record<GuideSetupStepId, string>, id: GuideSetupStepId): string {
  return labels[id]
}

export default function GuidePage() {
  const { t } = useTranslations()
  const { startTour } = useTour()

  const [bookingSlug, setBookingSlug] = React.useState("")
  const [supabaseUserReady, setSupabaseUserReady] = React.useState(() => !isSupabaseConfigured())

  const [setupAuto, setSetupAuto] = React.useState<Awaited<
    ReturnType<typeof fetchGuideSetupAutoProgress>
  > | null>(null)
  const [manualSetup, setManualSetup] = React.useState<GuideSetupManual>({})

  const [progress, setProgress] = React.useState<Record<string, ChecklistStatus>>(() => ({}))

  React.useEffect(() => {
    if (!isSupabaseConfigured()) return
    const client = getBrowserClient()
    if (!client) {
      queueMicrotask(() => setSupabaseUserReady(true))
      return
    }
    void client.auth.getUser().then(({ data: { user } }) => {
      if (!user?.id) {
        queueMicrotask(() => setSupabaseUserReady(true))
        return
      }
      void fetchGuideSetupAutoProgress(client, user.id).then((r) => {
        queueMicrotask(() => {
          setSetupAuto(r)
          setSupabaseUserReady(true)
        })
      })
      void client
        .from("business_profiles")
        .select("slug")
        .eq("owner_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (typeof data?.slug === "string" && data.slug.trim()) {
            queueMicrotask(() => setBookingSlug(data.slug.trim()))
          }
        })
    })
  }, [])

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TOUR_KEYS.checklist)
      const parsed = parseChecklistProgress(raw)
      queueMicrotask(() => setProgress(parsed))
    } catch {
      /* ignore */
    }
  }, [])

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(GUIDE_SETUP_MANUAL_KEY)
      queueMicrotask(() => setManualSetup(parseGuideSetupManual(raw)))
    } catch {
      /* ignore */
    }
  }, [])

  const persistProgress = React.useCallback(
    (updater: (prev: Record<string, ChecklistStatus>) => Record<string, ChecklistStatus>) => {
      setProgress((prev) => {
        const next = updater(prev)
        try {
          window.localStorage.setItem(TOUR_KEYS.checklist, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    },
    []
  )

  const cycleStatus = React.useCallback(
    (id: string) => {
      persistProgress((prev) => {
        const cur = prev[id] ?? "todo"
        const nextLevel: Record<ChecklistStatus, ChecklistStatus> = {
          todo: "progress",
          progress: "done",
          done: "todo",
        }
        return { ...prev, [id]: nextLevel[cur] }
      })
    },
    [persistProgress]
  )

  const markVisited = React.useCallback(
    (id: string) => {
      persistProgress((prev) => {
        const cur = prev[id]
        if (cur === "done") return prev
        const nextStatus: ChecklistStatus = cur === "todo" ? "progress" : cur ?? "progress"
        return { ...prev, [id]: nextStatus }
      })
    },
    [persistProgress]
  )

  const setManualSetupOverride = React.useCallback((id: GuideSetupStepId, value: boolean | null) => {
    setManualSetup((prev) => {
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

  const bookingPath = bookingSlug ? `/book/${bookingSlug}` : "/settings"

  const quickRowsResolved = React.useMemo(() => {
    return quickRows.map((row) => {
      if (row.id === "qs6" && bookingSlug) {
        return { ...row, href: bookingPath }
      }
      return row
    })
  }, [bookingPath, bookingSlug])

  const auto = setupAuto?.auto ?? null
  const safeAuto = auto ?? {
    business: false,
    services: false,
    availability: false,
    team: false,
    public_page: false,
    test_booking: false,
  }

  const setupLabels: Record<GuideSetupStepId, string> = {
    business: t("guide.setupStepBusiness"),
    services: t("guide.setupStepServices"),
    availability: t("guide.setupStepAvailability"),
    team: t("guide.setupStepTeam"),
    public_page: t("guide.setupStepPublic"),
    test_booking: t("guide.setupStepTest"),
  }

  const hrefForSetupStep = React.useCallback(
    (id: GuideSetupStepId) => {
      switch (id) {
        case "business":
          return "/settings"
        case "public_page":
          return bookingSlug ? bookingPath : "/settings"
        case "services":
          return "/services"
        case "availability":
          return "/availability"
        case "team":
          return "/team"
        case "test_booking":
          return "/appointments"
        default:
          return "/settings"
      }
    },
    [bookingPath, bookingSlug]
  )

  const faqKeys = [
    { q: "guide.faqQ1", a: "guide.faqA1" },
    { q: "guide.faqQ2", a: "guide.faqA2" },
    { q: "guide.faqQ3", a: "guide.faqA3" },
    { q: "guide.faqQ4", a: "guide.faqA4" },
    { q: "guide.faqQ5", a: "guide.faqA5" },
    { q: "guide.faqQ6", a: "guide.faqA6" },
  ] as const

  const playbook = [
    {
      id: "pb1",
      title: t("guide.modBusinessTitle"),
      body: t("guide.modBusinessLead"),
      href: "/settings",
      cta: t("guide.navSettings"),
    },
    {
      id: "pb2",
      title: t("guide.modServicesTitle"),
      body: t("guide.modServicesLead"),
      href: "/services",
      cta: t("guide.navServices"),
    },
    {
      id: "pb3",
      title: t("guide.modAvailTitle"),
      body: t("guide.modAvailLead"),
      href: "/availability",
      cta: t("guide.navAvailability"),
    },
    {
      id: "pb4",
      title: t("guide.modTeamTitle"),
      body: t("guide.modTeamLead"),
      href: "/team",
      cta: t("guide.navTeam"),
    },
    {
      id: "pb5",
      title: t("guide.modBookingTitle"),
      body: t("guide.modBookingLead"),
      href: bookingPath,
      cta: t("guide.navBooking"),
    },
    {
      id: "pb6",
      title: t("guide.modMsgsTitle"),
      body: t("guide.modMsgsLead"),
      href: "/messages",
      cta: t("guide.navMessages"),
    },
  ]

  const whatsNextItems = ([1, 2, 3, 4] as const).map((n) => ({
    id: `chk${n}`,
    label: t(`guide.chk${n}` as "guide.chk1"),
  }))

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

          {supabaseUserReady ? (
            <GuideSetupProgress
              title={t("guide.sectionSetupProgress")}
              hint={t("guide.setupProgressHint")}
              labels={setupLabels}
              auto={safeAuto}
              manual={manualSetup}
              hrefForStep={hrefForSetupStep}
              onSetManualOverride={setManualSetupOverride}
              statusDetectedAutoLabel={t("guide.detectedAutomatically")}
              statusMarkedManualLabel={t("guide.markedManually")}
              statusUncheckedManualLabel={t("guide.uncheckedManually")}
              statusNotCompletedLabel={t("guide.notCompleted")}
              markDoneLabel={t("guide.markStepDone")}
              undoLabel={t("guide.undoMarkedStep")}
              useAutomaticStatusLabel={t("guide.useAutomaticStatus")}
              stepAriaLabel={(id, checked) =>
                `${labelsForAria(setupLabels, id)} - ${checked ? t("guide.undoMarkedStep") : t("guide.markStepDone")}`
              }
              stepNoteForStep={(id) =>
                id === "public_page" && !bookingSlug ? t("guide.bookingAddressInSettings") : null
              }
              goLabel={t("guide.setupGo")}
              percentLabel={(n) => t("guide.setupPercent").replace("{n}", String(n))}
            />
          ) : (
            <div className="h-24 animate-pulse rounded-3xl bg-muted/40" aria-hidden />
          )}

          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                {t("guide.sectionQuickStart")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("guide.tipInteractiveChecklist")}</p>
            </div>
            <GuideTip icon={<ClipboardList className="size-4" />} title={t("guide.labelTip")}>
              {t("guide.tipInteractiveChecklist")}
            </GuideTip>
            <div className="grid gap-4 md:grid-cols-2">
              {quickRowsResolved.map((row, idx) => {
                const status = progress[row.id] ?? "todo"
                return (
                  <GuideQuickStartCard
                    key={row.id}
                    index={idx + 1}
                    title={t(row.titleKey)}
                    description={t(row.descriptionKey)}
                    whereToClick={t(row.whereKey)}
                    actionLabel={t(row.actionKey)}
                    href={row.href}
                    icon={row.icon}
                    statusLabel={statusLabel(status, t)}
                    statusClassName={badgeClass(status)}
                    onCycleStatus={() => cycleStatus(row.id)}
                    onShowMe={() => markVisited(row.id)}
                  />
                )
              })}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {t("guide.sectionCoreModules")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {playbook.map((item, idx) => (
                <Card key={item.id} className="rounded-2xl border border-border/70 bg-card/95 shadow-sm shadow-slate-900/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {idx + 1}. {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{item.body}</p>
                    <Button asChild className="h-9 w-full">
                      <Link href={item.href}>{item.cta}</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{t("guide.faqTitle")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {faqKeys.map((faq) => (
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
        </div>
      </PageShell>
    </AppShell>
  )
}
