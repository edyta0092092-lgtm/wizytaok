"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

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
  OAuthProviderButtons,
  oauthErrorMessageFromCode,
} from "@/components/auth/oauth-provider-buttons"
import {
  isEmailNotConfirmedAuthError,
  requestSignupConfirmationEmail,
} from "@/lib/auth/signup-confirmation-client"
import { fetchTrialStartEligibility } from "@/lib/billing/trial-eligibility-client"
import { safeInternalRedirect } from "@/lib/auth/safe-internal-redirect"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"

export function LoginForm() {
  const { t } = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const postLoginPath = safeInternalRedirect(
    searchParams.get("next") ?? searchParams.get("redirectTo")
  )
  const resetStatus = searchParams.get("reset")
  const confirmedStatus = searchParams.get("confirmed")
  const oauthErrorCode = searchParams.get("oauth_error")
  const hasRecoverableConfirmationLinkError = oauthErrorCode === "auth_link_invalid_or_expired"

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [info, setInfo] = React.useState<string | null>(
    confirmedStatus === "1"
      ? t("auth.emailConfirmedLogin")
      : hasRecoverableConfirmationLinkError
        ? t("auth.emailConfirmationMaybeConfirmed")
        : resetStatus === "success"
          ? t("auth.resetPasswordSuccess")
          : null,
  )
  const [oauthError, setOauthError] = React.useState<string | null>(() =>
    oauthErrorCode && !hasRecoverableConfirmationLinkError
      ? oauthErrorMessageFromCode(oauthErrorCode, t)
      : null,
  )
  const [loading, setLoading] = React.useState(false)
  const [sendingReset, setSendingReset] = React.useState(false)
  const [sendingConfirmation, setSendingConfirmation] = React.useState(false)

  const isActiveSubscriptionStatus = React.useCallback((status: string | null | undefined) => {
    const normalized = String(status ?? "").trim().toLowerCase()
    return normalized === "trialing" || normalized === "active"
  }, [])

  const resolveBillingChoiceRedirect = React.useCallback(async () => {
    const eligibility = await fetchTrialStartEligibility()
    return eligibility.blocked ? "/activate-access?trial_blocked=1" : "/activate-access"
  }, [])

  React.useEffect(() => {
    queueMicrotask(() => {
      if (confirmedStatus === "1") {
        setOauthError(null)
        setInfo(t("auth.emailConfirmedLogin"))
        return
      }
      if (oauthErrorCode === "auth_link_invalid_or_expired") {
        setOauthError(null)
        setInfo(t("auth.emailConfirmationMaybeConfirmed"))
        return
      }
      setOauthError(oauthErrorCode ? oauthErrorMessageFromCode(oauthErrorCode, t) : null)
      if (resetStatus === "success") {
        setInfo(t("auth.resetPasswordSuccess"))
      }
    })
  }, [confirmedStatus, oauthErrorCode, resetStatus, t])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isSupabaseConfigured()) {
      setError(t("auth.supabaseNotConfigured"))
      return
    }
    const client = getBrowserClient()
    if (!client) {
      setError(t("auth.authError"))
      return
    }
    setLoading(true)
    try {
      const { error: signError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signError) {
        if (isEmailNotConfirmedAuthError(signError)) {
          setError(t("auth.emailNotConfirmed"))
          return
        }
        setError(t("auth.authError"))
        return
      }
      const {
        data: { user },
      } = await client.auth.getUser()
      if (!user) {
        setError(t("auth.authError"))
        return
      }
      const { data: profile } = await client
        .from("business_profiles")
        .select("id, subscription_status, stripe_subscription_status")
        .eq("owner_id", user.id)
        .maybeSingle()

      const rawTrialIntent = user.user_metadata?.trial_intent
      const wantsTrial =
        rawTrialIntent === true ||
        rawTrialIntent === "true" ||
        rawTrialIntent === 1 ||
        rawTrialIntent === "1"
      const wantsTrialFromCookie =
        typeof document !== "undefined" && document.cookie.includes("wizytaok_trial_intent=1")
      const wantsTrialFromStorage = (() => {
        if (typeof window === "undefined") return false
        try {
          return window.localStorage.getItem("wizytaok_trial_intent") === "1"
        } catch {
          return false
        }
      })()
      const shouldStartTrialAfterLogin =
        !postLoginPath &&
        (wantsTrial || wantsTrialFromCookie || wantsTrialFromStorage) &&
        !isActiveSubscriptionStatus(profile?.subscription_status) &&
        !isActiveSubscriptionStatus(profile?.stripe_subscription_status)

      if (shouldStartTrialAfterLogin) {
        try {
          window.localStorage.removeItem("wizytaok_trial_intent")
        } catch {
          // ignore storage failures
        }
      }

      let dest = postLoginPath ?? (profile ? "/dashboard" : "/settings?setup=business")

      if (!postLoginPath && shouldStartTrialAfterLogin) {
        if (!profile?.id) {
          dest = "/settings?setup=business"
        } else {
          dest = await resolveBillingChoiceRedirect()
        }
      } else if (
        !postLoginPath &&
        profile?.id &&
        !isActiveSubscriptionStatus(profile.subscription_status) &&
        !isActiveSubscriptionStatus(profile.stripe_subscription_status)
      ) {
        dest = await resolveBillingChoiceRedirect()
      }

      router.replace(dest)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setError(null)
    setInfo(null)
    setOauthError(null)
    if (!isSupabaseConfigured()) {
      setError(t("auth.supabaseNotConfigured"))
      return
    }
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError(t("auth.enterEmailForReset"))
      return
    }
    const client = getBrowserClient()
    if (!client) {
      setError(t("auth.authError"))
      return
    }
    setSendingReset(true)
    try {
      const origin = window.location.origin
      const { error: resetError } = await client.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
      })
      if (resetError) {
        setError(resetError.message?.trim() || t("auth.resetPasswordError"))
        return
      }
      setInfo(t("auth.resetPasswordEmailSent"))
    } finally {
      setSendingReset(false)
    }
  }

  const handleResendConfirmation = async () => {
    setError(null)
    setInfo(null)
    setOauthError(null)
    if (!isSupabaseConfigured()) {
      setError(t("auth.supabaseNotConfigured"))
      return
    }
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError(t("auth.enterEmailForConfirmation"))
      return
    }
    setSendingConfirmation(true)
    try {
      const sent = await requestSignupConfirmationEmail(
        trimmedEmail,
        postLoginPath ?? "/settings?setup=business",
      )
      if (!sent.ok) {
        setError(t("auth.resendConfirmationError"))
        return
      }
      setInfo(t("auth.resendConfirmationSent"))
    } finally {
      setSendingConfirmation(false)
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
              {t("auth.loginTitle")}
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {t("auth.loginDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <OAuthProviderButtons
              next={postLoginPath ?? "/dashboard"}
              onError={(code) => setOauthError(oauthErrorMessageFromCode(code, t))}
            />
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="login-email">{t("auth.email")}</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">{t("auth.password")}</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl"
                  required
                />
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <button
                    type="button"
                    onClick={() => void handleResetPassword()}
                    disabled={sendingReset || sendingConfirmation}
                    className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60"
                  >
                    {t("auth.forgotPassword")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleResendConfirmation()}
                    disabled={sendingReset || sendingConfirmation}
                    className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60"
                  >
                    {sendingConfirmation ? "…" : t("auth.resendConfirmation")}
                  </button>
                </div>
              </div>
              {oauthError ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {oauthError}
                </p>
              ) : null}
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
              <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading || sendingConfirmation}>
                {loading ? "…" : t("auth.logIn")}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 border-t border-border/70 bg-muted/15 text-center text-sm text-muted-foreground">
            <p className="text-xs leading-relaxed">
              <Link href="/terms" className="underline-offset-4 hover:underline">
                {t("footer.terms")}
              </Link>{" "}
              ·{" "}
              <Link href="/privacy" className="underline-offset-4 hover:underline">
                {t("footer.privacy")}
              </Link>
            </p>
            <p>
              {t("auth.noAccount")}{" "}
              <Link
                href="/signup"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {t("auth.loginSignupCta")}
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
