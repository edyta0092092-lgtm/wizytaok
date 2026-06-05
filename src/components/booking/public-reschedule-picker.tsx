"use client"

import * as React from "react"

import { PublicBookingCalendar } from "@/components/booking/public-booking-calendar"
import { Button } from "@/components/ui/button"
import { usePublicRescheduleAvailability } from "@/lib/bookings/use-public-reschedule-availability"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { PublicBooking } from "@/lib/bookings/public-bookings"

type Props = {
  booking: PublicBooking
  submitting: boolean
  onCancel: () => void
  onConfirm: (date: string, time: string) => void
}

export function PublicReschedulePicker({ booking, submitting, onCancel, onConfirm }: Props) {
  const { t, language } = useTranslations()
  const avail = usePublicRescheduleAvailability({
    businessSlug: booking.businessSlug,
    serviceId: booking.serviceId,
    staffId: booking.staffId,
    bookingId: booking.id,
    currentDate: booking.date,
    currentTime: booking.time,
    serviceDurationMinutes: booking.serviceDurationMinutes,
  })

  const canSubmit = Boolean(avail.selectedDayKey && avail.selectedTime && !submitting)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("confirmPublic.reschedulePickerIntro")}</p>
      {avail.blockCalendarForNoStaff ? (
        <p className="text-sm text-destructive">{t("confirmPublic.rescheduleStaffRequired")}</p>
      ) : !avail.availabilityReady || !avail.clientToday || !avail.staffAvailReady ? (
        <p className="text-sm text-muted-foreground">{t("bookings.loading")}</p>
      ) : (
        <PublicBookingCalendar
          language={language}
          t={t}
          clientToday={avail.clientToday}
          selectedDateKey={avail.selectedDayKey}
          onSelectDate={(key) => {
            avail.setDayOverride(key)
            avail.setSelectedTime(null)
          }}
          selectedTime={avail.selectedTime}
          onSelectTime={avail.setSelectedTime}
          availability={avail.bookingAvailability}
          availabilityStrict={avail.availabilityStrict}
          serviceDurationMinutes={avail.durationMinutes}
          blockedSlotKeys={avail.effectiveBlockedSlotKeys}
          resolveAvailabilityDaysForDate={avail.resolveAvailabilityDaysForDate}
        />
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" className="w-full sm:flex-1" onClick={onCancel} disabled={submitting}>
          {t("confirmPublic.backToDetails")}
        </Button>
        <Button
          type="button"
          className="w-full sm:flex-1"
          disabled={!canSubmit || avail.blockCalendarForNoStaff}
          onClick={() => {
            if (!avail.selectedDayKey || !avail.selectedTime) return
            onConfirm(avail.selectedDayKey, avail.selectedTime)
          }}
        >
          {submitting ? t("bookings.loading") : t("confirmPublic.confirmReschedule")}
        </Button>
      </div>
    </div>
  )
}
