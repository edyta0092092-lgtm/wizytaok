"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import {
  completeOAuthBusinessSetupAction,
  loadOAuthSetupPrefillAction,
  type OAuthSetupAccountType,
} from "@/app/settings/business-oauth-setup-actions"
import { InternationalPhoneFieldGroup } from "@/components/forms/international-phone-field-group"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resolvePathAfterBusinessSetup } from "@/lib/auth/post-business-setup-redirect-client"
import {
  ACCOUNT_TYPE_REGISTERED,
  ACCOUNT_TYPE_UNREGISTERED,
} from "@/lib/billing/account-types"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"
import { isPolishNip10Valid } from "@/lib/validation/polish-nip"
import {
  buildStoredInternationalPhone,
  validateNationalPhoneLength,
} from "@/lib/validation/international-phone"

type BusinessOAuthSetupPanelProps = {
  onCompleted?: () => void
}

export function BusinessOAuthSetupPanel({ onCompleted }: BusinessOAuthSetupPanelProps) {
  const { t } = useTranslations()
  const router = useRouter()
  const [loadingPrefill, setLoadingPrefill] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [businessName, setBusinessName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [ownerFirstName, setOwnerFirstName] = React.useState("")
  const [ownerLastName, setOwnerLastName] = React.useState("")
  const [phoneDialCode, setPhoneDialCode] = React.useState("+48")
  const [phoneNational, setPhoneNational] = React.useState("")
  const [companyTaxId, setCompanyTaxId] = React.useState("")
  const [accountType, setAccountType] = React.useState<OAuthSetupAccountType>(
    ACCOUNT_TYPE_UNREGISTERED,
  )

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const prefill = await loadOAuthSetupPrefillAction()
      if (cancelled) return
      if (prefill.hasProfile) {
        setLoadingPrefill(false)
        onCompleted?.()
        return
      }
      setEmail(prefill.email)
      setOwnerFirstName(prefill.firstName)
      setOwnerLastName(prefill.lastName)
      setLoadingPrefill(false)
    })()
    return () => {
      cancelled = true
    }
  }, [onCompleted])

  const nipRequired = accountType === ACCOUNT_TYPE_REGISTERED

  const setAccountTypeChoice = (next: OAuthSetupAccountType) => {
    setAccountType(next)
    if (next === ACCOUNT_TYPE_UNREGISTERED) {
      setCompanyTaxId("")
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!businessName.trim()) {
      setError(t("auth.signupBusinessNameRequired"))
      return
    }
    if (!ownerFirstName.trim()) {
      setError(t("auth.signupOwnerFirstRequired"))
      return
    }
    if (!ownerLastName.trim()) {
      setError(t("auth.signupOwnerLastRequired"))
      return
    }
    if (!email.trim()) {
      setError(t("auth.enterEmailForReset"))
      return
    }

    const pv = validateNationalPhoneLength(phoneDialCode, phoneNational)
    if (!pv.ok) {
      setError(t("settings.phoneInvalidNationalLength"))
      return
    }

    if (nipRequired) {
      const nip = companyTaxId.replace(/[\s-]/g, "").trim()
      if (nip.length !== 10 || !isPolishNip10Valid(nip)) {
        setError(t("settings.taxIdInvalidChecksum"))
        return
      }
    }

    setSaving(true)
    try {
      const phone = buildStoredInternationalPhone(phoneDialCode, phoneNational)
      const result = await completeOAuthBusinessSetupAction({
        businessName: businessName.trim(),
        email: email.trim(),
        phone,
        accountType,
        taxId: nipRequired ? companyTaxId.replace(/[\s-]/g, "").trim() : null,
        ownerFirstName: ownerFirstName.trim(),
        ownerLastName: ownerLastName.trim(),
      })

      if (!result.ok) {
        if (result.code === "identity_conflict") {
          setError(t("auth.identityAlreadyExists"))
          return
        }
        if (result.code === "profile_exists") {
          onCompleted?.()
          router.refresh()
          return
        }
        if (result.code === "slug_taken") {
          setError(t("auth.slugTaken"))
          return
        }
        if (result.code === "missing_tax_id") {
          setError(t("auth.signupTaxIdRequiredHint"))
          return
        }
        if (result.code === "tax_id_invalid") {
          setError(t("settings.taxIdInvalidChecksum"))
          return
        }
        setError(t("common.saveError"))
        return
      }

      let meta: Record<string, unknown> | undefined
      if (isSupabaseConfigured()) {
        const client = getBrowserClient()
        if (client) {
          const {
            data: { user },
          } = await client.auth.getUser()
          meta = (user?.user_metadata ?? {}) as Record<string, unknown>
        }
      }

      const dest = await resolvePathAfterBusinessSetup(meta)
      onCompleted?.()
      router.replace(dest)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  if (loadingPrefill) {
    return (
      <Card className="rounded-2xl border border-primary/20 bg-primary/5 shadow-sm">
        <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          ...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border border-primary/25 bg-primary/5 shadow-sm shadow-slate-900/5">
      <CardHeader className="border-b border-primary/15 py-4">
        <CardTitle className="text-base font-semibold">{t("auth.oauthSetupTitle")}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          {t("auth.oauthSetupDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t("auth.signupAccountTypeLabel")}</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="oauth-account-type"
                  checked={accountType === ACCOUNT_TYPE_REGISTERED}
                  onChange={() => setAccountTypeChoice(ACCOUNT_TYPE_REGISTERED)}
                  className="size-4 accent-primary"
                />
                {t("auth.signupAccountTypeRegistered")}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="oauth-account-type"
                  checked={accountType === ACCOUNT_TYPE_UNREGISTERED}
                  onChange={() => setAccountTypeChoice(ACCOUNT_TYPE_UNREGISTERED)}
                  className="size-4 accent-primary"
                />
                {t("auth.signupAccountTypeUnregistered")}
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="oauth-owner-first">{t("bookingPublic.firstName")}</Label>
              <Input
                id="oauth-owner-first"
                autoComplete="given-name"
                value={ownerFirstName}
                onChange={(e) => setOwnerFirstName(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oauth-owner-last">{t("bookingPublic.lastName")}</Label>
              <Input
                id="oauth-owner-last"
                autoComplete="family-name"
                value={ownerLastName}
                onChange={(e) => setOwnerLastName(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="oauth-business-name">{t("auth.businessName")}</Label>
            <Input
              id="oauth-business-name"
              autoComplete="organization"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="oauth-email">{t("auth.email")}</Label>
            <Input
              id="oauth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>

          <InternationalPhoneFieldGroup
            label={t("settings.phoneLabel")}
            dialCode={phoneDialCode}
            nationalDigits={phoneNational}
            onDialCodeChange={setPhoneDialCode}
            onNationalChange={setPhoneNational}
            dialSelectId="oauth-phone-dial"
            nationalInputId="oauth-phone-national"
          />

          {nipRequired ? (
            <div className="space-y-2">
              <Label htmlFor="oauth-nip">{t("settings.taxIdLabel")}</Label>
              <Input
                id="oauth-nip"
                autoComplete="off"
                value={companyTaxId}
                onChange={(e) => setCompanyTaxId(e.target.value)}
                placeholder={t("settings.taxIdPlaceholder")}
                className="h-11 rounded-xl"
              />
              <p className="text-xs text-muted-foreground">{t("auth.signupTaxIdRequiredHint")}</p>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="h-11 w-full rounded-xl sm:w-auto" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ...
              </>
            ) : (
              t("auth.oauthSetupSubmit")
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
