"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

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
import {
  PUBLIC_SLUG_MAX_LENGTH,
  PUBLIC_SLUG_MIN_LENGTH,
  DEMO_BOOKING_SLUG,
  isValidPublicSlugFormat,
  normalizePublicSlug,
} from "@/lib/business/slug"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import {
  BUSINESS_PUBLIC_SLUG_COLUMN,
  checkBusinessSlugAvailability,
} from "@/lib/supabase/repositories/business-profile.repository"
import { useTranslations } from "@/lib/i18n/use-translations"

type SignupFormProps = {
  startTrial?: boolean
}

type AccountType = "registered_business" | "unregistered_activity"

function normalizeDigits(raw: string): string {
  return raw.replace(/\D/g, "")
}

export function SignupForm({ startTrial = false }: SignupFormProps) {
  const router = useRouter()
  const { t } = useTranslations()

  const [businessName, setBusinessName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [ownerFirstName, setOwnerFirstName] = React.useState("")
  const [ownerLastName, setOwnerLastName] = React.useState("")
  const [accountType, setAccountType] = React.useState<AccountType>("registered_business")
  const [companyTaxId, setCompanyTaxId] = React.useState("")
  const [contactPhone, setContactPhone] = React.useState("")
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

    const normalized = normalizePublicSlug(slug)
    const taxIdNormalized = normalizeDigits(companyTaxId)
    const contactPhoneNormalized = normalizeDigits(contactPhone)
    if (!normalized) {
      setError(t("auth.slugRequired"))
      return
    }
    if (
      normalized.length < PUBLIC_SLUG_MIN_LENGTH ||
      normalized.length > PUBLIC_SLUG_MAX_LENGTH ||
      !isValidPublicSlugFormat(normalized)
    ) {
      setError(t("auth.slugInvalid"))
      return
    }
    if (normalized === DEMO_BOOKING_SLUG) {
      setError(t("auth.slugTaken"))
      return
    }
    if (startTrial && accountType === "registered_business") {
      if (taxIdNormalized.length !== 10) {
        setError("Podaj poprawny NIP (10 cyfr).")
        return
      }
    }
    if (startTrial && accountType === "unregistered_activity") {
      if (contactPhoneNormalized.length < 9) {
        setError("Podaj telefon kontaktowy.")
        return
      }
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

      const slugCheck = await checkBusinessSlugAvailability(client, normalized)
      if (process.env.NODE_ENV === "development") {
        console.info("[signup.slug.check]", {
          rawSlug: slug,
          normalizedSlug: normalized,
          slugColumn: BUSINESS_PUBLIC_SLUG_COLUMN,
          rpcError: slugCheck.rpcError?.message,
          selectError: slugCheck.selectError?.message,
          available: slugCheck.available,
        })
      }
      if (slugCheck.error) {
        const errorMessage =
          process.env.NODE_ENV === "development"
            ? `${t("auth.slugCheckError")} ${t("help.errorDetailsPrefix")} ${slugCheck.error.message}`
            : t("auth.slugCheckError")
        setError(errorMessage)
        return
      }
      if (slugCheck.available !== true) {
        setError(t("auth.slugTaken"))
        return
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
            owner_name: ownerFirstName.trim() || undefined,
            owner_last_name: ownerLastName.trim() || undefined,
            trial_intent: startTrial || undefined,
            account_type: startTrial ? accountType : undefined,
            company_tax_id: startTrial ? (companyTaxId.trim() || undefined) : undefined,
            company_tax_id_normalized:
              startTrial && accountType === "registered_business" ? taxIdNormalized : undefined,
            contact_phone: startTrial ? (contactPhone.trim() || undefined) : undefined,
            contact_phone_normalized:
              startTrial && accountType === "unregistered_activity"
                ? contactPhoneNormalized
                : undefined,
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
      setInfo(
        startTrial
          ? "Konto zostało utworzone. Sprawdź e-mail i potwierdź konto."
          : t("auth.signupSuccessCheckEmail")
      )
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
              <p className="text-sm text-muted-foreground">
                Utworz konto, a nastepnie przejdziesz do bezpiecznego podpniecia karty w Stripe.
              </p>
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
              <div className="space-y-2">
                <Label htmlFor="signup-slug">{t("auth.publicSlug")}</Label>
                <Input
                  id="signup-slug"
                  autoComplete="off"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="moja-firma"
                  className="h-11 rounded-xl font-mono text-sm"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="signup-owner-first">{t("auth.ownerFirstNameOptional")}</Label>
                  <Input
                    id="signup-owner-first"
                    autoComplete="given-name"
                    value={ownerFirstName}
                    onChange={(e) => setOwnerFirstName(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-owner-last">{t("auth.ownerLastNameOptional")}</Label>
                  <Input
                    id="signup-owner-last"
                    autoComplete="family-name"
                    value={ownerLastName}
                    onChange={(e) => setOwnerLastName(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
              {startTrial ? (
                <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                  <p className="text-sm font-medium text-foreground">Typ działalności</p>
                  <div className="grid gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name="accountType"
                        value="registered_business"
                        checked={accountType === "registered_business"}
                        onChange={() => setAccountType("registered_business")}
                      />
                      <span>Firma z NIP</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name="accountType"
                        value="unregistered_activity"
                        checked={accountType === "unregistered_activity"}
                        onChange={() => setAccountType("unregistered_activity")}
                      />
                      <span>Działalność nierejestrowana / osoba bez NIP</span>
                    </label>
                  </div>
                  {accountType === "registered_business" ? (
                    <div className="space-y-2">
                      <Label htmlFor="signup-tax-id">NIP</Label>
                      <Input
                        id="signup-tax-id"
                        autoComplete="off"
                        inputMode="numeric"
                        value={companyTaxId}
                        onChange={(e) => setCompanyTaxId(e.target.value)}
                        placeholder="np. 123-456-32-18"
                        className="h-11 rounded-xl"
                        required={startTrial}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="signup-contact-phone">Telefon kontaktowy</Label>
                      <Input
                        id="signup-contact-phone"
                        autoComplete="tel"
                        inputMode="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="np. +48 600 123 456"
                        className="h-11 rounded-xl"
                        required={startTrial}
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Darmowy okres próbny przysługuje jednej firmie lub osobie tylko raz.
                  </p>
                </div>
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
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl"
                  minLength={6}
                  required
                />
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
              <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
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
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground"
            >
              {t("auth.homeLink")}
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
