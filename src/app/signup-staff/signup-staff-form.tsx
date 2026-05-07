"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

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
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard"
  return raw
}

export function SignupStaffForm() {
  const { t } = useTranslations()
  const searchParams = useSearchParams()
  const next = safeNext(searchParams.get("next"))

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
    const origin = window.location.origin
    setLoading(true)
    try {
      const { error: signErr } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })
      if (signErr) {
        const msg = signErr.message?.trim()
        setError(msg && msg.length > 0 ? msg : t("auth.signupError"))
        return
      }
      setInfo(t("auth.signupSuccessCheckEmail"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md rounded-2xl border border-border shadow-sm">
      <CardHeader className="space-y-3 text-center">
        <Logo href="/" className="justify-center" />
        <CardTitle className="text-xl">{t("invitations.staffAccount")}</CardTitle>
        <CardDescription>{t("invitations.joinPrompt")}</CardDescription>
      </CardHeader>
      <form onSubmit={(ev) => void onSubmit(ev)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="staff-su-email">{t("auth.email")}</Label>
            <Input
              id="staff-su-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-su-password">{t("auth.password")}</Label>
            <Input
              id="staff-su-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 border-t border-border/80 pt-4">
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
            {t("auth.signupSubmit")}
          </Button>
          <Button type="button" variant="ghost" className="h-9 w-full rounded-xl text-sm" asChild>
            <Link href={`/login?next=${encodeURIComponent(next)}`}>{t("auth.loginFromSignupCta")}</Link>
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
