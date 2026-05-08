"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { InternationalPhoneFieldGroup } from "@/components/forms/international-phone-field-group"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { allocateSignupBookingSlug } from "@/lib/business/allocate-signup-slug"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { BUSINESS_PUBLIC_SLUG_COLUMN } from "@/lib/supabase/repositories/business-profile.repository"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"
import {
  buildStoredInternationalPhone,
  validateNationalPhoneLength,
} from "@/lib/validation/international-phone"
import { isPolishNip10Valid } from "@/lib/validation/polish-nip"
import {
  assertPasswordPolicy,
  getPasswordPolicyLiveHint,
  PASSWORD_POLICY_I18N,
} from "@/lib/validation/password-policy"

type SignupFormProps = {
  startTrial?: boolean
}

type SignupAccountKind = "registered_business" | "unregistered_activity"

function normalizeDigits(raw: string): string {
  return raw.replace(/\D/g, "")
}

export function SignupForm({ startTrial = false }: SignupFormProps) {
  const router = useRouter()
  const { t } = useTranslations()

  const [businessName, setBusinessName] = React.useState("")
  const [ownerFirstName, setOwnerFirstName] = React.useState("")
  const [ownerLastName, setOwnerLastName] = React.useState("")
  const [companyTaxId, setCompanyTaxId] = React.useState("")
  const [accountKind, setAccountKind] = React.useState<SignupAccountKind>(() =>
    startTrial ? "registered_business" : "unregistered_activity",
  )
  const [phoneDialCode, setPhoneDialCode] = React.useState("+48")
  const [phoneNational, setPhoneNational] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [info, setInfo] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!startTrial) return
    if (!isSupabaseConfigured()) return
    const client = getBrowserClient()
    if (!client) return
    let cancelled = false
    void (async () => {
      const {
        data: { user },
      } = await client.auth.getUser()

      if (cancelled) return
      if (user) {
        router.replace("/start-trial?source=landing_trial_signup")
        return
      }

      const hasTrialCookie =
        typeof document !== "undefined" && document.cookie.includes("wizytaok_trial_intent=1")
      const hasTrialStorage = (() => {
        if (typeof window === "undefined") return false
        try {
          return window.localStorage.getItem("wizytaok_trial_intent") === "1"
        } catch {
          return false
        }
      })()
      if (hasTrialCookie || hasTrialStorage) {
        router.replace("/login?next=%2Fstart-trial")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router, startTrial])

  const nipRelevant = accountKind === "registered_business"
  const nipFieldHint = React.useMemo(() => {
    if (!nipRelevant) return null
    const digits = normalizeDigits(companyTaxId)
    if (digits.length === 0) return null
    if (digits.length !== 10) return t("settings.taxIdDigitsHint")
    if (!isPolishNip10Valid(digits)) return t("settings.taxIdInvalidChecksum")
    return null
  }, [nipRelevant, companyTaxId, t])

  /** Przy „firma z NIP” pole jest obowiązkowe — pusty NIP blokuje wysłanie. */
  const nipEmptyBlocksSubmit = nipRelevant && normalizeDigits(companyTaxId).length === 0
  const nipBlocksSubmit = Boolean(nipFieldHint) || nipEmptyBlocksSubmit

  function setAccountKindChoice(next: SignupAccountKind) {
    setAccountKind(next)
    if (next === "unregistered_activity") setCompanyTaxId("")
  }

  const passwordLiveHint = React.useMemo(() => {
    const v = getPasswordPolicyLiveHint(password)
    return v ? t(PASSWORD_POLICY_I18N[v]) : null
  }, [password, t])

  const passwordBlocksSubmit = Boolean(passwordLiveHint)

  const phoneFieldHint = React.useMemo(() => {
    const national = phoneNational.replace(/\D/g, "")
    if (national.length === 0) return t("auth.signupPhoneRequired")
    const v = validateNationalPhoneLength(phoneDialCode, phoneNational)
    if (v.ok) return null
    if (v.min === v.max) {
      return t("settings.phoneInvalidNationalLengthExact").replace("{n}", String(v.min))
    }
    return t("settings.phoneInvalidNationalLength")
      .replace("{min}", String(v.min))
      .replace("{max}", String(v.max))
  }, [phoneDialCode, phoneNational, t])

  const phoneBlocksSubmit = Boolean(phoneFieldHint)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (!isSupabaseConfigured()) {
      setError(t("auth.supabaseNotConfigured"))
      return
    }
    const client = getBrowserClient()
    if (!client) {
      setError(t("auth.signupError"))
      return
    }

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

    const nationalPhone = phoneNational.replace(/\D/g, "")
    if (nationalPhone.length === 0) {
      setError(t("auth.signupPhoneRequired"))
      return
    }
    const phoneLen = validateNationalPhoneLength(phoneDialCode, phoneNational)
    if (!phoneLen.ok) {
      setError(
        phoneLen.min === phoneLen.max
          ? t("settings.phoneInvalidNationalLengthExact").replace("{n}", String(phoneLen.min))
          : t("settings.phoneInvalidNationalLength")
              .replace("{min}", String(phoneLen.min))
              .replace("{max}", String(phoneLen.max)),
      )
      return
    }
    const contactPhoneStored = buildStoredInternationalPhone(phoneDialCode, phoneNational)
    const contactPhoneNormalized = normalizeDigits(contactPhoneStored)

    const taxIdNormalized = normalizeDigits(companyTaxId)
    let companyTaxIdForSignup: string | undefined
    let companyTaxIdNormalizedForSignup: string | undefined

    if (accountKind === "registered_business") {
      if (taxIdNormalized.length !== 10) {
        setError(t("settings.taxIdDigitsHint"))
        return
      }
      if (!isPolishNip10Valid(taxIdNormalized)) {
        setError(t("settings.taxIdInvalidChecksum"))
        return
      }
      companyTaxIdForSignup = companyTaxId.trim() || undefined
      companyTaxIdNormalizedForSignup = taxIdNormalized
    }

    const pwdViol = assertPasswordPolicy(password)
    if (pwdViol) {
      setError(t(PASSWORD_POLICY_I18N[pwdViol]))
      return
    }

    const slugPick = await allocateSignupBookingSlug(client, businessName.trim())
    if (!slugPick.ok) {
      setError(
        slugPick.code === "check_failed" ? t("auth.slugCheckError") : t("auth.signupSlugReserveFailed"),
      )
      return
    }
    const normalized = slugPick.slug

    if (process.env.NODE_ENV === "development") {
      console.info("[signup.slug]", {
        normalizedSlug: normalized,
        mode: "allocated_from_business_name",
        slugColumn: BUSINESS_PUBLIC_SLUG_COLUMN,
      })
    }

    setLoading(true)
    try {
      if (startTrial && typeof document !== "undefined") {
        document.cookie = "wizytaok_trial_intent=1; Max-Age=86400; Path=/; SameSite=Lax"
        try {
          window.localStorage.setItem("wizytaok_trial_intent", "1")
        } catch {
          // ignore storage failures (private mode, restricted browser settings)
        }
      }

      const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
      const siteBase = (configuredSiteUrl && configuredSiteUrl.length > 0 ? configuredSiteUrl : window.location.origin).replace(/\/$/, "")
      const afterConfirmPath = startTrial ? "/start-trial" : "/login"
      const { data: authData, error: signErr } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: startTrial
            ? `${siteBase}/auth/callback?next=${encodeURIComponent(afterConfirmPath)}`
            : `${siteBase}/auth/callback`,
          data: {
            business_name: businessName.trim(),
            slug: normalized,
            owner_name: ownerFirstName.trim(),
            owner_last_name: ownerLastName.trim(),
            trial_intent: startTrial || undefined,
            account_type: accountKind,
            company_tax_id: companyTaxIdForSignup,
            company_tax_id_normalized: companyTaxIdNormalizedForSignup,
            contact_phone: contactPhoneStored || undefined,
            contact_phone_normalized: contactPhoneNormalized || undefined,
          },
        },
      })

      if (signErr) {
        const msg = signErr.message?.trim()
        setError(msg && msg.length > 0 ? msg : t("auth.signupError"))
        return
      }

      const authUser = authData.user
      if (!authUser?.id) {
        setError(t("auth.signupUserCreateFailed"))
        return
      }

      if (process.env.NODE_ENV === "development") {
        console.info("[signup.profile.insert]", {
          mode: "deferred_to_auth_callback",
          reason: authData.session ? "session_present_but_confirmation_required_flow" : "no_session_after_signup",
          userId: authUser.id,
          slug: normalized,
        })
      }

      // Zawsze wymagamy flow z potwierdzeniem e-mail.
      // Profil firmy tworzymy dopiero po kliknięciu linku (auth callback).
      await client.auth.signOut()
      setInfo(t("auth.signupSuccessCheckEmail"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/80 bg-card/80 px-4 py-3 sm:px-5">
        <Logo />
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-5">
        <Card className="w-full max-w-md rounded-2xl border border-border/80 bg-card shadow-sm shadow-slate-900/5">
          <CardHeader className="space-y-1 text-left">
            <CardTitle className="text-xl font-semibold tracking-tight">
              {t("auth.signupTitle")}
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {t("auth.signupDescription")}
            </CardDescription>
            {startTrial ? (
              <p className="text-sm text-muted-foreground">{t("auth.signupTrialStripeLead")}</p>
            ) : null}
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="signup-business">{t("auth.businessName")}</Label>
                <Input
                  id="signup-business"
                  autoComplete="organization"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="h-11 rounded-xl"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="signup-owner-first">{t("bookingPublic.firstName")}</Label>
                  <Input
                    id="signup-owner-first"
                    autoComplete="given-name"
                    value={ownerFirstName}
                    onChange={(e) => setOwnerFirstName(e.target.value)}
                    className="h-11 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-owner-last">{t("bookingPublic.lastName")}</Label>
                  <Input
                    id="signup-owner-last"
                    autoComplete="family-name"
                    value={ownerLastName}
                    onChange={(e) => setOwnerLastName(e.target.value)}
                    className="h-11 rounded-xl"
                    required
                  />
                </div>
              </div>

              <fieldset className="space-y-4 rounded-xl border border-border/70 bg-muted/15 p-4">
                <legend className="px-1 text-sm font-medium text-foreground">
                  {t("auth.signupAccountTypeLabel")}
                </legend>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-start gap-2 text-sm leading-snug">
                    <input
                      type="radio"
                      name="signup-account-kind"
                      className="mt-0.5 size-4 shrink-0 rounded-full border border-input bg-background accent-primary"
                      checked={accountKind === "registered_business"}
                      onChange={() => setAccountKindChoice("registered_business")}
                    />
                    <span>{t("auth.signupAccountTypeRegistered")}</span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 text-sm leading-snug">
                    <input
                      type="radio"
                      name="signup-account-kind"
                      className="mt-0.5 size-4 shrink-0 rounded-full border border-input bg-background accent-primary"
                      checked={accountKind === "unregistered_activity"}
                      onChange={() => setAccountKindChoice("unregistered_activity")}
                    />
                    <span>{t("auth.signupAccountTypeUnregistered")}</span>
                  </label>
                </div>
                {accountKind === "registered_business" ? (
                  <div className="space-y-2">
                    {!startTrial ? (
                      <p className="text-xs text-muted-foreground">{t("auth.signupTaxIdRequiredHint")}</p>
                    ) : null}
                    <Label htmlFor="signup-tax-id">{t("settings.taxIdLabel")}</Label>
                    <Input
                      id="signup-tax-id"
                      autoComplete="off"
                      value={companyTaxId}
                      onChange={(e) => setCompanyTaxId(e.target.value)}
                      placeholder={t("settings.taxIdPlaceholder")}
                      aria-invalid={Boolean(nipFieldHint)}
                      required
                      className={cn(
                        "h-11 rounded-xl",
                        nipFieldHint ? "border-destructive focus-visible:ring-destructive/30" : null,
                      )}
                    />
                    {nipFieldHint ? (
                      <p className="text-xs text-destructive" role="alert">
                        {nipFieldHint}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {startTrial && accountKind === "registered_business" ? (
                  <p className="text-xs text-muted-foreground">{t("auth.trialOnePerBusinessFootnote")}</p>
                ) : null}
              </fieldset>

              <InternationalPhoneFieldGroup
                label={t("settings.phoneLabel")}
                dialCode={phoneDialCode}
                nationalDigits={phoneNational}
                onDialCodeChange={setPhoneDialCode}
                onNationalChange={setPhoneNational}
                dialSelectId="signup-phone-dial"
                nationalInputId="signup-phone-national"
                showInlineError={false}
              />
              {phoneFieldHint ? (
                <p className="-mt-2 text-xs text-destructive" role="alert">
                  {phoneFieldHint}
                </p>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="signup-email">{t("auth.email")}</Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">{t("auth.password")}</Label>
                <p className="text-xs text-muted-foreground">{t("auth.passwordRequirementsHint")}</p>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(passwordLiveHint)}
                  className={cn(
                    "h-11 rounded-xl",
                    passwordLiveHint ? "border-destructive focus-visible:ring-destructive/30" : null,
                  )}
                  minLength={8}
                  required
                />
                {passwordLiveHint ? (
                  <p className="text-xs text-destructive" role="alert">
                    {passwordLiveHint}
                  </p>
                ) : null}
              </div>
              {error ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              ) : null}
              {info ? (
                <p className="text-sm text-muted-foreground" role="status">
                  {info}
                </p>
              ) : null}
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("auth.signupLegalPrefix")}{" "}
                <Link href="/terms" className="underline-offset-4 hover:underline">
                  {t("footer.terms")}
                </Link>{" "}
                {t("auth.signupLegalAnd")}{" "}
                <Link href="/privacy" className="underline-offset-4 hover:underline">
                  {t("footer.privacy")}
                </Link>
                .
              </p>
              <Button
                type="submit"
                className="h-11 w-full rounded-xl"
                disabled={loading || nipBlocksSubmit || passwordBlocksSubmit || phoneBlocksSubmit}
              >
                {loading ? "…" : t("auth.signupSubmit")}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 border-t border-border/70 bg-muted/15 text-center text-sm text-muted-foreground">
            <p>
              {t("auth.hasAccount")}{" "}
              <Link
                href={startTrial ? "/login?next=%2Fstart-trial" : "/login"}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {t("auth.loginFromSignupCta")}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
