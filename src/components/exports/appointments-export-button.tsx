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
  exportAppointments,
  type AppointmentsExportFormat,
} from "@/lib/exports/appointments-export"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { Appointment } from "@/types/domain"

export type AppointmentsExportButtonProps = {
  rows: Appointment[]
  className?: string
}

export function AppointmentsExportButton({ rows, className }: AppointmentsExportButtonProps) {
  const { t, language } = useTranslations()
  const [open, setOpen] = React.useState(false)

  const formats: ExportFormatOption[] = React.useMemo(
    () => [
      { id: "csv", label: t("exports.formatCsv"), description: t("exports.formatCsvHint") },
      { id: "excel", label: t("exports.formatExcel"), description: t("exports.formatExcelHint") },
      { id: "pdf", label: t("exports.formatPdf"), description: t("exports.formatPdfHint") },
    ],
    [t],
  )

  const labels = React.useMemo(
    () => ({
      date: t("settings.csvColDate"),
      time: t("settings.csvColTime"),
      client: t("settings.csvColClient"),
      phone: t("settings.csvColPhone"),
      email: t("settings.csvColEmail"),
      service: t("settings.csvColService"),
      status: t("settings.csvColStatus"),
      staff: t("settings.csvStaffCol"),
      source: t("settings.csvColSource"),
      anyStaff: t("appointments.anyStaff"),
      filenameBase: "wizytaok-wizyty",
      pdfTitle: t("exports.appointmentsPdfTitle"),
    }),
    [t],
  )

  const handleExport = async (format: ExportFormatId) => {
    await new Promise<void>((resolve) => {
      queueMicrotask(() => {
        exportAppointments(rows, format as AppointmentsExportFormat, labels, language, t)
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
        disabled={rows.length === 0}
        onClick={() => setOpen(true)}
      >
        <Download className="size-4" aria-hidden />
        {t("exports.button")}
      </Button>
      <ExportFormatSheet
        open={open}
        onOpenChange={setOpen}
        title={t("exports.appointmentsTitle")}
        description={t("exports.appointmentsDescription")}
        formats={formats}
        rowCount={rows.length}
        disabled={rows.length === 0}
        onExport={handleExport}
      />
    </>
  )
}
