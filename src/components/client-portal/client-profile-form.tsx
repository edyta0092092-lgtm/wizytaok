"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ClientPortalProfile } from "@/lib/client-portal/types"
import { useTranslations } from "@/lib/i18n/use-translations"

export function ClientProfileForm({
  profile,
  onSave,
}: {
  profile: ClientPortalProfile
  onSave: (next: ClientPortalProfile) => void
}) {
  const { t } = useTranslations()
  const [draft, setDraft] = React.useState(profile)
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => {
    setDraft(profile)
  }, [profile])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(draft)
    setSaved(true)
    toast.success(t("clientPortal.profileSaved"))
    window.setTimeout(() => setSaved(false), 2500)
  }

  return (
    <Card className="rounded-2xl border border-border shadow-sm">
      <CardHeader className="border-b border-border/70 py-4">
        <CardTitle className="text-sm font-semibold">{t("clientPortal.profileTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSave}>
          <Field
            id="profile-first"
            label={t("clientPortal.firstName")}
            value={draft.firstName}
            onChange={(v) => setDraft((d) => ({ ...d, firstName: v }))}
          />
          <Field
            id="profile-last"
            label={t("clientPortal.lastName")}
            value={draft.lastName}
            onChange={(v) => setDraft((d) => ({ ...d, lastName: v }))}
          />
          <Field
            id="profile-phone"
            label={t("clientPortal.phone")}
            value={draft.phone}
            onChange={(v) => setDraft((d) => ({ ...d, phone: v }))}
          />
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">{t("clientPortal.email")}</Label>
            <Input id="profile-email" className="h-10 rounded-xl" value={draft.email} disabled readOnly />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" className="h-10 rounded-xl">
              {saved ? t("clientPortal.saved") : t("clientPortal.saveProfile")}
            </Button>
          </div>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">{t("clientPortal.profileFoundationNote")}</p>
      </CardContent>
    </Card>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="h-10 rounded-xl"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
