"use client"

import { fetchMergedAppointments } from "@/lib/appointments/appointments-store"
import { updateManualAppointment, unwrapManualAppointmentId } from "@/lib/appointments/manual-appointments"
import { unwrapSupabaseBookingAppointmentId, updateBooking } from "@/lib/bookings/bookings-store"
import { unwrapPublicAppointmentId, updatePublicBooking } from "@/lib/bookings/public-bookings"
import { DEMO_BOOKING_SLUG, normalizePublicSlug } from "@/lib/business/slug"
import { initialClientsList } from "@/data/mock-clients"
import { normalizeEmail as normalizeEmailForMatch, normalizePhone as normalizePhoneForMatch } from "@/lib/clients/normalize"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { getClients, updateClient } from "@/lib/supabase/repositories/clients.repository"
import type { ClientRecord } from "@/types/domain"
import type { Client, ClientRiskTier, ClientVisitHistoryItem } from "@/types/domain"
import type { Appointment } from "@/types/domain"
import type { TablesUpdate } from "@/types/database"

/** Pełny zrzut widoku /clients oprócz trybu wyłącznie Supabase. */
export const CLIENTS_CATALOG_STORAGE_KEY = "wizytaok-clients-catalog-v1"

const CLIENT_GROUP_IDENTITY_STORAGE_KEY = "wizytaok-client-group-identity-v1"
const CLIENT_NOTES_EXTRA_STORAGE_KEY = "wizytaok-client-extra-notes-v1"

export type ClientsLoadMode =
  /** Dane z rekordów `clients` dla zalogowanej firmy. */
  | "supabase_clients"
  /** Brak rekordów w `clients`; klienci zgrupowani z wizyt dla bieżącego profilu. */
  | "derived_from_visits"
  /** Zrzut przeglądarki lub mocki (tryb bez tabeli / offline). */
  | "snapshot"

export type ClientsWorkspaceLoad = {
  clients: Client[]
  mode: ClientsLoadMode
  businessSlug: string | null
  businessProfileId: string | null
}

export function riskTierFromScore(score: number): ClientRiskTier {
  if (score < 40) return "low"
  if (score < 70) return "medium"
  return "high"
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "")
}

function normalizeEmailLower(email: string): string {
  return email.trim().toLowerCase()
}

export type PriorClientIdentity = {
  phoneDigits: string
  emailLower: string
  fullNameLower: string
}

export function buildPriorIdentity(c: Pick<Client, "fullName" | "phone" | "email">): PriorClientIdentity {
  return {
    phoneDigits: normalizePhoneDigits(c.phone),
    emailLower: normalizeEmailLower(c.email),
    fullNameLower: c.fullName.trim().toLowerCase(),
  }
}

export function parseClientsCatalogJson(raw: string | null): Client[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const rows: Client[] = []
    for (const item of parsed) {
      const o = item as Partial<Client> & Record<string, unknown>
      if (
        typeof o.id !== "string" ||
        typeof o.fullName !== "string" ||
        typeof o.phone !== "string" ||
        typeof o.email !== "string"
      )
        continue
      const nh = typeof o.noShowCount === "number" ? o.noShowCount : 0
      const vc = typeof o.visitCount === "number" ? o.visitCount : 0
      const cc = typeof o.confirmedVisitCount === "number" ? o.confirmedVisitCount : 0
      const rs = typeof o.riskScore === "number" ? o.riskScore : 48
      const rt = o.riskTier === "low" || o.riskTier === "medium" || o.riskTier === "high" ? o.riskTier : riskTierFromScore(rs)
      const visits: ClientVisitHistoryItem[] = []
      if (Array.isArray(o.visitHistory)) {
        for (const v of o.visitHistory) {
          const x = v as Partial<ClientVisitHistoryItem>
          if (
            typeof x?.id !== "string" ||
            typeof x?.startsAt !== "string" ||
            typeof x?.serviceLabel !== "string"
          )
            continue
          const st =
            x.status === "booked" ||
            x.status === "pending" ||
            x.status === "confirmed" ||
            x.status === "cancelled" ||
            x.status === "completed" ||
            x.status === "no_show"
              ? x.status
              : "booked"
          visits.push({
            id: x.id,
            startsAt: x.startsAt,
            serviceLabel: x.serviceLabel,
            status: st,
          })
        }
      }
      rows.push({
        id: o.id.trim(),
        fullName: o.fullName.trim(),
        phone: o.phone.trim(),
        email: o.email.trim(),
        visitCount: vc,
        confirmedVisitCount: cc,
        noShowCount: nh,
        notes:
          typeof o.notes === "string" || o.notes === undefined ? (o.notes as string | undefined) : undefined,
        riskScore: rs,
        riskTier: rt,
        visitHistory: visits,
      })
    }
    return rows
  } catch {
    return null
  }
}

