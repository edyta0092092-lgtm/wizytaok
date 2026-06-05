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
  exportCustomers,
  type CustomersExportFormat,
} from "@/lib/exports/customers-export"
import type { CustomerCrmRow } from "@/lib/customers/customer-types"
import { useTranslations } from "@/lib/i18n/use-translations"

export type CustomersExportButtonProps = {
  rows: CustomerCrmRow[]
  className?: string
}

export function CustomersExportButton({ rows, className }: CustomersExportButtonProps) {
  const { t, language } = useTranslations()
  const [open, setOpen] = React.useState(false)

  const formats: ExportFormatOption[] = React.useMemo(
    () => [
      { id: "csv", label: t("exports.formatCsv"), description: t("exports.formatCsvHint") },
      { id: "excel", label: t("exports.formatExcel"), description: t("exports.formatExcelHint") },
    ],
    [t],
  )

  const labels = React.useMemo(
    () => ({
      fullName: t("exports.clientsColName"),
      phone: t("exports.clientsColPhone"),
      email: t("exports.clientsColEmail"),
      visitCount: t("exports.clientsColVisits"),
      lastVisit: t("exports.clientsColLastVisit"),
      nextVisit: t("exports.clientsColNextVisit"),
      status: t("exports.clientsColStatus"),
      filenameBase: "wizytaok-klienci",
    }),
    [t],
  )

  const segmentLabel = React.useCallback(
    (segment: CustomerCrmRow["segment"]) => t(`customers.segment.${segment}`),
    [t],
  )

  const handleExport = async (format: ExportFormatId) => {
    await new Promise<void>((resolve) => {
      queueMicrotask(() => {
        exportCustomers(rows, format as CustomersExportFormat, labels, language, segmentLabel)
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
        title={t("exports.clientsTitle")}
        description={t("exports.clientsDescription")}
        formats={formats}
        rowCount={rows.length}
        disabled={rows.length === 0}
        onExport={handleExport}
      />
    </>
  )
}
