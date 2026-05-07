"use client"

import * as React from "react"
import Link from "next/link"

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

export function SignupForm() {
  const { t } = useTranslations()

  const [businessName, setBusinessName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [ownerName, setOwnerName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [info, setInfo] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

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

    setLoading(true)
    try {
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

      const origin = window.location.origin
      const { data: authData, error: signErr } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/login")}`,
          data: {
            business_name: businessName.trim(),
            slug: normalized,
            owner_name: ownerName.trim() || undefined,
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
              <div className="space-y-2">
                <Label htmlFor="signup-owner">{t("auth.ownerNameOptional")}</Label>
                <Input
                  id="signup-owner"
                  autoComplete="name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
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
                href="/login"
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
