"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"

import { PublicReschedulePicker } from "@/components/booking/public-reschedule-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { clientPortalBookingToPublicBooking } from "@/lib/client-portal/map-booking"
import type { ClientPortalBooking } from "@/lib/client-portal/types"
import { useTranslations } from "@/lib/i18n/use-translations"

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "cancelled") return "destructive"
  if (status === "completed") return "secondary"
  if (status === "confirmed") return "default"
  return "outline"
}

export function ClientAppointmentsList({
  bookings,
  onCancel,
  onReschedule,
  allowActions = true,
}: {
  bookings: ClientPortalBooking[]
  onCancel: (id: string) => Promise<boolean>
  onReschedule?: (id: string, date: string, time: string) => Promise<{ ok: boolean; error?: string }>
  allowActions?: boolean
}) {
  const { t } = useTranslations()
  const [detail, setDetail] = React.useState<ClientPortalBooking | null>(null)
  const [reschedule, setReschedule] = React.useState<ClientPortalBooking | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [rescheduling, setRescheduling] = React.useState(false)

  const statusLabel = (status: string) => {
    const key = `clientPortal.status_${status}` as const
    const translated = t(key)
    return translated === key ? status : translated
  }

  const canManage = (booking: ClientPortalBooking) =>
    allowActions &&
    booking.status !== "cancelled" &&
    booking.status !== "completed" &&
    booking.status !== "no_show" &&
    new Date(booking.startsAtIso).getTime() > Date.now()

  const handleCancel = async (booking: ClientPortalBooking) => {
    if (!window.confirm(t("clientPortal.cancelConfirm"))) return
    setBusyId(booking.id)
    try {
      const ok = await onCancel(booking.id)
      if (ok) toast.success(t("clientPortal.cancelSuccess"))
      else toast.error(t("clientPortal.cancelError"))
    } finally {
      setBusyId(null)
    }
  }

  const handleReschedule = async (date: string, time: string) => {
    if (!reschedule || !onReschedule) return
    setRescheduling(true)
    try {
      const result = await onReschedule(reschedule.id, date, time)
      if (result.ok) {
        toast.success(t("clientPortal.rescheduleSuccess"))
        setReschedule(null)
        return
      }
      const err = result.error ?? ""
      if (err === "same_slot") toast.error(t("clientPortal.rescheduleSameSlot"))
      else if (err === "slot_unavailable") toast.error(t("clientPortal.rescheduleSlotUnavailable"))
      else toast.error(t("clientPortal.rescheduleError"))
    } finally {
      setRescheduling(false)
    }
  }

  if (bookings.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {t("clientPortal.emptyAppointments")}
      </p>
    )
  }

  return (
    <>
      <ul className="space-y-3">
        {bookings.map((booking) => {
          const manageable = canManage(booking)
          return (
            <li key={booking.id}>
              <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardContent className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-foreground">{booking.serviceName}</p>
                    <p className="text-sm text-muted-foreground">
                      {booking.appointmentDate} · {booking.appointmentTime.slice(0, 5)}
                    </p>
                    <p className="text-xs text-muted-foreground">{booking.businessName}</p>
                    <Badge variant={statusVariant(booking.status)} className="rounded-md text-xs">
                      {statusLabel(booking.status)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => setDetail(booking)}
                    >
                      {t("clientPortal.actionDetails")}
                    </Button>
                    {manageable && onReschedule && booking.businessSlug && booking.serviceId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        onClick={() => setReschedule(booking)}
                      >
                        {t("clientPortal.actionReschedule")}
                      </Button>
                    ) : null}
                    {manageable ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="rounded-lg"
                        disabled={busyId === booking.id}
                        onClick={() => void handleCancel(booking)}
                      >
                        {t("clientPortal.actionCancel")}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>

      <Sheet open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent className="rounded-l-2xl sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("clientPortal.detailsTitle")}</SheetTitle>
            <SheetDescription>{detail?.serviceName}</SheetDescription>
          </SheetHeader>
          {detail ? (
            <dl className="mt-4 space-y-2 text-sm">
              <Row label={t("clientPortal.fieldDate")} value={detail.appointmentDate} />
              <Row label={t("clientPortal.fieldTime")} value={detail.appointmentTime.slice(0, 5)} />
              <Row label={t("clientPortal.fieldBusiness")} value={detail.businessName} />
              <Row label={t("clientPortal.fieldService")} value={detail.serviceName} />
              <Row label={t("clientPortal.fieldStatus")} value={statusLabel(detail.status)} />
              {detail.staffName ? (
                <Row label={t("clientPortal.fieldStaff")} value={detail.staffName} />
              ) : null}
              {detail.confirmationToken ? (
                <div className="pt-2">
                  <Button asChild variant="link" className="h-auto p-0 text-primary">
                    <Link href={`/confirm/${encodeURIComponent(detail.confirmationToken)}`}>
                      {t("clientPortal.manageVisitLink")}
                    </Link>
                  </Button>
                </div>
              ) : null}
            </dl>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(reschedule)} onOpenChange={(open) => !open && setReschedule(null)}>
        <SheetContent className="w-full overflow-y-auto rounded-l-2xl sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t("clientPortal.rescheduleTitle")}</SheetTitle>
            <SheetDescription>{t("clientPortal.rescheduleDescription")}</SheetDescription>
          </SheetHeader>
          {reschedule && reschedule.businessSlug ? (
            <div className="mt-4">
              <PublicReschedulePicker
                booking={clientPortalBookingToPublicBooking(reschedule)}
                submitting={rescheduling}
                onCancel={() => setReschedule(null)}
                onConfirm={(date, time) => void handleReschedule(date, time)}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}