function readStoredCatalog(): Client[] | null {
  if (typeof window === "undefined") return null
  try {
    return parseClientsCatalogJson(window.localStorage.getItem(CLIENTS_CATALOG_STORAGE_KEY))
  } catch {
    return null
  }
}

export function persistClientsCatalog(clients: Client[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(CLIENTS_CATALOG_STORAGE_KEY, JSON.stringify(clients))
  } catch {
    // noop
  }
}

type GroupIdentityMap = Record<string, string>
type ExtraNotesMap = Record<string, string>

function readJsonMap(storageKey: string): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== "object") return {}
    return { ...(o as Record<string, string>) }
  } catch {
    return {}
  }
}

function writeJsonMap(storageKey: string, obj: Record<string, string>): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(obj))
  } catch {
    // noop
  }
}

export function persistGroupIdentityMap(map: GroupIdentityMap): void {
  writeJsonMap(CLIENT_GROUP_IDENTITY_STORAGE_KEY, map)
}

export function readGroupIdentityMap(): GroupIdentityMap {
  return readJsonMap(CLIENT_GROUP_IDENTITY_STORAGE_KEY)
}

export function persistExtraNotesMap(map: ExtraNotesMap): void {
  writeJsonMap(CLIENT_NOTES_EXTRA_STORAGE_KEY, map)
}

export function readExtraNotesMap(): ExtraNotesMap {
  return readJsonMap(CLIENT_NOTES_EXTRA_STORAGE_KEY)
}

function bookingGroupKeyFromParts(clientName: string, phone: string, emailRaw: string): string {
  const d = normalizePhoneDigits(phone)
  if (d.length >= 6) return `dig:${d}`
  const e = normalizeEmailLower(emailRaw)
  if (e.includes("@")) return `em:${e}`
  const n = clientName.trim().toLowerCase()
  return `nm:${n}|d:${d}`
}

function groupIdentityKeyFromAppointment(a: Appointment): string {
  return bookingGroupKeyFromParts(String(a.clientName ?? ""), a.phone, String(a.email ?? ""))
}

function bookingGroupKeyFromPrior(prior: PriorClientIdentity): string {
  const syntheticPhone = prior.phoneDigits.length >= 6 ? prior.phoneDigits : ""
  return bookingGroupKeyFromParts(
    prior.fullNameLower || "?",
    syntheticPhone ? `+${syntheticPhone.slice(0, 3)}${syntheticPhone.slice(3)}` : "",
    prior.emailLower
  )
}

function deriveRiskScoreFromStats(total: number, noShowCount: number, confirmedCount: number): number {
  const t = Math.max(total, 1)
  let score = 26 + Math.round((noShowCount / t) * 58)
  score -= Math.round((confirmedCount / t) * 22)
  return Math.max(10, Math.min(92, score))
}

function belongsToScopedBusiness(appt: Appointment, slugNormalized: string | null): boolean {
  const rawSlug = typeof appt.businessSlug === "string" ? appt.businessSlug.trim() : ""
  if (!slugNormalized) return true
  if (!rawSlug) return true
  const bn = normalizePublicSlug(rawSlug)
  if (!bn || bn === DEMO_BOOKING_SLUG) return bn === slugNormalized || bn === DEMO_BOOKING_SLUG
  return bn === slugNormalized
}

function appointmentsMatchPrior(a: Appointment, prior: PriorClientIdentity): boolean {
  const aptDig = normalizePhoneDigits(a.phone)
  if (prior.phoneDigits.length >= 6) return aptDig === prior.phoneDigits
  const ae = normalizeEmailLower(String(a.email ?? ""))
  if (prior.emailLower.includes("@")) return ae !== "" && ae === prior.emailLower
  const nameLc = String(a.clientName ?? "").trim().toLowerCase()
  return (
    nameLc !== "" &&
    nameLc === prior.fullNameLower &&
    aptDig === prior.phoneDigits &&
    prior.phoneDigits !== ""
  )
}

