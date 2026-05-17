"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PUBLIC_BOOKINGS_STORAGE_KEY } from "@/lib/bookings/public-bookings"
import { cancelPublicBookingViaApi } from "@/lib/bookings/public-cancel-booking-client"
import {
  getBookingByConfirmationToken,
  updateBookingByConfirmationToken,
} from "@/lib/bookings/bookings-store"
import { parseLocalDateKey } from "@/components/booking/public-booking-calendar"
import { useTranslations } from "@/lib/i18n/use-translations"
import {
  confirmedReminderCopyKey,
  resolveConfirmationReminderPending,
} from "@/lib/appointments/confirm-reminder-copy-client"
import { normalizePublicSlug } from "@/lib/business/slug"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { BusinessReminderChannelPersisted } from "@/types/domain"
import type { PublicBooking } from "@/lib/bookings/public-bookings"

function reminderCopyKey(
  channel: BusinessReminderChannelPersisted | null,
  prefix: "whatNextReminder" | "messageStatusReminder"
): `bookingPublic.${typeof prefix}Both` | `bookingPublic.${typeof prefix}Email` | `bookingPublic.${typeof prefix}Sms` {
  const ch = channel ?? "both"
  if (ch === "email") return `bookingPublic.${prefix}Email`
  if (ch === "sms") return `bookingPublic.${prefix}Sms`
  return `bookingPublic.${prefix}Both`
}

type StoredBookingLegacy = {
  id: string
  businessSlug?: string
  serviceName?: string
  durationMinutes?: number
  price?: number
  /** YYYY-MM-DD */
  day?: string
  date?: string
  time?: string
  fullName?: string
  phone?: string
  email?: string
  note?: string
}

type StoredBooking = StoredBookingLegacy & {
  customerName?: string
  customerPhone?: string
}

type DisplaySummary = {
  id: string
  confirmationToken?: string
  serviceName: string
  day: string
  time: string
  fullName: string
  phone: string
  email?: string
}

function pickLatestBooking(
  slug: string,
  items: StoredBookingLegacy[]
): StoredBooking | null {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const raw = items[i]
    if (normalizePublicSlug(String(raw?.businessSlug ?? "")) === slug) {
      const day = typeof raw.day === "string" ? raw.day : raw.date ?? ""
      const name =
        typeof (raw as StoredBooking).customerName === "string"
          ? (raw as StoredBooking).customerName
          : raw.fullName
      const phone =
        typeof (raw as StoredBooking).customerPhone === "string"
          ? (raw as StoredBooking).customerPhone
          : raw.phone
      const bookId = typeof raw.id === "string" ? raw.id : ""

      if (!day || !name || !phone || !bookId) continue

      return {
        ...raw,
        id: bookId,
        day,
        serviceName: raw.serviceName ?? "",
        fullName: name ?? "",
        phone: phone ?? "",
        time: typeof raw.time === "string" ? raw.time : "09:00",
      }
    }
  }
  return null
}

