"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PUBLIC_BOOKINGS_STORAGE_KEY } from "@/lib/bookings/public-bookings"
import { cancelPublicBookingViaApi } from "@/lib/bookings/public-cancel-booking-client"
import {
  fetchBookingCreatedNotifyStatus,
  type BookingCreatedNotifyApiResult,
} from "@/lib/bookings/notify-booking-created-client"
import { getBookingByConfirmationToken } from "@/lib/bookings/bookings-store"
import { parseLocalDateKey } from "@/components/booking/public-booking-calendar"
import { useTranslations } from "@/lib/i18n/use-translations"
import { normalizePublicSlug } from "@/lib/business/slug"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { PublicBooking } from "@/lib/bookings/public-bookings"

function pickImmediateNotifySentKey(
  status: BookingCreatedNotifyApiResult | null,
  hasEmail: boolean,
  hasPhone: boolean,
): "bookingPublic.whatNextImmediateNotifySent" | "bookingPublic.whatNextImmediateNotifySentSmsOnly" | "bookingPublic.whatNextImmediateNotifySentEmailOnly" | "bookingPublic.whatNextImmediateNotifySafe" {
  if (!status?.ok || (!hasEmail && !hasPhone)) {
    return "bookingPublic.whatNextImmediateNotifySafe"
  }
  const emailOk =
    !hasEmail || status.email === "sent" || status.email === "already_sent"
  const smsOk = !hasPhone || status.sms === "sent" || status.sms === "already_sent"
  const emailFailed = hasEmail && status.email === "failed"
  const smsFailed = hasPhone && status.sms === "failed"
  const emailSent = hasEmail && (status.email === "sent" || status.email === "already_sent")
  const smsSent = hasPhone && (status.sms === "sent" || status.sms === "already_sent")
  if (emailFailed || smsFailed || (!emailSent && !smsSent)) {
    return "bookingPublic.whatNextImmediateNotifySafe"
  }
  if (emailSent && smsSent) return "bookingPublic.whatNextImmediateNotifySent"
  if (smsSent && emailOk) return "bookingPublic.whatNextImmediateNotifySentSmsOnly"
  if (emailSent && smsOk) return "bookingPublic.whatNextImmediateNotifySentEmailOnly"
  return "bookingPublic.whatNextImmediateNotifySafe"
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
  const [returningToBooking, setReturningToBooking] = React.useState(false)
  const [bookingCreatedNotifyStatus, setBookingCreatedNotifyStatus] =
    React.useState<BookingCreatedNotifyApiResult | null>(null)
  const popstateHandlingRef = React.useRef(false)
  const popstateReadyRef = React.useRef(false)

  const actionToken = React.useMemo(
    () => (publicBooking?.confirmationToken ?? tokenFromQuery).trim(),
    [publicBooking?.confirmationToken, tokenFromQuery],
  )

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
    if (!tokenFromQuery) return
    let cancelled = false
    void (async () => {
      const status = await fetchBookingCreatedNotifyStatus(tokenFromQuery)
      if (!cancelled) setBookingCreatedNotifyStatus(status)
    })()
    return () => {
      cancelled = true
    }
  }, [tokenFromQuery])

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
  const customerPhone = (publicBooking?.customerPhone ?? summary?.phone ?? "").trim()
  const hasPhone = customerPhone.length > 0
  const immediateNotifyKey = React.useMemo(
    () => pickImmediateNotifySentKey(bookingCreatedNotifyStatus, hasEmail, hasPhone),
    [bookingCreatedNotifyStatus, hasEmail, hasPhone],
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

  const cancelViaSupabase = React.useCallback(async () => {
    if (!actionToken) return false
    const res = await cancelPublicBookingViaApi(actionToken, language)
    return res.ok
  }, [actionToken, language])

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
  }, [returningToBooking, businessSlug, cancelIfNeeded, router])

  React.useEffect(() => {
    if (!tokenFromQuery || !summary?.id) return
    popstateReadyRef.current = false
    const backGuardState = { bookingSuccessGuard: true }
    try {
      window.history.pushState(backGuardState, "", window.location.href)
    } catch {
      // ignore
    }
    const readyTimer = window.setTimeout(() => {
      popstateReadyRef.current = true
    }, 0)
    const onPopState = () => {
      if (!popstateReadyRef.current || popstateHandlingRef.current) return
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
      window.clearTimeout(readyTimer)
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
              {t("bookingPublic.appointmentConfirmedTitle")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{t("bookingPublic.appointmentConfirmedDescription")}</p>
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
            <p className="mt-4 text-sm">
              <span className="text-muted-foreground">{t("bookingPublic.statusLabel")}:</span>{" "}
              <span className="font-medium text-foreground">{t("bookingPublic.statusConfirmed")}</span>
            </p>
            <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/30 p-3">
              {tokenFromQuery ? (
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("bookingPublic.messageStatusTitle")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t(immediateNotifyKey)}</p>
                </div>
              ) : null}
              <div>
                <p className="text-sm font-semibold text-foreground">{t("bookingPublic.remindersSectionTitle")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("bookingPublic.whatNextReminderOnly")}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
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
