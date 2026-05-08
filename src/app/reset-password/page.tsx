"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslations } from "@/lib/i18n/use-translations"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  assertPasswordPolicy,
  getPasswordPolicyLiveHint,
  PASSWORD_POLICY_I18N,
} from "@/lib/validation/password-policy"

export default function ResetPasswordPage() {
  const { t } = useTranslations()
  const router = useRouter()
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const passwordLiveHint = React.useMemo(() => {
    const v = getPasswordPolicyLiveHint(password)
    return v ? t(PASSWORD_POLICY_I18N[v]) : null
  }, [password, t])

  const passwordBlocksSubmit = Boolean(passwordLiveHint)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isSupabaseConfigured()) {
      setError(t("auth.supabaseNotConfigured"))
      return
    }
    const pwdViol = assertPasswordPolicy(password)
    if (pwdViol) {
      setError(t(PASSWORD_POLICY_I18N[pwdViol]))
      return
    }
    if (password !== confirmPassword) {
      setError(t("auth.resetPasswordMismatch"))
      return
    }

    const client = getBrowserClient()
    if (!client) {
      setError(t("auth.authError"))
      return
    }

    setLoading(true)
    try {
      const {
        data: { user },
      } = await client.auth.getUser()
      if (!user) {
        setError(t("auth.resetPasswordInvalidSession"))
        return
      }

      const { error: updateError } = await client.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message?.trim() || t("auth.resetPasswordError"))
        return
      }

      await client.auth.signOut()
      router.replace("/login?reset=success")
      router.refresh()
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
              {t("auth.resetPasswordTitle")}
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {t("auth.resetPasswordDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="new-password">{t("auth.resetPasswordNewLabel")}</Label>
                <p className="text-xs text-muted-foreground">{t("auth.passwordRequirementsHint")}</p>
                <Input
                  id="new-password"
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
                <Label htmlFor="confirm-password">{t("auth.resetPasswordConfirmLabel")}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 rounded-xl"
                  minLength={8}
                  required
                />
              </div>
              {error ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                className="h-11 w-full rounded-xl"
                disabled={loading || passwordBlocksSubmit}
              >
                {loading ? "…" : t("auth.resetPasswordSubmit")}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link href="/login" className="underline-offset-4 hover:underline">
                  {t("auth.loginFromSignupCta")}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
