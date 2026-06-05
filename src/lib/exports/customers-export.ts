"use client"

import { formatCustomerDate } from "@/lib/customers/format-customer-datetime"
import type { CustomerCrmRow } from "@/lib/customers/customer-types"
import { downloadCsvTable, downloadExcelTable, type ExportTable } from "@/lib/exports/table-export"
import type { Language } from "@/lib/i18n/dictionaries"

export type CustomersExportLabels = {
  fullName: string
  phone: string
  email: string
  visitCount: string
  lastVisit: string
  nextVisit: string
  status: string
  filenameBase: string
}

export type CustomersExportFormat = "csv" | "excel"

function buildCustomersTable(
  rows: CustomerCrmRow[],
  labels: CustomersExportLabels,
  language: Language,
  segmentLabel: (segment: CustomerCrmRow["segment"]) => string,
): ExportTable {
  return {
    headers: [
      labels.fullName,
      labels.phone,
      labels.email,
      labels.visitCount,
      labels.lastVisit,
      labels.nextVisit,
      labels.status,
    ],
    rows: rows.map((row) => [
      row.fullName,
      row.phone,
      row.email,
      String(row.visitCount),
      row.lastVisitAt ? formatCustomerDate(row.lastVisitAt, language) : "",
      row.nextVisitAt ? formatCustomerDate(row.nextVisitAt, language) : "",
      segmentLabel(row.segment),
    ]),
  }
}

export function exportCustomers(
  rows: CustomerCrmRow[],
  format: CustomersExportFormat,
  labels: CustomersExportLabels,
  language: Language,
  segmentLabel: (segment: CustomerCrmRow["segment"]) => string,
): void {
  const stamp = new Date().toISOString().slice(0, 10)
  const base = `${labels.filenameBase}-${stamp}`
  const table = buildCustomersTable(rows, labels, language, segmentLabel)

  if (format === "csv") {
    downloadCsvTable(`${base}.csv`, table)
    return
  }

  downloadExcelTable(`${base}.xls`, table, "Klienci")
}
