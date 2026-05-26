"use client"

import * as React from "react"

export type AppointmentAttachment = {
  id: string
  name: string
  mimeType: string
  size: number
  dataUrl: string
  createdAt: string
}

const APPOINTMENT_ATTACHMENTS_STORAGE_KEY = "wizytaok-appointment-attachments-v1"

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeAttachment(raw: unknown): AppointmentAttachment | null {
  if (!isObject(raw)) return null
  const { id, name, mimeType, size, dataUrl, createdAt } = raw
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof mimeType !== "string" ||
    typeof size !== "number" ||
    typeof dataUrl !== "string" ||
    typeof createdAt !== "string"
  ) {
    return null
  }
  if (!id.trim() || !name.trim() || !dataUrl.startsWith("data:")) return null
  return {
    id: id.trim(),
    name: name.trim(),
    mimeType: mimeType.trim(),
    size: Math.max(0, Math.floor(size)),
    dataUrl,
    createdAt,
  }
}

function readAttachmentMap(): Record<string, AppointmentAttachment[]> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(APPOINTMENT_ATTACHMENTS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    if (!isObject(parsed)) return {}
    const output: Record<string, AppointmentAttachment[]> = {}
    for (const [appointmentId, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue
      const attachments = value
        .map(normalizeAttachment)
        .filter((item): item is AppointmentAttachment => item !== null)
      if (attachments.length > 0) output[appointmentId] = attachments
    }
    return output
  } catch {
    return {}
  }
}

function writeAttachmentMap(map: Record<string, AppointmentAttachment[]>): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(APPOINTMENT_ATTACHMENTS_STORAGE_KEY, JSON.stringify(map))
  window.dispatchEvent(new Event("wizytaok-appointment-attachments"))
}

export function getAppointmentAttachments(appointmentId: string): AppointmentAttachment[] {
  const id = appointmentId.trim()
  if (!id) return []
  return readAttachmentMap()[id] ?? []
}

export function setAppointmentAttachments(
  appointmentId: string,
  attachments: AppointmentAttachment[]
): void {
  const id = appointmentId.trim()
  if (!id) return
  const map = readAttachmentMap()
  const normalized = attachments
    .map(normalizeAttachment)
    .filter((item): item is AppointmentAttachment => item !== null)
  if (normalized.length > 0) map[id] = normalized
  else delete map[id]
  writeAttachmentMap(map)
}

export function useAppointmentAttachments(appointmentId: string): [
  AppointmentAttachment[],
  React.Dispatch<React.SetStateAction<AppointmentAttachment[]>>,
] {
  const [attachments, setAttachmentsState] = React.useState<AppointmentAttachment[]>(() =>
    getAppointmentAttachments(appointmentId)
  )

  React.useEffect(() => {
    queueMicrotask(() => {
      setAttachmentsState(getAppointmentAttachments(appointmentId))
    })
  }, [appointmentId])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const onChanged = () => setAttachmentsState(getAppointmentAttachments(appointmentId))
    window.addEventListener("wizytaok-appointment-attachments", onChanged)
    return () => window.removeEventListener("wizytaok-appointment-attachments", onChanged)
  }, [appointmentId])

  const setAttachments = React.useCallback<React.Dispatch<React.SetStateAction<AppointmentAttachment[]>>>(
    (next) => {
      setAttachmentsState((previous) => {
        const resolved = typeof next === "function" ? next(previous) : next
        setAppointmentAttachments(appointmentId, resolved)
        return resolved
      })
    },
    [appointmentId]
  )

  return [attachments, setAttachments]
}

export function allocateAppointmentAttachmentId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `appt-att-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"))
    reader.readAsDataURL(file)
  })
}

