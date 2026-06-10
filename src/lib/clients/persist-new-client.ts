"use client"

import { findOrCreateClient } from "@/lib/clients/find-or-create-client"
import {
  loadClientsWorkspace,
  persistClientsCatalog,
  persistExtraNotesMap,
  readExtraNotesMap,
  riskTierFromScore,
} from "@/lib/clients/clients-store"
import { getBrowserClient } from "@/lib/supabase/client"
import type { Client } from "@/types/domain"

export const CLIENTS_CHANGED_EVENT = "pw-clients-changed"

function notifyClientsChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(CLIENTS_CHANGED_EVENT))
}

export async function persistNewClient(args: {
  businessProfileId: string | null
  fullName: string
  phone: string
  email: string
  notes?: string
}): Promise<{ ok: true; clientId: string } | { ok: false; errorMessage: string }> {
  const fullName = args.fullName.trim()
  const phone = args.phone.trim()
  const email = args.email.trim().toLowerCase()
  const notesTrim = args.notes?.trim() ?? ""

  if (!fullName) {
    return { ok: false, errorMessage: "validation_full_name" }
  }

  const sb = getBrowserClient()
  if (sb && args.businessProfileId) {
    const resolved = await findOrCreateClient(sb, args.businessProfileId, {
      fullName,
      email,
      phone,
    })
    if (!resolved.ok) {
      return { ok: false, errorMessage: resolved.error || "rpc_error" }
    }
    await loadClientsWorkspace({ businessId: args.businessProfileId })
    notifyClientsChanged()
    return { ok: true, clientId: resolved.clientId }
  }

  const workspace = await loadClientsWorkspace({
    businessId: args.businessProfileId ?? undefined,
  })
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `local-${Date.now()}`

  const newClient: Client = {
    id,
    fullName,
    phone,
    email,
    visitCount: 0,
    confirmedVisitCount: 0,
    noShowCount: 0,
    cancelledVisitCount: 0,
    notes: notesTrim.length > 0 ? notesTrim : undefined,
    attachments: [],
    riskScore: 0,
    riskTier: riskTierFromScore(0),
    visitHistory: [],
  }

  const merged = [...workspace.clients, newClient].sort((a, b) =>
    a.fullName.localeCompare(b.fullName, "pl", { sensitivity: "base" }),
  )
  persistClientsCatalog(merged)

  if (notesTrim.length > 0) {
    const extras = { ...readExtraNotesMap(), [id]: notesTrim }
    persistExtraNotesMap(extras)
  }

  notifyClientsChanged()
  return { ok: true, clientId: id }
}
