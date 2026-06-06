"use client"

import {
  staffColumnValue,
  utcIsoToLocalParts,
  type AppointmentCsvHeaders,
} from "@/lib/export/csv-export"
import { downloadCsvTable, downloadExcelTable, type ExportTable } from "@/lib/exports/table-export"
import { downloadPdfReport } from "@/lib/exports/pdf-simple"
import type { Language } from "@/lib/i18n/dictionaries"
import type { Appointment, AppointmentStatus } from "@/types/domain"

export type AppointmentsExportLabels = AppointmentCsvHeaders & {
  anyStaff: string
  filenameBase: string
  pdfTitle: string
}

function statusLabelFactory(
  t: (key: string) => string,
): (status: AppointmentStatus) => string {
  return (status) =>
    t(`labels.appointmentStatus.${status}` as "labels.appointmentStatus.booked")
}

function buildAppointmentsTable(
  rows: Appointment[],
  labels: AppointmentsExportLabels,
  language: Language,
  statusLabel: (s: AppointmentStatus) => string,
): ExportTable {
  return {
    headers: [
      labels.date,
      labels.time,
      labels.client,
      labels.phone,
      labels.email,
      labels.service,
      labels.staff,
      labels.status,
    ],
    rows: rows.map((a) => {
      const { dateStr, timeStr } = utcIsoToLocalParts(a.startsAt)
      return [
        dateStr,
        timeStr,
        a.clientName,
        a.phone,
        String(a.email ?? ""),
        a.serviceLabel,
        staffColumnValue(a, labels.anyStaff),
        statusLabel(a.status),
      ]
    }),
  }
}

export type AppointmentsExportFormat = "csv" | "excel" | "pdf"

export function exportAppointments(
  rows: Appointment[],
  format: AppointmentsExportFormat,
  labels: AppointmentsExportLabels,
  language: Language,
  t: (key: string) => string,
): void {
  const statusLabel = statusLabelFactory(t)
  const stamp = new Date().toISOString().slice(0, 10)
  const base = `${labels.filenameBase}-${stamp}`

  const table = buildAppointmentsTable(rows, labels, language, statusLabel)

  if (format === "csv") {
    downloadCsvTable(`${base}.csv`, table)
    return
  }

  if (format === "excel") {
    downloadExcelTable(`${base}.xls`, table, "Wizyty")
    return
  }

  downloadPdfReport(
    `${base}.pdf`,
    labels.pdfTitle,
    [`${labels.filenameBase}: ${rows.length}`],
    table,
  )
}
