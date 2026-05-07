"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslations } from "@/lib/i18n/use-translations"

type Flags = {
  enableTestNotifications: boolean
}

export function TestNotificationsPanel({
  flags,
  onSent,
}: {
  flags: Flags | null
  onSent?: () => void
}) {
  const { t } = useTranslations()
  const [smsTo, setSmsTo] = React.useState("")
  const [emailTo, setEmailTo] = React.useState("")
  const [busy, setBusy] = React.useState<null | "email" | "sms">(null)

  if (!flags?.enableTestNotifications) {
    return null
  }

  async function postJson(url: string, body: object) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      message?: string
    }
    return { res, data }
  }

  return (
    <Card className="mb-8 rounded-2xl border border-dashed border-amber-500/40 bg-amber-50/40 shadow-sm dark:bg-amber-950/20">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-base font-semibold text-foreground">
          {t("messages.testIntegrations.title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("messages.testIntegrations.lead")}</p>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="test-email-to">{t("messages.testIntegrations.emailOptional")}</Label>
            <Input
              id="test-email-to"
              type="email"
              autoComplete="email"
              placeholder="twoj@email.pl"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              className="h-10 rounded-xl"
            />
            <Button
              type="button"
              size="sm"
              className="w-full rounded-xl"
              disabled={busy !== null}
              onClick={async () => {
                setBusy("email")
                try {
                  const { res, data } = await postJson("/api/test-notifications/email", {
                    to: emailTo.trim() || undefined,
                  })
                  if (res.ok) {
                    toast.success(t("messages.testIntegrations.emailOk"))
                    onSent?.()
                  } else {
                    toast.error(
                      data.message || data.error || t("messages.testIntegrations.sendFailed")
                    )
                  }
                } catch {
                  toast.error(t("messages.testIntegrations.sendFailed"))
                } finally {
                  setBusy(null)
                }
              }}
            >
              {busy === "email"
                ? t("messages.testIntegrations.sending")
                : t("messages.testIntegrations.sendTestEmail")}
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-sms-to">{t("messages.testIntegrations.smsToLabel")}</Label>
            <Input
              id="test-sms-to"
              type="tel"
              autoComplete="tel"
              placeholder="+48123123123"
              value={smsTo}
              onChange={(e) => setSmsTo(e.target.value)}
              className="h-10 rounded-xl"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full rounded-xl"
              disabled={busy !== null}
              onClick={async () => {
                setBusy("sms")
                try {
                  const { res, data } = await postJson("/api/test-notifications/sms", {
                    to: smsTo.trim(),
                  })
                  if (res.ok) {
                    toast.success(t("messages.testIntegrations.smsOk"))
                    onSent?.()
                  } else {
                    toast.error(
                      data.message || data.error || t("messages.testIntegrations.sendFailed")
                    )
                  }
                } catch {
                  toast.error(t("messages.testIntegrations.sendFailed"))
                } finally {
                  setBusy(null)
                }
              }}
            >
              {busy === "sms"
                ? t("messages.testIntegrations.sending")
                : t("messages.testIntegrations.sendTestSms")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
