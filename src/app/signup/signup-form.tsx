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
  buildSignupConfirmationRedirectUrl,
  requestSignupConfirmationEmail,
} from "@/lib/auth/signup-confirmation-client"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"
import {
  persistReferralCodeClient,
  readReferralCodeClient,
} from "@/lib/referrals/referral-storage-client"
import {
  assertPasswordPolicy,
  getPasswordPolicyLiveHint,
  PASSWORD_POLICY_I18N,
} from "@/lib/validation/password-policy"

type SignupFormProps = {
  startTrial?: boolean
}

export function SignupForm({ startTrial = false }: SignupFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslations()
  const oauthErrorCode = searchParams.get("oauth_error")
  const referralFromUrl = searchParams.get("ref") ?? searchParams.get("referral")

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [oauthError, setOauthError] = React.useState<string | null>(() =>
    oauthErrorCode ? oauthErrorMessageFromCode(oauthErrorCode, t) : null,
  )
  const [info, setInfo] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [sendingConfirmation, setSendingConfirmation] = React.useState(false)

  const afterConfirmPath = startTrial ? "/start-trial" : "/settings?setup=business"
  const loginHref = startTrial ? "/login?next=%2Fstart-trial" : "/login"

  React.useEffect(() => {
    queueMicrotask(() => {
      setOauthError(oauthErrorCode ? oauthErrorMessageFromCode(oauthErrorCode, t) : null)
    })
  }, [oauthErrorCode, t])

  React.useEffect(() => {
    persistReferralCodeClient(referralFromUrl)
  }, [referralFromUrl])

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

  const persistTrialIntent = React.useCallback(() => {
    if (!startTrial) return
    try {
      document.cookie = "wizytaok_trial_intent=1; Max-Age=86400; Path=/; SameSite=Lax"
      window.localStorage.setItem("wizytaok_trial_intent", "1")
    } catch {
      /* ignore */
    }
  }, [startTrial])

  const persistSignupAttribution = React.useCallback(() => {
    persistTrialIntent()
    const storedReferral = readReferralCodeClient()
    if (storedReferral) {
      persistReferralCodeClient(storedReferral)
    } else {
      persistReferralCodeClient(referralFromUrl)
    }
  }, [persistTrialIntent, referralFromUrl])

  const passwordLiveHint = React.useMemo(() => {
    const v = getPasswordPolicyLiveHint(password)
    return v ? t(PASSWORD_POLICY_I18N[v]) : null
  }, [password, t])

  const passwordBlocksSubmit = Boolean(passwordLiveHint)
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword

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

    const pwdViol = assertPasswordPolicy(password)
    if (pwdViol) {
      setError(t(PASSWORD_POLICY_I18N[pwdViol]))
      return
    }
    if (password !== confirmPassword) {
      setError(t("auth.passwordRepeatMismatch"))
      return
    }

    setLoading(true)
    try {
      persistSignupAttribution()
      const referralCode = readReferralCodeClient() ?? persistReferralCodeClient(referralFromUrl)
      const signupMetadata: Record<string, unknown> = {}
      if (startTrial) signupMetadata.trial_intent = true
      if (referralCode) signupMetadata.referral_code = referralCode

      const { data: authData, error: signErr } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: buildSignupConfirmationRedirectUrl(afterConfirmPath, window.location.origin),
          data: Object.keys(signupMetadata).length > 0 ? signupMetadata : undefined,
        },
      })

      if (signErr) {
        const msg = signErr.message?.trim()
        setError(msg && msg.length > 0 ? msg : t("auth.signupError"))
        return
      }

      if (!authData.user?.id) {
        setError(t("auth.signupUserCreateFailed"))
        return
      }

      await client.auth.signOut()
      setInfo(t("auth.signupSuccessCheckEmail"))
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    setError(null)
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
      const sent = await requestSignupConfirmationEmail(trimmedEmail, afterConfirmPath)
      if (!sent.ok) {
        setError(t("auth.resendConfirmationError"))
        return
      }
      setInfo(t("auth.resendConfirmationSent"))
    } finally {
      setSendingConfirmation(false)
    }
  }

  const handleOAuthError = React.useCallback(
    (code: string) => {
      setOauthError(oauthErrorMessageFromCode(code, t))
    },
    [t],
  )

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
          <CardContent className="space-y-5">
            <OAuthProviderButtons
              next={startTrial ? "/start-trial" : "/settings?setup=business"}
              trialIntent={startTrial}
              onBeforeSignIn={persistSignupAttribution}
              onError={handleOAuthError}
            />
            <form className="space-y-4" onSubmit={onSubmit}>
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
              <div className="space-y-2">
                <Label htmlFor="signup-password-repeat">{t("auth.passwordRepeatLabel")}</Label>
                <Input
                  id="signup-password-repeat"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-invalid={passwordMismatch}
                  className={cn(
                    "h-11 rounded-xl",
                    passwordMismatch ? "border-destructive focus-visible:ring-destructive/30" : null,
                  )}
                  minLength={8}
                  required
                />
                {passwordMismatch ? (
                  <p className="text-xs text-destructive" role="alert">
                    {t("auth.passwordRepeatMismatch")}
                  </p>
                ) : null}
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
                <div className="space-y-2" role="status">
                  <p className="text-sm text-muted-foreground">{info}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-lg"
                    onClick={() => void handleResendConfirmation()}
                    disabled={sendingConfirmation}
                  >
                    {sendingConfirmation ? "..." : t("auth.resendConfirmation")}
                  </Button>
                </div>
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
                disabled={loading || sendingConfirmation || passwordBlocksSubmit || passwordMismatch}
              >
                {loading ? "..." : t("auth.signupSubmit")}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 border-t border-border/70 bg-muted/15 text-center text-sm text-muted-foreground">
            <p>
              {t("auth.hasAccount")}{" "}
              <Link
                href={loginHref}
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
