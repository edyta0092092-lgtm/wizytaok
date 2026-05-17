"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  PUBLIC_BOOKINGS_STORAGE_KEY,
  getPublicBookings,
} from "@/lib/bookings/public-bookings"
import { getBookingByConfirmationToken } from "@/lib/bookings/bookings-store"
import { parseLocalDateKey } from "@/components/booking/public-booking-calendar"
import { useTranslations } from "@/lib/i18n/use-translations"
import { normalizePublicSlug } from "@/lib/business/slug"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { PublicBooking } from "@/lib/bookings/public-bookings"

type StoredBookingLegacy = {
  id: string
  confirmationToken?: string
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
  const popstateHandlingRef = React.useRef(false)
  const popstateReadyRef = React.useRef(false)

  const confirmationToken = React.useMemo(() => {
    const fromQuery = tokenFromQuery.trim()
    if (fromQuery) return fromQuery
    return (publicBooking?.confirmationToken ?? summary?.confirmationToken ?? "").trim()
  }, [publicBooking?.confirmationToken, summary?.confirmationToken, tokenFromQuery])

  const manageAppointmentHref = React.useMemo(() => {
    if (!confirmationToken) return null
    return `/confirm/${encodeURIComponent(confirmationToken)}?source=booking`
  }, [confirmationToken])

  React.useEffect(() => {
    if (loading) return
    if (confirmationToken) return
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[booking.success] Brak confirmation_token — przycisk „Anuluj wizytę” ukryty. Oczekiwany URL: /rezerwacje/.../success?token=...",
      )
    } else {
      console.warn("[booking.success] Missing confirmation_token; cancel link hidden.")
    }
  }, [loading, confirmationToken])

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
            const storedToken =
              typeof picked.confirmationToken === "string" ? picked.confirmationToken.trim() : ""
            setSummary({
              id: picked.id,
              confirmationToken: storedToken || undefined,
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

      const applyPublicBooking = (b: PublicBooking) => {
        setSummary({
          id: b.id,
          confirmationToken: b.confirmationToken ?? tokenFromQuery,
          serviceName: b.serviceName,
          day: b.date,
          time: b.time,
          fullName: b.customerName,
          phone: b.customerPhone,
          email: b.customerEmail?.trim() || undefined,
        })
        setPublicBooking(b)
        setLoadError(false)
        setLoading(false)
      }

      const localByToken = getPublicBookings().find(
        (b) =>
          normalizePublicSlug(b.businessSlug) === normalizedSlug &&
          (b.confirmationToken ?? "").trim() === tokenFromQuery,
      )

      const client = getBrowserClient()
      if (!isSupabaseConfigured() || !client) {
        if (cancelled) return
        if (localByToken) {
          applyPublicBooking(localByToken)
          return
        }
        setSummary(null)
        setLoadError(true)
        setLoading(false)
        return
      }

      const b = await getBookingByConfirmationToken(client, tokenFromQuery)
      if (cancelled) return
      if (!b) {
        if (localByToken) {
          applyPublicBooking(localByToken)
          return
        }
        setSummary(null)
        setLoadError(true)
        setLoading(false)
        return
      }
      applyPublicBooking(b)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [normalizedSlug, tokenFromQuery])

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
      router.replace(`/rezerwacje/${encodeURIComponent(String(businessSlug))}`)
    }
    window.addEventListener("popstate", onPopState)
    return () => {
      window.clearTimeout(readyTimer)
      window.removeEventListener("popstate", onPopState)
    }
  }, [tokenFromQuery, summary?.id, router, businessSlug])

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
              <div>
                <p className="text-sm font-semibold text-foreground">{t("bookingPublic.messageStatusTitle")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("bookingPublic.whatNextImmediateNotifySafe")}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("bookingPublic.remindersSectionTitle")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("bookingPublic.whatNextReminderOnly")}</p>
              </div>
            </div>

            {manageAppointmentHref ? (
              <div className="mt-4">
                <Button asChild variant="outline" className="w-full">
                  <Link href={manageAppointmentHref}>{t("bookingPublic.cancelAppointment")}</Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