export default function PublicBookingSuccessPage() {
  const { t, language } = useTranslations()
  const router = useRouter()
  const params = useParams<{ businessSlug: string }>()
  const searchParams = useSearchParams()
  const businessSlug = params.businessSlug
  const normalizedSlug = normalizePublicSlug(decodeURIComponent(String(businessSlug ?? "")))
  const tokenFromQuery = (searchParams.get("token") ?? "").trim()

  const [summary, setSummary] = React.useState<DisplaySummary | null>(null)
  const [loadError, setLoadError] = React.useState(false)
  const [loading, setLoading] = React.useState(Boolean(tokenFromQuery))
  const [publicBooking, setPublicBooking] = React.useState<PublicBooking | null>(null)
  const [reminderChannel, setReminderChannel] =
    React.useState<BusinessReminderChannelPersisted | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null)
  const [returningToBooking, setReturningToBooking] = React.useState(false)
  const popstateHandlingRef = React.useRef(false)

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!tokenFromQuery) {
        setLoading(false)
        setLoadError(false)
        queueMicrotask(() => {
          try {
            const raw = window.localStorage.getItem(PUBLIC_BOOKINGS_STORAGE_KEY)
            const parsed = raw ? JSON.parse(raw) : []
            if (!Array.isArray(parsed)) {
              setSummary(null)
              return
            }
            const list = parsed as StoredBookingLegacy[]
            const picked = pickLatestBooking(normalizedSlug, list)
            if (!picked) {
              setSummary(null)
              return
            }
            setSummary({
              id: picked.id,
              serviceName: picked.serviceName ?? "",
              day: picked.day ?? "",
              time: picked.time ?? "",
              fullName: picked.fullName ?? "",
              phone: picked.phone ?? "",
              email: typeof picked.email === "string" ? picked.email.trim() || undefined : undefined,
            })
          } catch {
            setSummary(null)
          }
        })
        return
      }
      setLoading(true)
      setLoadError(false)
      const client = getBrowserClient()
      if (!isSupabaseConfigured() || !client) {
        if (!cancelled) {
          setLoading(false)
          setLoadError(true)
        }
        return
      }
      const b = await getBookingByConfirmationToken(client, tokenFromQuery)
      if (cancelled) return
      if (!b) {
        setSummary(null)
        setLoadError(true)
        setLoading(false)
        return
      }
      setSummary({
        id: b.id,
        confirmationToken: b.confirmationToken,
        serviceName: b.serviceName,
        day: b.date,
        time: b.time,
        fullName: b.customerName,
        phone: b.customerPhone,
        email: b.customerEmail?.trim() || undefined,
      })
      setPublicBooking(b)
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [normalizedSlug, tokenFromQuery])

  React.useEffect(() => {
    if (!normalizedSlug) return
    const client = getBrowserClient()
    if (!isSupabaseConfigured() || !client) return
    let cancelled = false
    void (async () => {
      const { data } = await client
        .from("business_profiles")
        .select("reminder_channel")
        .eq("slug", normalizedSlug)
        .maybeSingle()
      if (cancelled || !data?.reminder_channel) return
      const ch = data.reminder_channel
      if (ch === "sms" || ch === "email" || ch === "both") {
        setReminderChannel(ch)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [normalizedSlug])

  const fmtDay = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [language]
  )

  const dayIso = summary?.day ?? ""
  const customerEmail = (publicBooking?.customerEmail ?? summary?.email ?? "").trim()
  const hasEmail = customerEmail.length > 0
  const statusLabel = React.useMemo(() => {
    if (!publicBooking) return t("confirmPublic.labelStatusPending")
    if (publicBooking.status === "confirmed") return t("confirmPublic.labelStatusConfirmed")
    if (publicBooking.status === "cancelled") return t("confirmPublic.labelStatusCancelled")
    return t("confirmPublic.labelStatusPending")
  }, [publicBooking, t])

  const runActionWithFallback = React.useCallback(
    async (action: "confirm" | "cancel") => {
      const client = getBrowserClient()
      if (!client || !tokenFromQuery) return { ok: false as const }
      const first = await updateBookingByConfirmationToken(client, tokenFromQuery, action, {})
      if (first.ok) return first
      const fallbackToken = publicBooking?.id?.trim() ?? ""
      if (!fallbackToken || fallbackToken === tokenFromQuery) return first
      return updateBookingByConfirmationToken(client, fallbackToken, action, {})
    },
    [publicBooking?.id, tokenFromQuery]
  )

  const refreshBooking = React.useCallback(async () => {
    const client = getBrowserClient()
    if (!client || !tokenFromQuery) return
    const b = await getBookingByConfirmationToken(client, tokenFromQuery)
    if (!b) return
    setPublicBooking(b)
    setSummary({
      id: b.id,
      confirmationToken: b.confirmationToken,
      serviceName: b.serviceName,
      day: b.date,
      time: b.time,
      fullName: b.customerName,
      phone: b.customerPhone,
      email: b.customerEmail?.trim() || undefined,
    })
  }, [tokenFromQuery])

  const handleConfirm = React.useCallback(async () => {
    setActionError(null)
    setActionSuccess(null)
    const reminderToken = (publicBooking?.confirmationToken ?? tokenFromQuery).trim()

    let pending: boolean | null = null
    try {
      if (reminderToken.length > 0) {
        pending = await resolveConfirmationReminderPending(reminderToken, async () => {
          const r = await runActionWithFallback("confirm")
          if (!r.ok) {
            throw new Error("confirm_failed")
          }
          await refreshBooking()
        })
      } else {
        const r = await runActionWithFallback("confirm")
        if (!r.ok) {
          setActionError(t("bookings.createFailed"))
          return
        }
        await refreshBooking()
      }
    } catch {
      setActionError(t("bookings.createFailed"))
      return
    }

    setActionSuccess(t(confirmedReminderCopyKey(pending)))
  }, [publicBooking?.confirmationToken, refreshBooking, runActionWithFallback, t, tokenFromQuery])

  const cancelViaSupabase = React.useCallback(async () => {
    const token = (publicBooking?.confirmationToken ?? tokenFromQuery).trim()
    if (!token) return false
    const res = await cancelPublicBookingViaApi(token, language)
    return res.ok
  }, [language, publicBooking?.confirmationToken, tokenFromQuery])

  const handleCancel = React.useCallback(async () => {
    setActionError(null)
    setActionSuccess(null)
    const ok = await cancelViaSupabase()
    if (!ok) {
      setActionError(t("bookings.createFailed"))
      return
    }
    await refreshBooking()
    setActionSuccess(t("confirmPublic.successCancelled"))
  }, [cancelViaSupabase, refreshBooking, t])

  const cancelIfNeeded = React.useCallback(async () => {
    if (!tokenFromQuery || !publicBooking || publicBooking.status === "cancelled") return
    const ok = await cancelViaSupabase()
    if (ok) {
      await refreshBooking()
    }
  }, [cancelViaSupabase, publicBooking, refreshBooking, tokenFromQuery])

  const handleBackToBooking = React.useCallback(async () => {
    if (returningToBooking) return
    const targetHref = `/rezerwacje/${encodeURIComponent(String(businessSlug))}`
    setReturningToBooking(true)
    try {
      await cancelIfNeeded()
    } finally {
      router.push(targetHref)
    }
  }, [
    returningToBooking,
    businessSlug,
    cancelIfNeeded,
    router,
  ])

  React.useEffect(() => {
    if (!tokenFromQuery || !summary?.id) return
    const backGuardState = { bookingSuccessGuard: true }
    try {
      window.history.pushState(backGuardState, "", window.location.href)
    } catch {
      // ignore
    }
    const onPopState = () => {
      if (popstateHandlingRef.current) return
      popstateHandlingRef.current = true
      void (async () => {
        try {
          await cancelIfNeeded()
        } finally {
          router.replace(`/rezerwacje/${encodeURIComponent(String(businessSlug))}`)
        }
      })()
    }
    window.addEventListener("popstate", onPopState)
    return () => {
      window.removeEventListener("popstate", onPopState)
    }
  }, [tokenFromQuery, summary?.id, cancelIfNeeded, router, businessSlug])

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-xl">
          <p className="text-sm text-muted-foreground">{t("bookings.loading")}</p>
        </div>
      </main>
    )
  }

  if (tokenFromQuery && loadError) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-xl">
          <Card className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20 shadow-sm shadow-slate-900/5">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">{t("bookings.notFound")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("bookings.loadFailed")}</p>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">{t("confirmPublic.backHome")}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-xl">
        <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">
              {t("bookingPublic.bookingSavedTitle")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {hasEmail
                ? t("bookingPublic.bookingSavedDescription")
                : t("bookingPublic.bookingSavedDescriptionNoEmail")}
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">{t("bookingPublic.service")}:</span>{" "}
              <span className="font-medium text-foreground">
                {summary?.serviceName ?? t("bookingPublic.noSelection")}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">{t("bookingPublic.time")}:</span>{" "}
              <span className="font-medium text-foreground">
                {dayIso.length > 0
                  ? `${fmtDay.format(parseLocalDateKey(dayIso))}, ${summary?.time ?? ""}`
                  : t("bookingPublic.noSelection")}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">{t("bookingPublic.clientDetails")}:</span>{" "}
              <span className="font-medium text-foreground">
                {summary
                  ? `${summary.fullName} (${summary.phone})`
                  : t("bookingPublic.noSelection")}
              </span>
            </p>
            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-sm font-semibold text-foreground">{t("bookingPublic.whatNextTitle")}</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {hasEmail ? <li>- {t("bookingPublic.whatNextEmailNote")}</li> : null}
                <li>- {t(reminderCopyKey(reminderChannel, "whatNextReminder"))}</li>
                <li>- {t("confirmPublic.changeOptionsRemovedInfo")}</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-sm font-semibold text-foreground">{t("bookingPublic.messageStatusTitle")}</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {hasEmail ? <li>- {t("bookingPublic.messageStatusEmailInfo")}</li> : null}
                <li>- {t(reminderCopyKey(reminderChannel, "messageStatusReminder"))}</li>
              </ul>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {tokenFromQuery && publicBooking ? (
                <div className="mt-2 rounded-xl border border-border bg-muted/20 p-3 text-sm">
                  <p className="font-semibold text-foreground">{t("confirmPublic.confirmAttendanceTitle")}</p>
                  <p className="mt-1 text-muted-foreground">{t("confirmPublic.confirmAttendanceDescription")}</p>
                  <p className="mt-2 font-medium text-foreground">
                    {t("confirmPublic.statusLinePending").replace(
                      t("confirmPublic.labelStatusPending"),
                      statusLabel
                    )}
                  </p>
                  {actionError ? (
                    <p className="mt-2 text-sm text-destructive">{actionError}</p>
                  ) : null}
                  {actionSuccess ? (
                    <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">{actionSuccess}</p>
                  ) : null}
                  <div className="mt-3 flex flex-col gap-2">
                    {publicBooking.status !== "confirmed" && publicBooking.status !== "cancelled" ? (
                      <Button className="w-full" onClick={() => void handleConfirm()}>
                        {t("confirmPublic.confirmAttendanceAction")}
                      </Button>
                    ) : null}
                    {publicBooking.status !== "cancelled" ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => void handleCancel()}
                      >
                        {t("confirmPublic.cancelAppointmentAction")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => void handleBackToBooking()}
                disabled={returningToBooking}
              >
                {t("bookingPublic.backToBooking")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
