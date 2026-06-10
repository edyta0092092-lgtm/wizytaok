"use client"

import Link from "next/link"
import { Calendar, ChevronRight, MessageSquare } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { INTEGRATIONS_UI } from "@/config/integrations-ui"
import { useTranslations } from "@/lib/i18n/use-translations"

export function SettingsMobileNotificationsLinks() {
  const { t } = useTranslations()

  const links: Array<{
    href: string
    icon: typeof MessageSquare
    title: string
    hint: string
    iconClass: string
    comingSoon?: boolean
  }> = [
    {
      href: "/messages",
      icon: MessageSquare,
      title: t("navigation.messages"),
      hint: t("settings.mobileNotificationsMessagesHint"),
      iconClass: "text-primary",
    },
    {
      href: "/settings/integrations#whatsapp",
      icon: MessageSquare,
      title: t("settings.integrationsWhatsApp"),
      hint: t("settings.integrationsWhatsAppHint"),
      iconClass: "text-emerald-600",
      comingSoon: INTEGRATIONS_UI.whatsAppComingSoon,
    },
    {
      href: "/settings/integrations#google-calendar",
      icon: Calendar,
      title: t("settings.integrationsGoogleCalendar"),
      hint: t("settings.integrationsGoogleCalendarHint"),
      iconClass: "text-primary",
      comingSoon: INTEGRATIONS_UI.googleCalendarComingSoon,
    },
  ]

  return (
    <ul className="space-y-2">
      {links.map(({ href, icon: Icon, title, hint, iconClass, comingSoon }) => (
        <li key={href}>
          <Link
            href={href}
            className="flex min-h-[3.25rem] touch-manipulation items-center gap-3 rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
          >
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ${iconClass}`}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{title}</span>
                {comingSoon ? (
                  <Badge
                    variant="outline"
                    className="rounded-md border-primary/30 bg-primary/5 px-1.5 py-0 text-[10px] font-medium text-primary"
                  >
                    {t("integrationsPage.comingSoonBadge")}
                  </Badge>
                ) : null}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {comingSoon ? t("integrationsPage.comingSoonDescription") : hint}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}
