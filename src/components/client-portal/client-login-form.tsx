"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { OAuthProviderButtons } from "@/components/auth/oauth-provider-buttons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CLIENT_ACCOUNT_TYPE } from "@/lib/client-portal/client-portal-auth"
import { oauthErrorMessageFromCode } from "@/components/auth/oauth-provider-buttons"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"

export function ClientLoginForm() {
  const { t } = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get("next") ?? "/konto"

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [mode, setMode] = React.useState<"login" | "signup">("login")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const code = searchParams.get("oauth_error")
    if (code) {
      setError(oauthErrorMessageFromCode(code, t))
    }
  }, [searchParams, t])

  const redirectAfterAuth = () => {
    router.replace(nextPath.startsWith("/konto") ? nextPath : "/konto")
    router.refresh()
  }

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

    const loginEmail = email.trim().toLowerCase()
    setLoading(true)
    try {
      if (mode === "signup") {
        const origin = window.location.origin.replace(/\/$/, "")
        const { error: signUpError } = await client.auth.signUp({
          email: loginEmail,
          password: password.trim(),
          options: {
            data: {
              account_type: CLIENT_ACCOUNT_TYPE,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
            },
            emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/konto")}`,
          },
        })
        if (signUpError) {
          setError(signUpError.message)
          return
        }
        toast.success(t("clientPortal.signupCheckEmail"))
        setMode("login")
        return
      }

      const { error: signInError } = await client.auth.signInWithPassword({
        email: loginEmail,
        password: password.trim(),
      })
      if (signInError) {
        setError(signInError.message)
        return
      }
      redirectAfterAuth()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md rounded-2xl border border-border shadow-sm">
      <CardHeader className="space-y-1 border-b border-border/70 py-5">
        <CardTitle className="text-center text-lg">{t("clientPortal.loginTitle")}</CardTitle>
        <CardDescription className="text-center text-xs">
          {t("clientPortal.loginDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <OAuthProviderButtons
          next={nextPath.startsWith("/konto") ? nextPath : "/konto"}
          onError={(code) => setError(oauthErrorMessageFromCode(code, t))}
        />

        <form className="space-y-3" onSubmit={onSubmit}>
          {mode === "signup" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client-first-name">{t("clientPortal.firstName")}</Label>
                <Input
                  id="client-first-name"
                  className="h-10 rounded-xl"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-last-name">{t("clientPortal.lastName")}</Label>
                <Input
                  id="client-last-name"
                  className="h-10 rounded-xl"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="client-email">{t("auth.email")}</Label>
            <Input
              id="client-email"
              type="email"
              autoComplete="email"
              className="h-10 rounded-xl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-password">{t("auth.password")}</Label>
            <Input
              id="client-password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="h-10 rounded-xl"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="h-10 w-full rounded-xl" disabled={loading}>
            {mode === "signup" ? t("clientPortal.signupSubmit") : t("auth.logIn")}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          {mode === "login" ? t("clientPortal.noAccount") : t("clientPortal.hasAccount")}{" "}
          <button
            type="button"
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? t("clientPortal.switchToSignup") : t("clientPortal.switchToLogin")}
          </button>
        </p>

        <p className="text-center text-xs text-muted-foreground">
          {t("clientPortal.businessLoginHint")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("auth.loginTitle")}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
