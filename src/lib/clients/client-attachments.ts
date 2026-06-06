import type { ClientAttachment } from "@/types/domain"

export const CLIENT_ATTACHMENT_ACCEPT = "image/jpeg,image/jpg,image/png,application/pdf"
export const CLIENT_ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024

export function formatClientAttachmentSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

export function allocateClientAttachmentId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `att-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"))
    reader.readAsDataURL(file)
  })
}

export function isAllowedClientAttachment(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.type === "image/jpeg" ||
    file.type === "image/jpg" ||
    file.type === "image/png"
  )
}

export function isEmailFormatValid(email: string): boolean {
  const value = email.trim()
  if (!value) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function readClientAttachmentFiles(
  files: FileList | null,
  onError: (messageKey: "attachmentInvalidType" | "attachmentTooLarge" | "attachmentReadFailed") => void,
): Promise<ClientAttachment[]> {
  if (!files || files.length === 0) return []
  const next: ClientAttachment[] = []
  for (const file of Array.from(files)) {
    if (!isAllowedClientAttachment(file)) {
      onError("attachmentInvalidType")
      return []
    }
    if (file.size > CLIENT_ATTACHMENT_MAX_BYTES) {
      onError("attachmentTooLarge")
      return []
    }
    let dataUrl = ""
    try {
      dataUrl = await readFileAsDataUrl(file)
    } catch {
      onError("attachmentReadFailed")
      return []
    }
    next.push({
      id: allocateClientAttachmentId(),
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      dataUrl,
      createdAt: new Date().toISOString(),
    })
  }
  return next
}