function enrichVisitHistories(rows: Appointment[]): ClientVisitHistoryItem[] {
  const list: ClientVisitHistoryItem[] = []
  rows.forEach((a) => {
    list.push({
      id: `vh-${a.id}`,
      startsAt: a.startsAt,
      serviceLabel: a.serviceLabel,
      status: a.status === "completed" ? "completed" : a.status,
    })
  })
  return list.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
}

function deriveClientsFromScopedAppointments(
  appointments: Appointment[],
  slugNorm: string | null
): Client[] {
  const scoped = appointments.filter((a) => belongsToScopedBusiness(a, slugNorm))

  const buckets = new Map<string, Appointment[]>()
  scoped.forEach((a) => {
    const key = groupIdentityKeyFromAppointment(a)
    const arr = buckets.get(key) ?? []
    arr.push(a)
    buckets.set(key, arr)
  })

  const groupMap = readGroupIdentityMap()
  const extras = readExtraNotesMap()

  const nextGroupMap = { ...groupMap }
  const clients: Client[] = []

  buckets.forEach((apts, key) => {
    let id = nextGroupMap[key]
    if (!id) {
      id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `bk-${djbStableHex(key)}`
      nextGroupMap[key] = id
    }

    const history = enrichVisitHistories(apts.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt)))
    const visitCount = history.length
    let noShowCount = 0
    let confirmedVisitCount = 0
    history.forEach((h) => {
      if (h.status === "no_show") noShowCount += 1
      if (h.status === "confirmed" || h.status === "completed") confirmedVisitCount += 1
    })

    const sample = apts[0]!
    const riskScore = deriveRiskScoreFromStats(visitCount, noShowCount, confirmedVisitCount)

    clients.push({
      id,
      fullName: sample.clientName.trim() || "?",
      phone: sample.phone.trim() || "",
      email: normalizeEmailLower(String(sample.email ?? "")),
      visitCount,
      confirmedVisitCount,
      noShowCount,
      notes: extras[id] ?? undefined,
      riskScore,
      riskTier: riskTierFromScore(riskScore),
      visitHistory: history,
    })
  })

  persistGroupIdentityMap(nextGroupMap)
  clients.sort((a, b) => a.fullName.localeCompare(b.fullName, "pl", { sensitivity: "base" }))
  return clients
}

function djbStableHex(text: string): string {
  let hash = 5381 >>> 0
  for (let i = 0; i < text.length; i += 1) {
    hash = ((((hash << 5) + hash) ^ text.charCodeAt(i)) >>> 0)
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 24)
}

function enrichSupabaseClientsWithHistories(rows: ClientRecord[], appointments: Appointment[], slugNorm: string | null) {
  return rows.map((r) => {
    const scoped = appointments.filter((a) => belongsToScopedBusiness(a, slugNorm))
    const matchAppts = scoped.filter((a) => {
      if (a.clientId && a.clientId === r.id) return true
      const ap = normalizePhoneForMatch(a.phone)
      const rp = normalizePhoneForMatch(r.phone)
      if (ap && rp && ap === rp) return true
      const ae = normalizeEmailForMatch(String(a.email ?? ""))
      const re = normalizeEmailForMatch(String(r.email ?? ""))
      if (re && ae && ae === re) return true
      const dig = normalizePhoneDigits(a.phone)
      const rdig = normalizePhoneDigits(r.phone)
      if (rdig.length >= 6 || dig.length >= 6) return rdig.length >= 6 && dig === rdig
      const aeLegacy = normalizeEmailLower(String(a.email ?? ""))
      const reLegacy = normalizeEmailLower(String(r.email ?? ""))
      if (reLegacy.includes("@")) return aeLegacy !== "" && aeLegacy === reLegacy
      return false
    })
    const visitHistory = enrichVisitHistories(matchAppts)
    let visitCount = 0
    let noShowCount = 0
    let confirmedVisitCount = 0
    if (visitHistory.length > 0) {
      visitCount = visitHistory.length
      visitHistory.forEach((h) => {
        if (h.status === "no_show") noShowCount += 1
        if (h.status === "confirmed" || h.status === "completed") confirmedVisitCount += 1
      })
    } else {
      noShowCount = typeof r.noShowCount === "number" ? Math.max(0, r.noShowCount) : 0
      confirmedVisitCount = typeof r.confirmedCount === "number" ? Math.max(0, r.confirmedCount) : 0
      visitCount = Math.max(1, noShowCount + confirmedVisitCount)
    }

    const riskScore =
      visitHistory.length > 0 ? deriveRiskScoreFromStats(visitCount, noShowCount, confirmedVisitCount) : 44

    const notesVal =
      typeof r.notes === "string" && r.notes.trim().length > 0 ? r.notes.trim() : undefined

    return {
      id: r.id,
      fullName: r.fullName.trim(),
      phone: r.phone.trim(),
      email: normalizeEmailLower(String(r.email ?? "")),
      visitCount,
      confirmedVisitCount,
      noShowCount,
      notes: notesVal,
      riskScore,
      riskTier: riskTierFromScore(riskScore),
      visitHistory,
    } satisfies Client
  })
}

