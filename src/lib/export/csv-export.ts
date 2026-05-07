"use client"

import { isOnlineBookingSource } from "@/lib/bookings/booking-source"
import type { Appointment, AppointmentStatus, Client } from "@/types/domain"

export function csvEscapeCell(value: string): string {
  const normalized = String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`
  }
  return normalized
}

export function csvAppendRow(cells: string[]): string {
  return `${cells.map(csvEscapeCell).join(",")}\r\n`
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

export function utcIsoToLocalParts(iso: string): { dateStr: string; timeStr: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { dateStr: "", timeStr: "" }
  return {
    dateStr: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    timeStr: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  }
}

export function staffColumnValue(
  a: Appointment,
  anyStaffLabel: string
): string {
  const n = a.staffName?.trim()
  if (n) return n
  if (isOnlineBookingSource(a.source) && !a.staffId) return anyStaffLabel
  return ""
}

export type AppointmentCsvHeaders = {
  date: string
  time: string
  client: string
  phone: string
  email: string
  service: string
  status: string
  staff: string
  source: string
}

export function buildAppointmentsCsv(
  rows: Appointment[],
  headers: AppointmentCsvHeaders,
  statusLabel: (s: AppointmentStatus) => string,
  sourceCellLabel: (a: Appointment) => string,
  anyStaffLabel: string
): string {
  const head = csvAppendRow([
    headers.date,
    headers.time,
    headers.client,
    headers.phone,
    headers.email,
    headers.service,
    headers.status,
    headers.staff,
    headers.source,
  ])
  const body = rows
    .map((a) => {
      const { dateStr, timeStr } = utcIsoToLocalParts(a.startsAt)
      const src = sourceCellLabel(a)
      return csvAppendRow([
        dateStr,
        timeStr,
        a.clientName,
        a.phone,
        String(a.email ?? ""),
        a.serviceLabel,
        statusLabel(a.status),
        staffColumnValue(a, anyStaffLabel),
        src,
      ])
    })
    .join("")
  return `${head}${body}`
}

export type ClientCsvHeaders = {
  fullName: string
  phone: string
  email: string
  notes: string
  visitCount: string
  confirmedVisits: string
  noShows: string
}

export function buildClientsCsv(rows: Client[], headers: ClientCsvHeaders): string {
  const head = csvAppendRow([
    headers.fullName,
    headers.phone,
    headers.email,
    headers.notes,
    headers.visitCount,
    headers.confirmedVisits,
    headers.noShows,
  ])
  const body = rows
    .map((c) =>
      csvAppendRow([
        c.fullName,
        c.phone,
        c.email,
        String(c.notes ?? ""),
        String(c.visitCount),
        String(c.confirmedVisitCount),
        String(c.noShowCount),
      ])
    )
    .join("")
  return `${head}${body}`
}

export function downloadCsvFile(filename: string, csvBody: string): void {
  if (typeof window === "undefined") return
  const bom = "\uFEFF"
  const blob = new Blob([`${bom}${csvBody}`], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.rel = "noopener"
  anchor.click()
  queueMicrotask(() => URL.revokeObjectURL(url))
}
