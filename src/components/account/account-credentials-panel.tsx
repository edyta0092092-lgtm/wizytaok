"use client"

import * as React from "react"

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

type AccountCredentialsPanelProps = {
  businessId: string
  userEmail: string | null
  isOwner?: boolean
  variant?: "card" | "embedded"
}

export function AccountCredentialsPanel({
  businessId,
  userEmail,
  isOwner = false,
  variant = "card",
}: AccountCredentialsPanelProps) {
  const { t } = useTranslations()

  const [emailDraft, setEmailDraft] = React.useState(userEmail ?? "")
  const [emailBusy, setEmailBusy] = React.useState(false)
  const [emailMsg, setEmailMsg] = React.useState<string | null>(null)
  const [emailErr, setEmailErr] = React.useState<string | null>(null)

  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [passwordBusy, setPasswordBusy] = React.useState(false)
  const [passwordMsg, setPasswordMsg] = React.useState<string | null>(null)
  const [passwordErr, setPasswordErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    setEmailDraft(userEmail ?? "")
  }, [userEmail])

  const passwordLiveHint = React.useMemo(() => {
    const v = getPasswordPolicyLiveHint(newPassword)
    return v ? t(PASSWORD_POLICY_I18N[v]) : null
  }, [newPassword, t])

  const passwordBlocksSubmit = Boolean(passwordLiveHint)

  const syncMemberEmail = async (client: NonNullable<ReturnType<typeof getBrowserClient>>, email: string) => {
    const normalized = email.trim().toLowerCase()
    if (!normalized) return
    await client.rpc("set_business_member_auth_email", {
      p_business_id: businessId,
      p_email: normalized,
    })
  }

  const onChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailMsg(null)
    setEmailErr(null)
    const next = emailDraft.trim().toLowerCase()
    const current = (userEmail ?? "").trim().toLowerCase()
    if (!next) {
      setEmailErr(t("account.emailRequired"))
      return
    }
    if (next === current) {
      setEmailErr(t("account.emailUnchanged"))
      return
    }

    if (!isSupabaseConfigured()) {
      setEmailErr(t("auth.supabaseNotConfigured"))
      return
    }
    const client = getBrowserClient()
    if (!client) {
      setEmailErr(t("auth.authError"))
      return
    }

    setEmailBusy(true)
    try {
      const { error } = await client.auth.updateUser({ email: next })
      if (error) {
        const msg = error.message?.toLowerCase() ?? ""
        if (msg.includes("already") || msg.includes("registered")) {
          setEmailErr(t("auth.emailTaken"))
        } else {
          setEmailErr(error.message?.trim() || t("account.emailChangeError"))
        }
        return
      }
      try {
        await syncMemberEmail(client, next)
      } catch {
        // auth email request succeeded; member mirror is best-effort
      }
      setEmailMsg(t("account.emailChangePending"))
    } finally {
      setEmailBusy(false)
    }
  }

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMsg(null)
    setPasswordErr(null)

    const pwdViol = assertPasswordPolicy(newPassword)
    if (pwdViol) {
      setPasswordErr(t(PASSWORD_POLICY_I18N[pwdViol]))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordErr(t("auth.resetPasswordMismatch"))
      return
    }

    if (!isSupabaseConfigured()) {
      setPasswordErr(t("auth.supabaseNotConfigured"))
      return
    }
    const client = getBrowserClient()
    if (!client) {
      setPasswordErr(t("auth.authError"))
      return
    }

    setPasswordBusy(true)
    try {
      const {
        data: { user },
      } = await client.auth.getUser()
      if (!user) {
        setPasswordErr(t("auth.authError"))
        return
      }

      const { error } = await client.auth.updateUser({
        password: newPassword,
        data: {
          ...user.user_metadata,
          must_change_password: false,
        },
      })
      if (error) {
        setPasswordErr(error.message?.trim() || t("account.passwordChangeError"))
        return
      }
      setNewPassword("")
      setConfirmPassword("")
      setPasswordMsg(t("account.passwordChanged"))
    } finally {
      setPasswordBusy(false)
    }
  }

  const body = (
    <div className="space-y-6">
      <form className="space-y-3" onSubmit={(ev) => void onChangeEmail(ev)}>
        <div className="space-y-2">
          <Label htmlFor="account-login-email">{t("account.loginEmail")}</Label>
          <p className="text-xs text-muted-foreground">{t("account.loginEmailHint")}</p>
          <Input
            id="account-login-email"
            type="email"
            autoComplete="email"
            value={emailDraft}
            onChange={(ev) => setEmailDraft(ev.target.value)}
            className="h-11 rounded-xl"
            required
          />
        </div>
        <Button type="submit" variant="outline" className="h-10 rounded-xl" disabled={emailBusy}>
          {emailBusy ? "…" : t("account.changeEmail")}
        </Button>
        {emailMsg ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
            {emailMsg}
          </p>
        ) : null}
        {emailErr ? (
          <p className="text-sm text-destructive" role="alert">
            {emailErr}
          </p>
        ) : null}
      </form>

      <form className="space-y-3 border-t border-border/70 pt-6" onSubmit={(ev) => void onChangePassword(ev)}>
        <div className="space-y-2">
          <Label htmlFor="account-new-password">{t("account.newPassword")}</Label>
          <p className="text-xs text-muted-foreground">{t("auth.passwordRequirementsHint")}</p>
          <Input
            id="account-new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(ev) => setNewPassword(ev.target.value)}
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
          <Label htmlFor="account-confirm-password">{t("auth.resetPasswordConfirmLabel")}</Label>
          <Input
            id="account-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(ev) => setConfirmPassword(ev.target.value)}
            className="h-11 rounded-xl"
            minLength={8}
            required
          />
        </div>
        <Button
          type="submit"
          className="h-10 rounded-xl"
          disabled={passwordBusy || passwordBlocksSubmit}
        >
          {passwordBusy ? "…" : t("account.changePassword")}
        </Button>
        {passwordMsg ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
            {passwordMsg}
          </p>
        ) : null}
        {passwordErr ? (
          <p className="text-sm text-destructive" role="alert">
            {passwordErr}
          </p>
        ) : null}
      </form>

      {isOwner ? (
        <p className="text-xs text-muted-foreground">{t("account.ownerBusinessEmailNote")}</p>
      ) : null}
    </div>
  )

  if (variant === "embedded") {
    return body
  }

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
      <CardHeader className="border-b border-border/70 py-4">
        <CardTitle className="text-sm font-semibold">{t("account.credentialsTitle")}</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {t("account.credentialsDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">{body}</CardContent>
    </Card>
  )
}
