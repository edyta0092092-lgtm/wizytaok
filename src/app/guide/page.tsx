"use client"

import * as React from "react"
import Link from "next/link"
import { Building2, CalendarClock, CalendarDays, ClipboardList, Link2, type LucideIcon, Search, Users } from "lucide-react"

import { GuideExpandable } from "@/components/guide/guide-expandable"
import { GuideFinalChecklist } from "@/components/guide/guide-final-checklist"
import { GuideHero } from "@/components/guide/guide-hero"
import { GuideQuickStartCard } from "@/components/guide/guide-quick-start-card"
import { GuideSetupProgress } from "@/components/guide/guide-setup-progress"
import { GuideTip } from "@/components/guide/guide-tip"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Input } from "@/components/ui/input"
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

function LabelledBlock({
  label,
  text,
}: {
  label: string
  text: string
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{text}</div>
    </div>
  )
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
  const [moduleQuery, setModuleQuery] = React.useState("")

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
    { q: "guide.faqQ7", a: "guide.faqA7" },
    { q: "guide.faqQ8", a: "guide.faqA8" },
    { q: "guide.faqQ9", a: "guide.faqA9" },
    { q: "guide.faqQ10", a: "guide.faqA10" },
    { q: "guide.faqQ11", a: "guide.faqA11" },
  ] as const

  const topicDefs = React.useMemo(
    () =>
      [
        { id: "t1", titleKey: "guide.modBusinessTitle" },
        { id: "t2", titleKey: "guide.modServicesTitle" },
        { id: "t3", titleKey: "guide.modAvailTitle" },
        { id: "t4", titleKey: "guide.modAvailExTitle" },
        { id: "t5", titleKey: "guide.modTeamTitle" },
        { id: "t6", titleKey: "guide.modBookingTitle" },
        { id: "t7", titleKey: "guide.modApptTitle" },
        { id: "t8", titleKey: "guide.modNeedsActionTitle" },
        { id: "t9", titleKey: "guide.modRemindersTitle" },
        { id: "t10", titleKey: "guide.modMsgsTitle" },
        { id: "t11", titleKey: "guide.modClientsTitle" },
        { id: "t12", titleKey: "guide.modSettingsGuideTitle" },
        { id: "t13", titleKey: "guide.modLegalInfoTitle" },
      ] as const,
    []
  )

  const visibleTopics = React.useMemo(() => {
    const q = moduleQuery.trim().toLowerCase()
    if (!q) return topicDefs
    return topicDefs.filter((d) => t(d.titleKey).toLowerCase().includes(q))
  }, [moduleQuery, t, topicDefs])

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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  {t("guide.sectionCoreModules")}
                </h2>
                <p className="text-sm text-muted-foreground">{t("guide.description")}</p>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={moduleQuery}
                  onChange={(e) => setModuleQuery(e.target.value)}
                  placeholder={t("guide.moduleSearchPlaceholder")}
                  className="h-11 rounded-xl pl-9"
                  aria-label={t("guide.moduleSearchPlaceholder")}
                />
              </div>
            </div>

            <div className="space-y-3">
              {visibleTopics.map((topic) => (
                <div key={topic.id} className={topic.id === "t1" ? "scroll-mt-24" : undefined}>
                  {topic.id === "t1" ? (
                    <GuideExpandable title={t(topic.titleKey)} defaultOpen>
                      <p className="text-sm text-foreground/95">{t("guide.modBusinessLead")}</p>
                      <LabelledBlock label={t("guide.labelBullets")} text={t("guide.modBusinessBullets")} />
                      <LabelledBlock label={t("guide.labelSteps")} text={t("guide.modBusinessSteps")} />
                      <p className="text-sm text-muted-foreground">{t("guide.modBusinessTip")}</p>
                      <Link
                        href="/settings"
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl border bg-card px-3 text-center text-sm font-semibold text-primary sm:w-fit"
                      >
                        {t("guide.navSettings")}
                      </Link>
                    </GuideExpandable>
                  ) : null}

                  {topic.id === "t2" ? (
                    <GuideExpandable title={t(topic.titleKey)}>
                      <p className="text-sm">{t("guide.modServicesLead")}</p>
                      <p className="text-sm text-muted-foreground">{t("guide.modServicesExplain")}</p>
                      <LabelledBlock label={t("guide.labelSteps")} text={t("guide.modServicesSteps")} />
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("guide.modServicesHoursTitle")}
                      </p>
                      <p className="text-sm">{t("guide.modServicesHoursLead")}</p>
                      <LabelledBlock label={t("guide.labelSteps")} text={t("guide.modServicesHoursSteps")} />
                      <Link
                        href="/services"
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-medium sm:w-fit"
                      >
                        {t("guide.navServices")}
                      </Link>
                    </GuideExpandable>
                  ) : null}

                  {topic.id === "t3" ? (
                    <GuideExpandable title={t(topic.titleKey)}>
                      <p className="text-sm">{t("guide.modAvailLead")}</p>
                      <p className="text-sm text-muted-foreground">{t("guide.modAvailCalendarInfo")}</p>
                      <LabelledBlock label={t("guide.labelBullets")} text={t("guide.modAvailBullets")} />
                      <LabelledBlock label={t("guide.labelSteps")} text={t("guide.modAvailSteps")} />
                      <Link
                        href="/availability"
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-medium sm:w-fit"
                      >
                        {t("guide.navAvailability")}
                      </Link>
                    </GuideExpandable>
                  ) : null}

                  {topic.id === "t4" ? (
                    <GuideExpandable title={t(topic.titleKey)}>
                      <p className="text-sm">{t("guide.modAvailExLead")}</p>
                      <LabelledBlock label={t("guide.labelSteps")} text={t("guide.modAvailExSteps")} />
                      <p className="text-sm text-muted-foreground">{t("guide.modAvailExExample")}</p>
                      <Link
                        href="/availability"
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-medium sm:w-fit"
                      >
                        {t("guide.navAvailability")}
                      </Link>
                    </GuideExpandable>
                  ) : null}

                  {topic.id === "t5" ? (
                    <GuideExpandable title={t(topic.titleKey)}>
                      <p className="text-sm">{t("guide.modTeamLead")}</p>
                      <LabelledBlock label={t("guide.labelBullets")} text={t("guide.modTeamBullets")} />
                      <LabelledBlock label={t("guide.labelSteps")} text={t("guide.modTeamSteps")} />
                      <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4 sm:grid-cols-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{t("guide.panelOwnerTitle")}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{t("guide.panelOwnerDesc")}</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{t("guide.staffRoleTitle")}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{t("guide.staffRoleDesc")}</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{t("guide.modRolesLead")}</p>
                      <LabelledBlock label={t("guide.labelBullets")} text={t("guide.modRolesBullets")} />
                      <Link
                        href="/team"
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-medium sm:w-fit"
                      >
                        {t("guide.navTeam")}
                      </Link>
                    </GuideExpandable>
                  ) : null}

                  {topic.id === "t6" ? (
                    <GuideExpandable title={t(topic.titleKey)}>
                      <p className="text-sm">{t("guide.modBookingLead")}</p>
                      <LabelledBlock label={t("guide.labelBullets")} text={t("guide.modBookingFlow")} />
                      <p className="text-sm text-muted-foreground">{t("guide.modBookingSourceOnline")}</p>
                      <p className="text-sm text-muted-foreground">{t("guide.modBookingSourceManual")}</p>
                      <p className="text-sm text-muted-foreground">{t("guide.modBookingTip")}</p>
                      <LabelledBlock label={t("guide.labelSteps")} text={t("guide.modBookingSteps")} />
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {t("guide.modManageTitle")}
                      </p>
                      <p className="text-sm">{t("guide.modManageLead")}</p>
                      <LabelledBlock label={t("guide.labelBullets")} text={t("guide.modManageFlow")} />
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {t("guide.modSlotsTitle")}
                      </p>
                      <p className="text-sm">{t("guide.modSlotsLead")}</p>
                      <p className="text-sm">{t("guide.modSlotsBlocking")}</p>
                      <p className="text-sm text-muted-foreground">{t("guide.modSlotsNonBlocking")}</p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Link
                          href={bookingPath}
                          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-primary/30 bg-muted/40 px-4 text-center text-sm font-medium text-primary sm:h-10"
                        >
                          {t("guide.navBooking")}
                        </Link>
                        <Link
                          href="/settings"
                          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border px-4 text-center text-sm font-medium sm:h-10"
                        >
                          {t("guide.navSettings")}
                        </Link>
                      </div>
                    </GuideExpandable>
                  ) : null}

                  {topic.id === "t7" ? (
                    <GuideExpandable title={t(topic.titleKey)}>
                      <p className="text-sm">{t("guide.modApptLead")}</p>
                      <p className="text-sm text-muted-foreground">{t("guide.modApptBookingSource")}</p>
                      <LabelledBlock label={t("guide.labelBullets")} text={t("guide.modApptStatuses")} />
                      <p className="text-sm text-muted-foreground">{t("guide.modApptStatusNote")}</p>
                      <LabelledBlock label={t("guide.labelSteps")} text={t("guide.modApptSteps")} />
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {t("guide.modChangesTitle")}
                      </p>
                      <p className="text-sm">{t("guide.modChangesLead")}</p>
                      <LabelledBlock label={t("guide.labelSteps")} text={t("guide.modChangesSteps")} />
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Link
                          href="/appointments"
                          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border px-4 text-sm font-medium sm:h-10"
                        >
                          {t("guide.navAppointments")}
                        </Link>
                        <Link
                          href="/dashboard"
                          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border px-4 text-sm font-medium sm:h-10"
                        >
                          {t("guide.navDashboard")}
                        </Link>
                      </div>
                    </GuideExpandable>
                  ) : null}

                  {topic.id === "t8" ? (
                    <GuideExpandable title={t(topic.titleKey)}>
                      <p className="text-sm">{t("guide.modNeedsActionLead")}</p>
                      <LabelledBlock label={t("guide.labelBullets")} text={t("guide.modNeedsActionBullets")} />
                      <Link
                        href="/dashboard"
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-medium sm:w-fit"
                      >
                        {t("guide.navDashboard")}
                      </Link>
                    </GuideExpandable>
                  ) : null}

                  {topic.id === "t9" ? (
                    <GuideExpandable title={t(topic.titleKey)}>
                      <p className="text-sm">{t("guide.modRemindersLead")}</p>
                      <p className="text-sm text-muted-foreground">{t("guide.modRemindersBody")}</p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Link
                          href="/settings"
                          className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border px-4 text-sm font-medium sm:h-10"
                        >
                          {t("guide.navSettings")}
                        </Link>
                        <Link
                          href="/messages"
                          className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border px-4 text-sm font-medium sm:h-10"
                        >
                          {t("guide.navMessages")}
                        </Link>
                      </div>
                    </GuideExpandable>
                  ) : null}

                  {topic.id === "t10" ? (
                    <GuideExpandable title={t(topic.titleKey)}>
                      <p className="text-sm">{t("guide.modMsgsLead")}</p>
                      <LabelledBlock label={t("guide.labelSteps")} text={t("guide.modMsgsSteps")} />
                      <p className="text-xs text-muted-foreground">{t("guide.modMsgsMvp")}</p>
                      <Link
                        href="/messages"
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-medium sm:w-fit"
                      >
                        {t("guide.navMessages")}
                      </Link>
                    </GuideExpandable>
                  ) : null}

                  {topic.id === "t11" ? (
                    <GuideExpandable title={t(topic.titleKey)}>
                      <p className="text-sm">{t("guide.modClientsLead")}</p>
                      <p className="text-sm text-muted-foreground">{t("guide.modClientsFoot")}</p>
                      <Link
                        href="/clients"
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-medium sm:w-fit"
                      >
                        {t("guide.navClients")}
                      </Link>
                    </GuideExpandable>
                  ) : null}

                  {topic.id === "t12" ? (
                    <GuideExpandable title={t(topic.titleKey)}>
                      <p className="text-sm">{t("guide.modSettingsGuideLead")}</p>
                      <Link
                        href="/settings"
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-medium sm:w-fit"
                      >
                        {t("guide.navSettings")}
                      </Link>
                    </GuideExpandable>
                  ) : null}

                  {topic.id === "t13" ? (
                    <GuideExpandable title={t(topic.titleKey)}>
                      <p className="text-sm">{t("guide.modLegalInfoLead")}</p>
                      <p className="text-sm text-muted-foreground">{t("guide.modLaunchLegalBullets")}</p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Link
                          href="/terms"
                          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-primary/30 bg-muted/40 px-4 text-center text-sm font-medium text-primary sm:h-10 sm:flex-none"
                        >
                          {t("footer.terms")}
                        </Link>
                        <Link
                          href="/developer-contact"
                          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border px-4 text-center text-sm font-medium sm:h-10 sm:flex-none"
                        >
                          {t("footer.developer")}
                        </Link>
                        <Link
                          href="/settings"
                          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border px-4 text-center text-sm font-medium sm:h-10 sm:flex-none"
                        >
                          {t("guide.navSettings")}
                        </Link>
                      </div>
                    </GuideExpandable>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {t("guide.sectionStatuses")}
            </h2>
            <GuideExpandable title={t("guide.modApptTitle")}>
              <p className="text-sm">{t("guide.modApptLead")}</p>
              <p className="text-sm text-muted-foreground">{t("guide.modApptBookingSource")}</p>
              <LabelledBlock label={t("guide.labelBullets")} text={t("guide.modApptStatuses")} />
              <p className="text-sm text-muted-foreground">{t("guide.modApptStatusNote")}</p>
              <Link
                href="/appointments"
                className="inline-flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-medium sm:w-fit"
              >
                {t("guide.navAppointments")}
              </Link>
            </GuideExpandable>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {t("guide.sectionAutoReminders")}
            </h2>
            <GuideExpandable title={t("guide.modRemindersTitle")}>
              <p className="text-sm">{t("guide.modRemindersLead")}</p>
              <p className="text-sm text-muted-foreground">{t("guide.modRemindersBody")}</p>
              <Link
                href="/settings"
                className="inline-flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-medium sm:w-fit"
              >
                {t("guide.navSettings")}
              </Link>
            </GuideExpandable>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {t("guide.sectionAvailabilityLogic")}
            </h2>
            <GuideExpandable title={t("guide.availabilityLogicTitle")}>
              <p className="text-sm">{t("guide.availabilityLogicLead")}</p>
              <LabelledBlock label={t("guide.labelBullets")} text={t("guide.availabilityLogicRules")} />
              <p className="text-sm font-medium text-foreground">{t("guide.modSlotsBlocking")}</p>
              <p className="text-sm text-muted-foreground">{t("guide.modSlotsNonBlocking")}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/services"
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border px-4 text-sm font-medium sm:h-10"
                >
                  {t("guide.navServices")}
                </Link>
                <Link
                  href="/team"
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border px-4 text-sm font-medium sm:h-10"
                >
                  {t("guide.navTeam")}
                </Link>
                <Link
                  href="/availability"
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border px-4 text-sm font-medium sm:h-10"
                >
                  {t("guide.navAvailability")}
                </Link>
              </div>
            </GuideExpandable>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {t("guide.sectionSupportChat")}
            </h2>
            <GuideExpandable title={t("guide.modHelpTitle")}>
              <p className="text-sm">{t("guide.modHelpLead")}</p>
              <LabelledBlock label={t("guide.labelBullets")} text={t("guide.modHelpBullets")} />
              <Link
                href="/help"
                className="inline-flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-medium sm:w-fit"
              >
                {t("navigation.help")}
              </Link>
            </GuideExpandable>
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
