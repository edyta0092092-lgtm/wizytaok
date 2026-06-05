"use client"

import { downloadBlob } from "@/lib/exports/download-file"
import type { ExportTable } from "@/lib/exports/table-export"
import { truncateCell } from "@/lib/exports/table-export"

function pdfEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

type PdfLine = { text: string; size?: number; bold?: boolean }

function buildContentStream(lines: PdfLine[], table?: ExportTable): string {
  const parts: string[] = ["BT"]
  let y = 800
  const lineHeight = 14

  for (const line of lines) {
    if (y < 60) break
    const size = line.size ?? 11
    const font = line.bold ? "/F2" : "/F1"
    parts.push(`${font} ${size} Tf`)
    parts.push(`1 0 0 1 50 ${y} Tm`)
    parts.push(`(${pdfEscape(line.text)}) Tj`)
    y -= lineHeight + (line.bold ? 4 : 0)
  }

  if (table && y > 80) {
    y -= 8
    parts.push("/F1 9 Tf")
    const maxRows = Math.min(table.rows.length, Math.floor((y - 50) / 12))
    const headerLine = table.headers.map((h) => truncateCell(h, 14)).join(" | ")
    parts.push(`1 0 0 1 50 ${y} Tm`)
    parts.push(`(${pdfEscape(headerLine)}) Tj`)
    y -= 12
    for (let i = 0; i < maxRows; i += 1) {
      const row = table.rows[i]
      if (!row) continue
      const rowLine = row.map((c) => truncateCell(c, 14)).join(" | ")
      parts.push(`1 0 0 1 50 ${y} Tm`)
      parts.push(`(${pdfEscape(rowLine)}) Tj`)
      y -= 11
      if (y < 50) break
    }
  }

  parts.push("ET")
  return parts.join("\n")
}

export function buildSimplePdfBytes(title: string, lines: string[], table?: ExportTable): Uint8Array {
  const streamLines: PdfLine[] = [
    { text: title, size: 16, bold: true },
    ...lines.map((text) => ({ text })),
  ]
  const content = buildContentStream(streamLines, table)
  const contentLength = new TextEncoder().encode(content).length

  const chunks: string[] = ["%PDF-1.4\n"]
  const offsets: number[] = [0]

  const addObj = (body: string) => {
    offsets.push(chunks.join("").length)
    chunks.push(`${offsets.length - 1} 0 obj\n${body}\nendobj\n`)
  }

  addObj("<< /Type /Catalog /Pages 2 0 R >>")
  addObj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
  addObj(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
  )
  addObj(`<< /Length ${contentLength} >>\nstream\n${content}\nendstream`)
  addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
  addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

  const body = chunks.join("")
  const xrefOffset = body.length
  let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`
  }
  const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return new TextEncoder().encode(body + xref + trailer)
}

export function downloadPdfReport(
  filename: string,
  title: string,
  lines: string[],
  table?: ExportTable,
): void {
  const bytes = buildSimplePdfBytes(title, lines, table)
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  downloadBlob(filename, copy, "application/pdf")
}