export async function loadClientsWorkspace(): Promise<ClientsWorkspaceLoad> {
  const appointments = typeof window !== "undefined" ? await fetchMergedAppointments() : []

  if (!isSupabaseConfigured()) {
    const snap = readStoredCatalog()
    if (snap && snap.length > 0) {
      return { clients: snap, mode: "snapshot", businessSlug: null, businessProfileId: null }
    }
    return {
      clients: [...initialClientsList],
      mode: "snapshot",
      businessSlug: null,
      businessProfileId: null,
    }
  }

  const sb = getBrowserClient()
  if (!sb) {
    const snap = readStoredCatalog()
    if (snap && snap.length > 0) {
      return { clients: snap, mode: "snapshot", businessSlug: null, businessProfileId: null }
    }
    return {
      clients: [...initialClientsList],
      mode: "snapshot",
      businessSlug: null,
      businessProfileId: null,
    }
  }

  const bid = await getCurrentBusinessProfileIdForClient(sb)
  if (!bid) {
    const snap = readStoredCatalog()
    if (snap && snap.length > 0) {
      return { clients: snap, mode: "snapshot", businessSlug: null, businessProfileId: null }
    }
    return {
      clients: [...initialClientsList],
      mode: "snapshot",
      businessSlug: null,
      businessProfileId: null,
    }
  }

  const { data: bp } = await sb.from("business_profiles").select("slug").eq("id", bid).maybeSingle()
  const slugNormRaw = bp?.slug?.trim() ?? ""
  const slugNorm = slugNormRaw ? normalizePublicSlug(slugNormRaw) : null

  const res = await getClients(sb, bid)
  if (!res.error && res.data && res.data.length > 0) {
    const clients = enrichSupabaseClientsWithHistories(res.data, appointments, slugNorm).sort((a, b) =>
      a.fullName.localeCompare(b.fullName, "pl", { sensitivity: "base" })
    )
    return {
      clients,
      mode: "supabase_clients",
      businessSlug: slugNormRaw || null,
      businessProfileId: bid,
    }
  }

  const derived = deriveClientsFromScopedAppointments(appointments, slugNorm)

  if (derived.length > 0) {
    return {
      clients: derived,
      mode: "derived_from_visits",
      businessSlug: slugNormRaw || null,
      businessProfileId: bid,
    }
  }

  const snapAfterEmpty = readStoredCatalog()
  if (snapAfterEmpty && snapAfterEmpty.length > 0) {
    return {
      clients: snapAfterEmpty,
      mode: "snapshot",
      businessSlug: slugNormRaw || null,
      businessProfileId: bid,
    }
  }

  return {
    clients: [],
    mode: "snapshot",
    businessSlug: slugNormRaw || null,
    businessProfileId: bid,
  }
}

export function isLikelyUuidClientId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim())
}

