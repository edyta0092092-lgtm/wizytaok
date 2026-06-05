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
import { PublicReschedulePicker } from "@/components/booking/public-reschedule-picker"
import { cancelPublicBookingViaApi } from "@/lib/bookings/public-cancel-booking-client"
import { reschedulePublicBookingViaApi } from "@/lib/bookings/public-reschedule-booking-client"
import { getBookingByConfirmationToken } from "@/lib/bookings/bookings-store"
import { getBookingStaffDetailValue, shouldShowStaffDetailRow } from "@/lib/staff/staff-display"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function PublicConfirmAppointmentPage() {
  const { t, language } = useTranslations()
  const params = useParams<{ bookingId: string }>()
  const bookingId = typeof params.bookingId === "string" ? params.bookingId : ""
  const [booking, setBooking] = React.useState<PublicBooking | null>(null)
  const [ready, setReady] = React.useState(false)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [slotFlowError, setSlotFlowError] = React.useState<string | null>(null)
  const bookingPollSigRef = React.useRef("")
  const [remoteRefreshHint, setRemoteRefreshHint] = React.useState(false)
  const [cancelling, setCancelling] = React.useState(false)
  const [rescheduling, setRescheduling] = React.useState(false)
  const [showReschedule, setShowReschedule] = React.useState(false)
  const [dataSource, setDataSource] = React.useState<"supabase" | "local" | null>(null)
  const confirmToken = React.useMemo(
    () => decodeURIComponent(bookingId || "").trim(),
    [bookingId],
  )

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
        if (cancelling) return
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
  }, [confirmToken, dataSource, triggerRemoteRefreshHint, cancelling])

  React.useEffect(() => {
    if (dataSource !== "local") return
    const onStorage = (e: StorageEvent) => {
      if (!confirmToken || e.key !== PUBLIC_BOOKINGS_STORAGE_KEY) return
      if (cancelling) return
      const sig = publicBookingSyncSignature(confirmToken)
      if (sig === bookingPollSigRef.current) return
      bookingPollSigRef.current = sig
      setBooking(findPublicBookingById(confirmToken) ?? null)
      triggerRemoteRefreshHint()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [confirmToken, dataSource, triggerRemoteRefreshHint, cancelling])

  React.useEffect(() => {
    if (dataSource !== "local") return
    queueMicrotask(reloadLocalBooking)
  }, [confirmToken, dataSource, reloadLocalBooking])

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

  const confirmReschedule = React.useCallback(
    (newDate: string, newTime: string) => {
      if (rescheduling || !booking) return
      void (async () => {
        const token = (booking.confirmationToken ?? confirmToken).trim()
        setRescheduling(true)
        setSlotFlowError(null)
        try {
          if (dataSource === "supabase") {
            if (!token) {
              setSlotFlowError(t("confirmPublic.rescheduleActionFailed"))
              return
            }
            const apiRes = await reschedulePublicBookingViaApi(token, newDate, newTime, language)
            if (!apiRes.ok) {
              const err = apiRes.error ?? ""
              if (err === "same_slot") {
                setSlotFlowError(t("confirmPublic.rescheduleSameSlot"))
              } else if (err === "slot_unavailable") {
                setSlotFlowError(t("confirmPublic.rescheduleSlotUnavailable"))
              } else {
                setSlotFlowError(t("confirmPublic.rescheduleActionFailed"))
              }
              return
            }
            await refreshSupabaseBooking()
            setShowReschedule(false)
            setSuccessMessage(t("confirmPublic.successRescheduled"))
            return
          }
          applyLocalPatch({ date: newDate, time: newTime, lastUpdatedBy: "customer" })
          setShowReschedule(false)
          setSuccessMessage(t("confirmPublic.successRescheduled"))
        } finally {
          setRescheduling(false)
        }
      })()
    },
    [
      applyLocalPatch,
      booking,
      confirmToken,
      dataSource,
      language,
      refreshSupabaseBooking,
      rescheduling,
      t,
    ],
  )

  const cancelAppointment = React.useCallback(() => {
    if (cancelling || !booking) return
    void (async () => {
      const wasConfirmed = booking.status === "confirmed"
      const cancelledMessage = wasConfirmed
        ? t("confirmPublic.successCancelledConfirmed")
        : t("confirmPublic.successCancelled")
      const cancelToken = (booking.confirmationToken ?? confirmToken).trim()
      setCancelling(true)
      setSlotFlowError(null)
      try {
        if (dataSource === "supabase") {
          if (!cancelToken) {
            setSlotFlowError(t("confirmPublic.cancelActionFailed"))
            return
          }
          const apiRes = await cancelPublicBookingViaApi(cancelToken, language)
          if (!apiRes.ok) {
            setSlotFlowError(t("confirmPublic.cancelActionFailed"))
            return
          }
          await refreshSupabaseBooking()
          setSuccessMessage(cancelledMessage)
          return
        }
        applyLocalPatch({ status: "cancelled", lastUpdatedBy: "customer" })
        setSuccessMessage(cancelledMessage)
      } finally {
        setCancelling(false)
      }
    })()
  }, [
    applyLocalPatch,
    booking,
    cancelling,
    confirmToken,
    dataSource,
    language,
    refreshSupabaseBooking,
    t,
  ])

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
  const isActiveVisit =
    booking.status === "confirmed" ||
    booking.status === "booked" ||
    booking.status === "pending"
  const canCancel = isActiveVisit && !successMessage
  const canReschedule =
    isActiveVisit &&
    !successMessage &&
    dataSource === "supabase" &&
    Boolean(booking.serviceId || booking.serviceName)

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
              {isCancelled || successMessage
                ? t("confirmPublic.labelStatusCancelled")
                : isNoShow
                  ? t("labels.appointmentStatus.no_show")
                  : t("confirmPublic.manageAppointmentTitle")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {isCancelled || successMessage
                ? successMessage ??
                  (isCancelled
                    ? t("bookingPublic.visitCancelledBanner")
                    : t("confirmPublic.notFoundBody"))
                : isNoShow
                  ? t("labels.appointmentStatusDescription.no_show")
                  : t("confirmPublic.manageAppointmentDescription")}
            </p>
            {!isCancelled && !isNoShow && isActiveVisit && !successMessage ? (
              <div className="space-y-1 pt-1 text-sm">
                <p className="font-medium text-foreground">{t("confirmPublic.statusLineConfirmed")}</p>
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
            </div>

            {showReschedule && canReschedule ? (
              <PublicReschedulePicker
                booking={booking}
                submitting={rescheduling}
                onCancel={() => {
                  setShowReschedule(false)
                  setSlotFlowError(null)
                }}
                onConfirm={confirmReschedule}
              />
            ) : null}

            {!showReschedule && canReschedule ? (
              <Button
                type="button"
                className="mt-2 w-full"
                disabled={cancelling || rescheduling}
                onClick={() => {
                  setSlotFlowError(null)
                  setShowReschedule(true)
                }}
              >
                {t("confirmPublic.actionReschedule")}
              </Button>
            ) : null}

            {!showReschedule && canCancel ? (
              <Button
                type="button"
                variant="outline"
                className="mt-2 w-full"
                disabled={cancelling || rescheduling}
                onClick={() => cancelAppointment()}
              >
                {cancelling ? t("bookings.loading") : t("confirmPublic.actionCancel")}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
