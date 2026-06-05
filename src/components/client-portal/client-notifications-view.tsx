"use client"

import { Mail, MessageSquare } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ClientPortalNotification } from "@/lib/client-portal/types"
import { useTranslations } from "@/lib/i18n/use-translations"

export function ClientNotificationsView({
  lastSms,
  lastEmail,
}: {
  lastSms: ClientPortalNotification | null
  lastEmail: ClientPortalNotification | null
}) {
  const { t } = useTranslations()

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <NotificationCard
        icon={MessageSquare}
        title={t("clientPortal.lastSms")}
        item={lastSms}
        empty={t("clientPortal.noNotifications")}
      />
      <NotificationCard
        icon={Mail}
        title={t("clientPortal.lastEmail")}
        item={lastEmail}
        empty={t("clientPortal.noNotifications")}
      />
    </div>
  )
}

function NotificationCard({
  icon: Icon,
  title,
  item,
  empty,
}: {
  icon: typeof Mail
  title: string
  item: ClientPortalNotification | null
  empty: string
}) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 border-b border-border/70 py-4">
        <Icon className="size-4 text-primary" aria-hidden />
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-4 text-sm">
        {item ? (
          <>
            <p className="text-xs text-muted-foreground">
              {item.sentAt?.slice(0, 16) ?? item.createdAt.slice(0, 16)} · {item.status}
            </p>
            {item.subject ? <p className="font-medium">{item.subject}</p> : null}
            <p className="text-muted-foreground leading-relaxed">
              {item.bodyPreview ?? "—"}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  )
}
