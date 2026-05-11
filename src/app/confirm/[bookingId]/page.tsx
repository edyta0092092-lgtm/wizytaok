"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  findPublicBookingById,
  updatePublicBooking,
  PUBLIC_BOOKINGS_STORAGE_KEY,
  publicBookingRemoteSyncSignature,
  publicBookingSyncSignature,
  type PublicBooking,
} from "@/lib/bookings/public-bookings"
import {
  getBookingByConfirmationToken,
  updateBookingByConfirmationToken,
} from "@/lib/bookings/bookings-store"
import { enqueueBookingConfirmedNotifications } from "@/lib/notifications/notifications"
import { getBookingStaffDetailValue, shouldShowStaffDetailRow } from "@/lib/staff/staff-display"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"

type Screen = "main" | "cancel"

export default function PublicConfirmAppointmentPage() {
  const { t, language } = useTranslations()
  const params = useParams<{ bookingId: string }>()
  const bookingId = typeof params.bookingId === "string" ? params.bookingId : ""
  const [booking, setBooking] = React.useState<PublicBooking | null>(null)
  const [ready, setReady] = React.useState(false)
  const [screen, setScreen] = React.useState<Screen>("main")
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [slotFlowError, setSlotFlowError] = React.useState<string | null>(null)
  const [showConfirmedReminderBadge, setShowConfirmedReminderBadge] = React.useState(false)
  const screenRef = React.useRef<Screen>("main")
  const bookingPollSigRef = React.useRef("")
  const [remoteRefreshHint, setRemoteRefreshHint] = React.useState(false)
  const [dataSource, setDataSource] = React.useState<"supabase" | "local" | null>(null)
  const confirmToken = React.useMemo(
    () => decodeURIComponent(bookingId || "").trim(),
    [bookingId],
  )

  React.useEffect(() => {
    screenRef.current = screen
  }, [screen])

  const triggerRemoteRefreshHint = React.useCallback(() => {
    setRemoteRefreshHint(true)
    window.setTimeout(() => setRemoteRefreshHint(false), 5200)
  }, [])

  const reloadLocalBooking = React.useCallback(() => {
    if (!confirmToken) {
      setBooking(null)
      setDataSource(null)
      return
    }
    const item = findPublicBookingById(confirmToken)
    setBooking(item ?? null)
    setDataSource(item ? "local" : null)
    bookingPollSigRef.current = publicBookingSyncSignature(confirmToken)
  }, [confirmToken])

  const refreshSupabaseBooking = React.useCallback(async () => {
    const client = getBrowserClient()
    if (!client || !confirmToken) return
    const next = await getBookingByConfirmationToken(client, confirmToken)
    setBooking(next)
    bookingPollSigRef.current = publicBookingRemoteSyncSignature(next)
  }, [confirmToken])

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      setReady(false)
      setBooking(null)
      setDataSource(null)
      if (!confirmToken) {
        if (!cancelled) setReady(true)
        return
      }
      const client = getBrowserClient()
      if (isSupabaseConfigured() && client) {
        const sb = await getBookingByConfirmationToken(client, confirmToken)
        if (cancelled) return
        if (sb) {
          setBooking(sb)
          bookingPollSigRef.current = publicBookingRemoteSyncSignature(sb)
          setDataSource("supabase")
          setReady(true)
          return
        }
      }
      if (cancelled) return
      const loc = findPublicBookingById(confirmToken)
      setBooking(loc ?? null)
      setDataSource(loc ? "local" : null)
      bookingPollSigRef.current = loc
        ? publicBookingSyncSignature(confirmToken)
        : publicBookingRemoteSyncSignature(null, confirmToken)
      setReady(true)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [confirmToken])

  React.useEffect(() => {
    if (!confirmToken || dataSource !== "supabase") return
    const tick = () => {
      void (async () => {
        if (screenRef.current !== "main") return
        const client = getBrowserClient()
        if (!client) return
        const next = await getBookingByConfirmationToken(client, confirmToken)
        const sig = publicBookingRemoteSyncSignature(next)
        if (sig === bookingPollSigRef.current) return
        bookingPollSigRef.current = sig
        setBooking(next)
        triggerRemoteRefreshHint()
      })()
    }
    const intervalId = window.setInterval(tick, 1700)
    return () => window.clearInterval(intervalId)
  }, [confirmToken, dataSource, triggerRemoteRefreshHint])

  React.useEffect(() => {
    if (dataSource !== "local") return
    const onStorage = (e: StorageEvent) => {
      if (!confirmToken || e.key !== PUBLIC_BOOKINGS_STORAGE_KEY) return
      if (screenRef.current !== "main") return
      const sig = publicBookingSyncSignature(confirmToken)
      if (sig === bookingPollSigRef.current) return
      bookingPollSigRef.current = sig
      setBooking(findPublicBookingById(confirmToken) ?? null)
      triggerRemoteRefreshHint()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [confirmToken, dataSource, triggerRemoteRefreshHint])

  React.useEffect(() => {
    if (screen !== "main" || dataSource !== "local") return
    queueMicrotask(reloadLocalBooking)
  }, [screen, confirmToken, dataSource, reloadLocalBooking])

  const applyLocalPatch = React.useCallback(
    (patch: Partial<PublicBooking>) => {
      if (!booking) return
      updatePublicBooking(booking.id, { ...patch, updatedAt: new Date().toISOString() })
      reloadLocalBooking()
    },
    [booking, reloadLocalBooking],
  )

  const fmtDay = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [language],
  )

  const formatSecondReminderDate = (rawIso: string) =>
    new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(rawIso))

  if (!ready) {
    return (
      <main className="min-h-screen bg-background px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-xl">
          <p className="text-sm text-muted-foreground">{t("bookings.loading")}</p>
        </div>
      </main>
    )
  }

  if (!booking) {
    return (
      <main className="min-h-screen bg-background px-4 py-10 sm:px-6">
        <Card className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-card via-card to-muted/25 shadow-lg shadow-slate-900/10">
          <CardHeader className="space-y-2 border-b border-border/60 bg-muted/15 pb-4">
            <CardTitle className="text-xl font-semibold tracking-tight">{t("bookings.notFound")}</CardTitle>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("confirmPublic.notFoundBody")}</p>
          </CardHeader>
          <CardContent className="pt-5">
            <Button asChild className="w-full rounded-xl">
              <Link href="/">{t("confirmPublic.backHome")}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  const when = `${fmtDay.format(new Date(`${booking.date}T00:00:00`))}, ${booking.time}`
  const isCancelled = booking.status === "cancelled"
  const isNoShow = booking.status === "no_show"
  const isBooked = booking.status === "booked" || booking.status === "pending"
  const canAct =
    booking.status === "booked" ||
    booking.status === "pending" ||
    booking.status === "confirmed"
  const bookingBackHref = booking.businessSlug?.trim()
    ? `/rezerwacje/${encodeURIComponent(booking.businessSlug.trim())}`
    : "/"

  const runConfirmRpcWithFallback = async (
    action: "confirm" | "cancel",
    payload: Record<string, unknown> = {},
  ) => {
    const client = getBrowserClient()
    if (!client) return { ok: false as const, error: "no_client" }
    const first = await updateBookingByConfirmationToken(client, confirmToken, action, payload)
    if (first.ok) return first
    const fallbackToken = booking?.id?.trim() ?? ""
    if (!fallbackToken || fallbackToken === confirmToken) return first
    const second = await updateBookingByConfirmationToken(client, fallbackToken, action, payload)
    return second.ok ? second : first
  }

  const confirmAttendance = () => {
    void (async () => {
      if (dataSource === "supabase") {
        const confirmed = await runConfirmRpcWithFallback("confirm", {})
        if (!confirmed.ok) {
          setSlotFlowError(t("bookings.createFailed"))
          return
        }
        setSlotFlowError(null)
        void fetch("/api/public/confirm-attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: confirmToken, language }),
        }).catch(() => undefined)
        const client = getBrowserClient()
        if (!client) {
          setSuccessMessage(t("confirmPublic.successConfirmed"))
          setShowConfirmedReminderBadge(true)
          return
        }
        const fresh = await getBookingByConfirmationToken(client, confirmToken)
        if (fresh) {
          setBooking(fresh)
        } else {
          await refreshSupabaseBooking()
        }
        setSuccessMessage(t("confirmPublic.successConfirmed"))
        setShowConfirmedReminderBadge(true)
        return
      }
      applyLocalPatch({ status: "confirmed", lastUpdatedBy: "customer" })
      const fresh = findPublicBookingById(confirmToken)
      if (fresh) enqueueBookingConfirmedNotifications(fresh, language)
      setSuccessMessage(t("confirmPublic.successConfirmed"))
      setShowConfirmedReminderBadge(true)
    })()
  }

  const cancelAppointment = () => {
    void (async () => {
      if (dataSource === "supabase") {
        const client = getBrowserClient()
        if (!client) return
        const r = await runConfirmRpcWithFallback("cancel", {})
        if (!r.ok) return
        void fetch("/api/public/cancel-booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: confirmToken, language }),
        }).catch(() => undefined)
        await refreshSupabaseBooking()
        setScreen("main")
        setSuccessMessage(t("confirmPublic.successCancelled"))
        setShowConfirmedReminderBadge(false)
        return
      }
      applyLocalPatch({ status: "cancelled", lastUpdatedBy: "customer" })
      setScreen("main")
      setSuccessMessage(t("confirmPublic.successCancelled"))
      setShowConfirmedReminderBadge(false)
    })()
  }

  const secondReminderLabel = (() => {
    const raw = booking.secondReminderDueAt?.trim()
    if (!raw) return null
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) return null
    return formatSecondReminderDate(parsed.toISOString())
  })()

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        {remoteRefreshHint ? (
          <div
            className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2 text-sm leading-relaxed text-muted-foreground"
            role="status"
          >
            {t("confirmPublic.bookingDetailsRefreshedBanner")}
          </div>
        ) : null}
        {slotFlowError ? (
          <div
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {slotFlowError}
          </div>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>
              {isCancelled
                ? t("confirmPublic.labelStatusCancelled")
                : isNoShow
                  ? t("labels.appointmentStatus.no_show")
                : isBooked
                  ? t("confirmPublic.confirmAttendanceTitle")
                  : t("confirmPublic.confirmedTitle")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {isCancelled
                ? t("confirmPublic.notFoundBody")
                : isNoShow
                  ? t("labels.appointmentStatusDescription.no_show")
                : isBooked
                  ? t("confirmPublic.confirmAttendanceDescription")
                  : t("confirmPublic.confirmedDescription")}
            </p>
            {!isCancelled && !isNoShow && (booking.status === "confirmed" || booking.status === "booked" || booking.status === "pending") ? (
              <div className="space-y-1 pt-1 text-sm">
                <p className="font-medium text-foreground">
                  {booking.status === "confirmed"
                    ? t("confirmPublic.statusLineConfirmed")
                    : booking.status === "pending"
                      ? t("confirmPublic.statusLinePending")
                      : t("confirmPublic.statusLineBooked")}
                </p>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-2">
              <p>
                <span className="text-muted-foreground">{t("confirmPublic.cardService")}:</span>{" "}
                {booking.serviceName}
              </p>
              {shouldShowStaffDetailRow(booking) ? (
                <p>
                  <span className="text-muted-foreground">{t("appointments.fieldStaff")}:</span>{" "}
                  {getBookingStaffDetailValue(booking, t)}
                </p>
              ) : null}
              <p>
                <span className="text-muted-foreground">{t("confirmPublic.cardTime")}:</span> {when}
              </p>
              {booking.lastUpdatedBy ? (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">{t("confirmPublic.lastUpdateByLabel")}:</span>{" "}
                  {booking.lastUpdatedBy === "customer"
                    ? t("confirmPublic.lastUpdateByCustomer")
                    : booking.lastUpdatedBy === "system"
                      ? t("confirmPublic.lastUpdateBySystem")
                      : t("confirmPublic.lastUpdateByBusiness")}
                </p>
              ) : null}
              {successMessage ? (
                <p className="pt-2 font-medium text-emerald-700 dark:text-emerald-300">{successMessage}</p>
              ) : null}
              {showConfirmedReminderBadge ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                  {secondReminderLabel
                    ? `${t("confirmPublic.confirmedReminderInfoPrefix")} ${secondReminderLabel}. ${t("confirmPublic.confirmedReminderInfoSuffix")}`
                    : t("confirmPublic.confirmedReminderInfoNoDate")}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {screen === "main" && canAct ? (
          <Card>
            <CardContent className="space-y-2 p-4">
              {isBooked ? (
                <Button className="w-full" onClick={confirmAttendance}>
                  {t("confirmPublic.confirmAttendanceAction")}
                </Button>
              ) : null}
              <Button variant="outline" className="w-full" onClick={() => setScreen("cancel")}>
                {isBooked ? t("confirmPublic.wantCancel") : t("confirmPublic.actionCancel")}
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={bookingBackHref}>{t("confirmPublic.backToOnlineBookingSystem")}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {screen === "cancel" && canAct ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("confirmPublic.cancelPanelTitle")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("confirmPublic.cancelPanelDescription")}</p>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setScreen("main")}>
                {t("confirmPublic.cancelConfirmNo")}
              </Button>
              <Button className="flex-1" onClick={cancelAppointment}>
                {t("confirmPublic.cancelConfirmYes")}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!canAct ? (
          <div className="flex justify-center">
            <Button asChild variant="outline" className="w-full max-w-md">
              <Link href={bookingBackHref}>{t("confirmPublic.backToOnlineBookingSystem")}</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  )
}
