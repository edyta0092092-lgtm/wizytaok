"use client"

import { formatStatisticsRangeLabel } from "@/lib/exports/statistics-range-label"
import { downloadCsvTable, downloadExcelTable, type ExportTable } from "@/lib/exports/table-export"
import { downloadPdfReport } from "@/lib/exports/pdf-simple"
import type { Language } from "@/lib/i18n/dictionaries"
import type { StatisticsDataset, StatisticsRange } from "@/lib/statistics/statistics-types"

export type StatisticsExportCopy = {
  reportTitle: string
  rangeLabel: string
  generatedAt: string
  filenameBase: string
  csvSectionCol: string
  csvValueCol: string
  kpiSection: string
  statusSection: string
  servicesSection: string
  staffSection: string
  notificationsSection: string
  kpi: {
    visitsToday: string
    visitsThisMonth: string
    completed: string
    cancelled: string
    noShow: string
    newClients: string
    onlineBookings: string
    manualBookings: string
    avgDailyVisits: string
  }
  notifications: {
    sms: string
    email: string
    failed: string
    successRate: string
  }
  statusNames: Record<string, string>
}

export type StatisticsExportFormat = "csv" | "pdf"

function buildReportLines(
  dataset: StatisticsDataset,
  range: StatisticsRange,
  language: Language,
  copy: StatisticsExportCopy,
): string[] {
  const rangeText = formatStatisticsRangeLabel(range, language)
  const k = dataset.kpis
  const n = dataset.notifications
  return [
    `${copy.rangeLabel}: ${rangeText}`,
    `${copy.generatedAt}: ${new Date().toLocaleString(language === "en" ? "en-US" : "pl-PL")}`,
    "",
    copy.kpiSection,
    `${copy.kpi.visitsToday}: ${k.visitsToday}`,
    `${copy.kpi.visitsThisMonth}: ${k.visitsThisMonth}`,
    `${copy.kpi.completed}: ${k.completed}`,
    `${copy.kpi.cancelled}: ${k.cancelled}`,
    `${copy.kpi.noShow}: ${k.noShow}`,
    `${copy.kpi.newClients}: ${k.newClients}`,
    `${copy.kpi.onlineBookings}: ${k.onlineBookings}`,
    `${copy.kpi.manualBookings}: ${k.manualBookings}`,
    `${copy.kpi.avgDailyVisits}: ${k.avgDailyVisits}`,
    "",
    copy.statusSection,
    ...dataset.statuses.map(
      (s) => `${copy.statusNames[s.status] ?? s.status}: ${s.count} (${s.percent}%)`,
    ),
    "",
    copy.servicesSection,
    ...dataset.topServices.map((s) => `${s.name}: ${s.count} (${s.percent}%)`),
    "",
    copy.staffSection,
    ...dataset.topStaff.map(
      (s) => `${s.name}: ${s.count} (${s.percent}%)${s.completed != null ? `, ${s.completed}` : ""}`,
    ),
    "",
    copy.notificationsSection,
    `${copy.notifications.sms}: ${n.sentSms}`,
    `${copy.notifications.email}: ${n.sentEmails}`,
    `${copy.notifications.failed}: ${n.failed}`,
    `${copy.notifications.successRate}: ${n.reminderSuccessRate}%`,
  ]
}

function buildStatisticsCsvTable(
  dataset: StatisticsDataset,
  range: StatisticsRange,
  language: Language,
  copy: StatisticsExportCopy,
): ExportTable {
  const lines = buildReportLines(dataset, range, language, copy)
  return {
    headers: [copy.csvSectionCol, copy.csvValueCol],
    rows: lines
      .filter((line) => line.length > 0)
      .map((line) => {
        const idx = line.indexOf(":")
        if (idx === -1) return [line, ""]
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
      }),
  }
}

export function exportStatisticsReport(
  dataset: StatisticsDataset,
  range: StatisticsRange,
  format: StatisticsExportFormat,
  language: Language,
  copy: StatisticsExportCopy,
): void {
  const stamp = new Date().toISOString().slice(0, 10)
  const base = `${copy.filenameBase}-${stamp}`
  const lines = buildReportLines(dataset, range, language, copy)

  if (format === "csv") {
    downloadCsvTable(`${base}.csv`, buildStatisticsCsvTable(dataset, range, language, copy))
    return
  }

  downloadPdfReport(`${base}.pdf`, copy.reportTitle, lines)
}
