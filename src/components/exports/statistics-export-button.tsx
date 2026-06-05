"use client"

import * as React from "react"
import { Download } from "lucide-react"

import {
  ExportFormatSheet,
  type ExportFormatId,
  type ExportFormatOption,
} from "@/components/exports/export-format-sheet"
import { Button } from "@/components/ui/button"
import {
  exportStatisticsReport,
  type StatisticsExportCopy,
  type StatisticsExportFormat,
} from "@/lib/exports/statistics-export"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { StatisticsDataset, StatisticsRange } from "@/lib/statistics/statistics-types"

export type StatisticsExportButtonProps = {
  dataset: StatisticsDataset
  range: StatisticsRange
  className?: string
}

export function StatisticsExportButton({ dataset, range, className }: StatisticsExportButtonProps) {
  const { t, language } = useTranslations()
  const [open, setOpen] = React.useState(false)

  const formats: ExportFormatOption[] = React.useMemo(
    () => [
      { id: "pdf", label: t("exports.formatPdf"), description: t("exports.formatPdfHint") },
      { id: "csv", label: t("exports.formatCsv"), description: t("exports.formatCsvHint") },
    ],
    [t],
  )

  const copy: StatisticsExportCopy = React.useMemo(
    () => ({
      reportTitle: t("exports.statisticsPdfTitle"),
      rangeLabel: t("exports.statisticsRange"),
      generatedAt: t("exports.generatedAt"),
      filenameBase: "wizytaok-statystyki",
      csvSectionCol: t("exports.csvSectionCol"),
      csvValueCol: t("exports.csvValueCol"),
      kpiSection: t("exports.statisticsKpiSection"),
      statusSection: t("exports.statisticsStatusSection"),
      servicesSection: t("exports.statisticsServicesSection"),
      staffSection: t("exports.statisticsStaffSection"),
      notificationsSection: t("exports.statisticsNotificationsSection"),
      kpi: {
        visitsToday: t("exports.kpiVisitsToday"),
        visitsThisMonth: t("exports.kpiVisitsThisMonth"),
        completed: t("exports.kpiCompleted"),
        cancelled: t("exports.kpiCancelled"),
        noShow: t("exports.kpiNoShow"),
        newClients: t("exports.kpiNewClients"),
        onlineBookings: t("exports.kpiOnlineBookings"),
        manualBookings: t("exports.kpiManualBookings"),
        avgDailyVisits: t("exports.kpiAvgDaily"),
      },
      notifications: {
        sms: t("exports.notifSms"),
        email: t("exports.notifEmail"),
        failed: t("exports.notifFailed"),
        successRate: t("exports.notifSuccessRate"),
      },
      statusNames: {
        confirmed: t("exports.statusConfirmed"),
        completed: t("exports.statusCompleted"),
        cancelled: t("exports.statusCancelled"),
        no_show: t("exports.statusNoShow"),
      },
    }),
    [t],
  )

  const handleExport = async (format: ExportFormatId) => {
    await new Promise<void>((resolve) => {
      queueMicrotask(() => {
        exportStatisticsReport(dataset, range, format as StatisticsExportFormat, language, copy)
        resolve()
      })
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className ?? "h-9 rounded-xl gap-1.5"}
        onClick={() => setOpen(true)}
      >
        <Download className="size-4" aria-hidden />
        {t("exports.statisticsButton")}
      </Button>
      <ExportFormatSheet
        open={open}
        onOpenChange={setOpen}
        title={t("exports.statisticsTitle")}
        description={t("exports.statisticsDescription")}
        formats={formats}
        onExport={handleExport}
      />
    </>
  )
}