async function propagateContactToRelatedBookings(
  prior: PriorClientIdentity,
  next: Pick<Client, "fullName" | "phone" | "email">,
  businessProfileId: string | null,
  slugNorm: string | null
): Promise<void> {
  const appointments = await fetchMergedAppointments()
  const sb = getBrowserClient()

  const nameNext = next.fullName.trim()
  const phoneNext = next.phone.trim()
  const emailNext = normalizeEmailLower(next.email).trim()
  const emailForMessaging = emailNext.includes("@") ? emailNext : undefined
  const emailForSb = emailForMessaging ?? null

  for (const appt of appointments) {
    if (!belongsToScopedBusiness(appt, slugNorm)) continue
    if (!appointmentsMatchPrior(appt, prior)) continue

    const rawSbId = unwrapSupabaseBookingAppointmentId(appt.id)
    if (rawSbId && sb && businessProfileId) {
      const patch: TablesUpdate<"bookings"> = {
        client_name: nameNext,
        client_phone: phoneNext,
        client_email: emailForSb,
      }
      await updateBooking(sb, businessProfileId, rawSbId, patch)
      continue
    }

    const pbId = unwrapPublicAppointmentId(appt.id)
    if (pbId) {
      updatePublicBooking(pbId, {
        customerName: nameNext,
        customerPhone: phoneNext,
        customerEmail: emailForMessaging,
      })
      continue
    }

    const maId = unwrapManualAppointmentId(appt.id)
    if (maId) {
      updateManualAppointment(maId, {
        clientName: nameNext,
        clientPhone: phoneNext,
        clientEmail: emailForMessaging,
      })
    }
  }
}

function remapDerivedGroupIdentityStable(clientId: string, prior: PriorClientIdentity, nextName: string, nextPhone: string, nextEmail: string): void {
  const prevKey = bookingGroupKeyFromPrior(prior)
  const nextKey = bookingGroupKeyFromParts(nextName, nextPhone, nextEmail || "")
  const g = readGroupIdentityMap()
  const nextMap = { ...g }
  if (prevKey !== nextKey && nextMap[prevKey] === clientId) {
    delete nextMap[prevKey]
  }
  nextMap[nextKey] = clientId
  persistGroupIdentityMap(nextMap)
}

export async function persistClientUpdates(args: {
  mode: ClientsLoadMode
  clientId: string
  prior: PriorClientIdentity
  nextFields: Pick<Client, "fullName" | "phone" | "email" | "notes">
  businessProfileId: string | null
  businessSlugNormalized: string | null
  currentList: Client[]
}): Promise<{ ok: true; clients: Client[] } | { ok: false }> {
  const { mode, clientId, prior, nextFields, businessProfileId } = args
  const slugNormResolved = args.businessSlugNormalized
    ? normalizePublicSlug(args.businessSlugNormalized)
    : null

  const fullName = nextFields.fullName.trim()
  const phone = nextFields.phone.trim()
  const emailRaw = normalizeEmailLower(nextFields.email).trim()
  const notesTrim = nextFields.notes?.trim() ?? ""

  const sb = getBrowserClient()

  if (mode === "supabase_clients" && businessProfileId && sb && isLikelyUuidClientId(clientId)) {
    const patchRes = await updateClient(sb, businessProfileId, clientId, {
      full_name: fullName,
      phone,
      email: emailRaw || "",
      notes: notesTrim.length > 0 ? notesTrim : null,
    })
    if (patchRes.error || !patchRes.data) return { ok: false }
    await propagateContactToRelatedBookings(prior, { ...nextFields, fullName, phone, email: emailRaw }, businessProfileId, slugNormResolved)
    const reload = await loadClientsWorkspace()
    return { ok: true, clients: reload.clients }
  }

  if (mode === "derived_from_visits") {
    const extras = { ...readExtraNotesMap() }
    if (notesTrim.length > 0) extras[clientId] = notesTrim
    else delete extras[clientId]
    persistExtraNotesMap(extras)
    remapDerivedGroupIdentityStable(clientId, prior, fullName, phone, emailRaw)
  }

  await propagateContactToRelatedBookings(
    prior,
    { ...nextFields, fullName, phone, email: emailRaw },
    businessProfileId,
    slugNormResolved
  )

  if (mode === "derived_from_visits") {
    const loaded = await loadClientsWorkspace()
    const extraMapNext = readExtraNotesMap()
    const patched = loaded.clients.map((row) => {
      const overlay = extraMapNext[row.id]
      if (overlay === undefined) return row
      const n = overlay.trim()
      return n.length > 0 ? { ...row, notes: n } : { ...row, notes: undefined }
    })
    patched.sort((a, b) => a.fullName.localeCompare(b.fullName, "pl", { sensitivity: "base" }))
    return { ok: true, clients: patched }
  }

  const merged = args.currentList
    .map((c) =>
      c.id === clientId ? { ...c, fullName, phone, email: emailRaw, notes: notesTrim || undefined } : c
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pl", { sensitivity: "base" }))

  persistClientsCatalog(merged)
  return { ok: true, clients: merged }
}
