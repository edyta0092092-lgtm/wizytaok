"use client"

import Link from "next/link"
import { Calendar, ChevronRight, MessageCircle } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslations } from "@/lib/i18n/use-translations"

export function SettingsIntegrationsLinkCard() {
  const { t } = useTranslations()

  const links = [
    {
      href: "/settings/integrations#whatsapp",
      icon: MessageCircle,
      title: t("settings.integrationsWhatsApp"),
      hint: t("settings.integrationsWhatsAppHint"),
      iconClass: "text-emerald-600",
    },
    {
      href: "/settings/integrations#google-calendar",
      icon: Calendar,
      title: t("settings.integrationsGoogleCalendar"),
      hint: t("settings.integrationsGoogleCalendarHint"),
      iconClass: "text-primary",
    },
  ] as const

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
      <CardHeader className="border-b border-border/70 py-4">
        <CardTitle className="text-sm font-semibold">{t("settings.integrationsTitle")}</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {t("settings.integrationsDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-4">
        {links.map(({ href, icon: Icon, title, hint, iconClass }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
          >
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ${iconClass}`}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-foreground">{title}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
