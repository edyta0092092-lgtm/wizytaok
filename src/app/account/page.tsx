"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { AccountCredentialsPanel } from "@/components/account/account-credentials-panel"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

export default function AccountPage() {
  const { t, language, setLanguage, theme, setTheme } = useTranslations()
  const router = useRouter()
  const access = useBusinessAccess()
  const panelRoleLabel =
    access.effectiveRole === "admin"
      ? t("invitations.adminRoleOption")
      : access.effectiveRole === "staff"
        ? t("invitations.staffRoleOption")
        : ""
  const [displayDraft, setDisplayDraft] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [saveErr, setSaveErr] = React.useState(false)

  React.useEffect(() => {
    if (!access.ready) return
    const label = access.displayName ?? ""
    queueMicrotask(() => setDisplayDraft(label))
  }, [access.ready, access.displayName])

  const onSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveErr(false)
    setSaved(false)
    if (!isSupabaseConfigured() || !access.businessId) {
      setSaveErr(true)
      return
    }
    const client = getBrowserClient()
    if (!client) {
      setSaveErr(true)
      return
    }
    setSaving(true)
    try {
      if (access.isOwner) {
        await client.rpc("ensure_owner_membership")
      }
      const { error } = await client.rpc("set_business_member_display_name", {
        p_business_id: access.businessId,
        p_display_name: displayDraft.trim(),
      })
      if (error) {
        setSaveErr(true)
        return
      }
      setSaved(true)
      await access.refresh()
    } finally {
      setSaving(false)
    }
  }

  const logout = async () => {
    const client = getBrowserClient()
    if (client) await client.auth.signOut()
    router.replace("/login")
    router.refresh()
  }

  return (
    <AppShell title={t("account.title")} pageDescription={t("account.description")}>
      <PageShell>
        {!access.ready ? (
          <p className="text-sm text-muted-foreground">{"\u00a0"}</p>
        ) : !access.businessId ? (
          <p className="text-sm text-muted-foreground">{t("account.noBusiness")}</p>
        ) : (
          <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
            <AccountCredentialsPanel
              businessId={access.businessId}
              userEmail={access.userEmail}
              isOwner={access.isOwner}
            />

            <Card className="rounded-2xl border border-border">
              <CardHeader>
                <CardTitle className="text-base">{t("account.title")}</CardTitle>
                <CardDescription>{t("account.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {panelRoleLabel ? (
                  <div className="space-y-2">
                    <Label>{t("team.panelRole")}</Label>
                    <Input readOnly value={panelRoleLabel} className="h-11 rounded-xl bg-muted/40" />
                  </div>
                ) : null}
                <form className="space-y-3" onSubmit={(ev) => void onSaveDisplayName(ev)}>
                  <div className="space-y-2">
                    <Label htmlFor="acc-display">{t("account.displayName")}</Label>
                    <Input
                      id="acc-display"
                      value={displayDraft}
                      onChange={(ev) => setDisplayDraft(ev.target.value)}
                      className="h-11 rounded-xl"
                      autoComplete="name"
                    />
                  </div>
                  <Button type="submit" className="h-10 rounded-xl" disabled={saving}>
                    {t("account.saveDisplayName")}
                  </Button>
                  {saved ? (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">{t("account.saved")}</p>
                  ) : null}
                  {saveErr ? <p className="text-sm text-destructive">{t("account.saveError")}</p> : null}
                </form>

                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 text-xs">
                  <p className="font-semibold text-muted-foreground">{t("settings.language")}</p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={language === "pl" ? "default" : "outline"}
                      className="h-8 rounded-lg px-3"
                      onClick={() => setLanguage("pl")}
                    >
                      PL
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={language === "en" ? "default" : "outline"}
                      className="h-8 rounded-lg px-3"
                      onClick={() => setLanguage("en")}
                    >
                      EN
                    </Button>
                  </div>
                  <p className="mt-3 font-semibold text-muted-foreground">{t("settings.theme")}</p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={theme === "light" ? "default" : "outline"}
                      className="h-8 rounded-lg px-3"
                      onClick={() => setTheme("light")}
                    >
                      {t("settings.light")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={theme === "dark" ? "default" : "outline"}
                      className="h-8 rounded-lg px-3"
                      onClick={() => setTheme("dark")}
                    >
                      {t("settings.dark")}
                    </Button>
                  </div>
                </div>

                <Button type="button" variant="outline" className="h-10 w-full rounded-xl" onClick={() => void logout()}>
                  {t("auth.logOut")}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </PageShell>
    </AppShell>
  )
}
