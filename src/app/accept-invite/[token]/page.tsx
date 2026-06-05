"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"

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
import { useTranslations } from "@/lib/i18n/use-translations"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function readRpcJson(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null
  return data as Record<string, unknown>
}

export default function AcceptInvitePage() {
  const { t } = useTranslations()
  const router = useRouter()
  const params = useParams()
  const tokenRaw = params?.token
  const token = typeof tokenRaw === "string" ? tokenRaw : ""

  const [busy, setBusy] = React.useState(false)
  const [loadBusy, setLoadBusy] = React.useState(true)
  const [preview, setPreview] = React.useState<{
    businessName: string
    email: string
  } | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [actionMsg, setActionMsg] = React.useState<string | null>(null)

  const dashboardNext = encodeURIComponent("/dashboard")
  const inviteQuery = token ? `&invite=${encodeURIComponent(token)}` : ""
  const loginHref = preview?.email
    ? `/login?next=${dashboardNext}&email=${encodeURIComponent(preview.email)}${inviteQuery}`
    : `/login?next=${dashboardNext}${inviteQuery}`
  const signupHref = preview?.email
    ? `/signup-staff?next=${dashboardNext}&email=${encodeURIComponent(preview.email)}${inviteQuery}`
    : `/signup-staff?next=${dashboardNext}${inviteQuery}`

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadBusy(true)
      setLoadError(null)
      setPreview(null)
      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setLoadError("supabase")
          setLoadBusy(false)
        }
        return
      }
      if (!UUID_RE.test(token)) {
        if (!cancelled) {
          setLoadError("invalid")
          setLoadBusy(false)
        }
        return
      }
      const client = getBrowserClient()
      if (!client) {
        if (!cancelled) {
          setLoadError("client")
          setLoadBusy(false)
        }
        return
      }
      const applyPreview = (businessName: string, email: string) => {
        setPreview({ businessName, email })
        setLoadBusy(false)
      }

      const applyLoadFailure = (err: string, status?: string) => {
        if (err === "not_pending") {
          setLoadError(status === "accepted" ? "used" : "invalid")
        } else if (err === "cancelled") {
          setLoadError("invalid")
        } else {
          setLoadError("invalid")
        }
        setLoadBusy(false)
      }

      const { data, error } = await client.rpc("get_business_invitation_public", {
        p_token: token,
      })
      if (cancelled) return
      if (!error) {
        const row = readRpcJson(data)
        if (row?.ok === true) {
          applyPreview(
            typeof row.business_name === "string" ? row.business_name : "",
            typeof row.email === "string" ? row.email : "",
          )
          return
        }
        const err = typeof row?.error === "string" ? row.error : "not_found"
        const st = typeof row?.status === "string" ? row.status : undefined
        if (err !== "not_found" && err !== "not_pending") {
          applyLoadFailure(err, st)
          return
        }
      }

      try {
        const apiRes = await fetch(
          `/api/public/business-invitation?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        )
        const apiJson = (await apiRes.json().catch(() => null)) as {
          ok?: boolean
          business_name?: string
          email?: string
          error?: string
          status?: string
        } | null
        if (cancelled) return
        if (apiJson?.ok) {
          applyPreview(apiJson.business_name ?? "", apiJson.email ?? "")
          return
        }
        applyLoadFailure(apiJson?.error ?? "not_found", apiJson?.status)
      } catch {
        if (!cancelled) setLoadError("rpc")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const accept = async () => {
    setActionMsg(null)
    if (!UUID_RE.test(token)) return
    const client = getBrowserClient()
    if (!client) return
    setBusy(true)
    try {
      const {
        data: { user },
      } = await client.auth.getUser()
      if (!user) {
        setActionMsg(t("invitations.joinPrompt"))
        return
      }
      const invEmail = preview?.email?.trim().toLowerCase() ?? ""
      const userEmail = user.email?.trim().toLowerCase() ?? ""
      if (invEmail && userEmail && invEmail !== userEmail) {
        setActionMsg(t("invitations.emailMismatch"))
        return
      }
      const finishAccept = () => {
        router.replace("/dashboard")
        router.refresh()
      }

      const mapAcceptError = (err: string, detail?: string) => {
        if (err === "email_mismatch") setActionMsg(t("invitations.emailMismatch"))
        else if (err === "already_used") setActionMsg(t("invitations.alreadyUsed"))
        else if (err === "cancelled") setActionMsg(t("invitations.cancelled"))
        else if (err === "not_authenticated") setActionMsg(t("invitations.joinPrompt"))
        else if (detail?.trim()) setActionMsg(`${t("invitations.invalidOrExpired")} (${detail.trim()})`)
        else setActionMsg(t("invitations.invalidOrExpired"))
      }

      try {
        await fetch("/api/auth/accept-pending-invitations", {
          method: "POST",
          credentials: "same-origin",
        })
      } catch {
        // ignore
      }

      const apiRes = await fetch("/api/public/accept-business-invitation", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const apiJson = (await apiRes.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        detail?: string
      } | null
      if (apiJson?.ok) {
        finishAccept()
        return
      }

      const { data, error } = await client.rpc("accept_business_invitation", { p_token: token })
      if (!error) {
        const row = readRpcJson(data)
        if (row?.ok === true) {
          finishAccept()
          return
        }
        const rpcErr = typeof row?.error === "string" ? row.error : "unknown"
        const rpcDetail = typeof row?.detail === "string" ? row.detail : undefined
        if (rpcErr === "email_mismatch" || rpcErr === "already_used" || rpcErr === "cancelled") {
          mapAcceptError(rpcErr, rpcDetail)
          return
        }
      }

      mapAcceptError(apiJson?.error ?? "unknown", apiJson?.detail)
    } finally {
      setBusy(false)
    }
  }

  const loadErrorMessage =
    loadError === "used"
      ? t("invitations.alreadyUsed")
      : loadError === "invalid" || loadError === "rpc"
        ? t("invitations.invalidOrExpired")
        : loadError === "supabase"
          ? t("auth.supabaseNotConfigured")
          : loadError === "client"
            ? t("auth.authError")
            : null

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-8 w-full max-w-sm">
        <Logo href="/" className="justify-center" />
      </div>
      <Card className="w-full max-w-md rounded-2xl border border-border shadow-sm">
        <CardHeader>
          <CardTitle>{t("invitations.joinBusiness")}</CardTitle>
          <CardDescription>{t("invitations.staffAccount")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadBusy ? (
            <p className="text-sm text-muted-foreground">{"\u00a0"}</p>
          ) : loadErrorMessage ? (
            <p className="text-sm text-destructive">{loadErrorMessage}</p>
          ) : preview ? (
            <>
              <p className="text-sm text-muted-foreground">
                {preview.businessName ? `${preview.businessName} · ` : ""}
                {preview.email}
              </p>
              <p className="text-sm text-muted-foreground">{t("invitations.joinPrompt")}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="h-10 rounded-xl" asChild>
                  <Link href={loginHref}>{t("auth.logIn")}</Link>
                </Button>
                <Button type="button" variant="outline" className="h-10 rounded-xl" asChild>
                  <Link href={signupHref}>{t("auth.loginSignupCta")}</Link>
                </Button>
              </div>
              <Button type="button" className="h-10 w-full rounded-xl" disabled={busy} onClick={() => void accept()}>
                {t("invitations.acceptInvitation")}
              </Button>
            </>
          ) : null}
          {actionMsg ? <p className="text-sm text-muted-foreground">{actionMsg}</p> : null}
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border/80 pt-4">
          <Button type="button" variant="ghost" className="h-9 rounded-xl text-sm" asChild>
            <Link href="/">{t("auth.homeLink")}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
