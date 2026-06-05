"use client"

import * as React from "react"

import type { AppointmentsListFilter } from "@/lib/appointments/appointments-list-filters"
import {
  APPOINTMENT_GROUP_ORDER,
  groupAppointmentByDay,
  type AppointmentGroupKey,
  type AppointmentsDayGroupFilter,
} from "@/lib/appointments/appointments-grouping"
import { appointmentShowsNeedsActionStatus } from "@/lib/appointments/stats-rules"
import { getAppToday, isSameAppDay } from "@/lib/date/current-date"
import { bookingMatchesStaffFilter } from "@/lib/staff/staff-display"
import type { StaffAppointmentFilterValue } from "@/lib/staff/staff-display"
import { appointmentMatchesSourceFilter, type AppointmentsSourceFilter } from "@/lib/appointments/appointments-source-filter"
import type { Appointment } from "@/types/domain"

function parseFilterDateStart(isoDate: string): number | null {
  const key = isoDate.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

function parseFilterDateEnd(isoDate: string): number | null {
  const start = parseFilterDateStart(isoDate)
  if (start == null) return null
  const key = isoDate.trim().slice(0, 10)
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
}

export function useAppointmentsListPresentation(args: {
  appointments: Appointment[]
  filter: AppointmentsListFilter
  staffFilter: StaffAppointmentFilterValue
  restrictToToday: boolean
  clientNameFilter: string
  serviceFilter: string
  dayGroupFilter: AppointmentsDayGroupFilter
  sourceFilter: AppointmentsSourceFilter
  dateFrom: string
  dateTo: string
  language: string
}) {
  const {
    appointments,
    filter,
    staffFilter,
    restrictToToday,
    clientNameFilter,
    serviceFilter,
    dayGroupFilter,
    sourceFilter,
    dateFrom,
    dateTo,
    language,
  } = args

  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [language],
  )

  const timeFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [language],
  )

  const formatWhen = React.useCallback(
    (startsAt: string) => {
      const d = new Date(startsAt)
      return { date: dateFmt.format(d), time: timeFmt.format(d) }
    },
    [dateFmt, timeFmt],
  )

  const filtered = React.useMemo(() => {
    const qClient = clientNameFilter.trim().toLowerCase()
    const qService = serviceFilter.trim().toLowerCase()
    const fromMs = parseFilterDateStart(dateFrom)
    const toMs = parseFilterDateEnd(dateTo)
    const today = getAppToday()
    let base = appointments
    if (restrictToToday) {
      base = base.filter((a) => isSameAppDay(a.startsAt, today))
    }
    let stage: Appointment[]
    if (filter === "needs_action") {
      stage = base.filter((a) => appointmentShowsNeedsActionStatus(a))
    } else if (filter === "all") {
      stage = base
    } else if (filter === "unconfirmed") {
      stage = base.filter(
        (a) =>
          (a.status === "booked" || a.status === "pending") &&
          !appointmentShowsNeedsActionStatus(a),
      )
    } else {
      stage = base.filter(
        (a) => a.status === filter && !appointmentShowsNeedsActionStatus(a),
      )
    }
    return stage
      .filter((a) => bookingMatchesStaffFilter(a, staffFilter))
      .filter((a) =>
        qClient ? String(a.clientName ?? "").toLowerCase().includes(qClient) : true
      )
      .filter((a) =>
        qService ? String(a.serviceLabel ?? "").toLowerCase().includes(qService) : true
      )
      .filter((a) =>
        dayGroupFilter === "all"
          ? true
          : groupAppointmentByDay(a.startsAt, today) === dayGroupFilter,
      )
      .filter((a) => appointmentMatchesSourceFilter(a, sourceFilter))
      .filter((a) => {
        if (fromMs == null && toMs == null) return true
        const t = new Date(a.startsAt).getTime()
        if (Number.isNaN(t)) return false
        if (fromMs != null && t < fromMs) return false
        if (toMs != null && t > toMs) return false
        return true
      })
  }, [
    appointments,
    filter,
    staffFilter,
    restrictToToday,
    clientNameFilter,
    serviceFilter,
    dayGroupFilter,
    sourceFilter,
    dateFrom,
    dateTo,
  ])

  const grouped = React.useMemo(() => {
    const out: Record<AppointmentGroupKey, Appointment[]> = {
      past: [],
      today: [],
      tomorrow: [],
      upcoming: [],
    }
    for (const a of filtered) {
      out[groupAppointmentByDay(a.startsAt)].push(a)
    }
    const sortStarts = (a: Appointment, b: Appointment) =>
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    const sortStartsDesc = (a: Appointment, b: Appointment) =>
      new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
    for (const k of APPOINTMENT_GROUP_ORDER) {
      out[k].sort(k === "past" ? sortStartsDesc : sortStarts)
    }
    return out
  }, [filtered])

  return { filtered, grouped, formatWhen }
}
