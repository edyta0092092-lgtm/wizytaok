"use client"

import * as React from "react"
import Link from "next/link"
import { Building2, CalendarClock, CalendarDays, ClipboardList, Link2, type LucideIcon, Users } from "lucide-react"

import { GuideHero } from "@/components/guide/guide-hero"
import { GuideQuickStartCard } from "@/components/guide/guide-quick-start-card"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslations } from "@/lib/i18n/use-translations"
import { useTour } from "@/lib/tour/tour-context"
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

export default function GuidePage() {
  const { t } = useTranslations()
  const { startTour } = useTour()

  const [bookingSlug, setBookingSlug] = React.useState("")

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const { getBrowserClient, isSupabaseConfigured } = await import("@/lib/supabase/client")
        if (!isSupabaseConfigured()) return
        const client = getBrowserClient()
        if (!client) return
        const {
          data: { user },
        } = await client.auth.getUser()
        if (!user?.id) return
        const { data } = await client
          .from("business_profiles")
          .select("slug")
          .eq("owner_id", user.id)
          .maybeSingle()
        if (!cancelled && typeof data?.slug === "string" && data.slug.trim()) {
          queueMicrotask(() => setBookingSlug(data.slug.trim()))
        }
      } catch {
        /* ignore */
      }
    }
    void run()
    return () => {
      cancelled = true
    }
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

          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                {t("guide.sectionQuickStart")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("guide.tipInteractiveChecklist")}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {quickRowsResolved.map((row, idx) => {
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

        </div>
      </PageShell>
    </AppShell>
  )
}
