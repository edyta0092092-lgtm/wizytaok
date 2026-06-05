"use client"

import { csvAppendRow } from "@/lib/export/csv-export"
import { downloadTextFile } from "@/lib/exports/download-file"

export type ExportTable = {
  headers: string[]
  rows: string[][]
}

export function buildCsvFromTable(table: ExportTable): string {
  const head = csvAppendRow(table.headers)
  const body = table.rows.map((row) => csvAppendRow(row)).join("")
  return `${head}${body}`
}

function escapeHtmlCell(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function buildExcelHtmlFromTable(table: ExportTable, sheetName: string): string {
  const headerRow = table.headers
    .map((h) => `<th>${escapeHtmlCell(h)}</th>`)
    .join("")
  const bodyRows = table.rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtmlCell(cell)}</td>`).join("")}</tr>`,
    )
    .join("")
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
<meta charset="utf-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>${escapeHtmlCell(sheetName)}</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body>
<table border="1" cellspacing="0" cellpadding="4">
<thead><tr>${headerRow}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
</body>
</html>`
}

export function downloadCsvTable(filename: string, table: ExportTable): void {
  downloadTextFile(filename, buildCsvFromTable(table), "text/csv;charset=utf-8;", true)
}

export function downloadExcelTable(filename: string, table: ExportTable, sheetName: string): void {
  const html = buildExcelHtmlFromTable(table, sheetName)
  downloadTextFile(filename, html, "application/vnd.ms-excel;charset=utf-8;", true)
}

export function truncateCell(value: string, max = 48): string {
  const v = String(value ?? "").trim()
  if (v.length <= max) return v
  return `${v.slice(0, max - 1)}…`
}
