"use client"

export function downloadBlob(filename: string, body: BlobPart, mimeType: string): void {
  if (typeof window === "undefined") return
  const blob = new Blob([body], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.rel = "noopener"
  anchor.click()
  queueMicrotask(() => URL.revokeObjectURL(url))
}

export function downloadTextFile(
  filename: string,
  text: string,
  mimeType: string,
  withUtf8Bom = false,
): void {
  const payload = withUtf8Bom ? `\uFEFF${text}` : text
  downloadBlob(filename, payload, mimeType)
}
