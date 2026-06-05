import type { SupabaseClient } from "@supabase/supabase-js"

import {
  peekCachedBusinessProfileId,
  setCachedBusinessProfileId,
} from "@/lib/auth/business-profile-cache"
import { resolvePublicBookingBusinessProfile } from "@/lib/business/public-booking-slug"
import { DEMO_BOOKING_SLUG } from "@/lib/business/slug"
import { isSupabaseConfigured } from "@/lib/supabase/client"
import { initialServicesList } from "@/data/mock-services"
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/types/database"
import type { Service } from "@/types/domain"

export const SERVICES_STORAGE_KEY = "services"

const LEGACY_SERVICE_KEYS = ["business-services"]

export type ServicesSupabaseClient = SupabaseClient<Database>

type PublicActiveServiceRow =
  Database["public"]["Functions"]["get_active_services_by_business_slug"]["Returns"][number]

type ServiceRow = Tables<"services">

function normalizeService(raw: unknown): Service | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Partial<Service>
  if (
    typeof o.id !== "string" ||
    typeof o.name !== "string" ||
    typeof o.durationMinutes !== "number" ||
    typeof o.price !== "number"
  ) {
    return null
  }
  if (typeof o.isActive !== "boolean") return null
  return {
    id: o.id.trim(),
    name: o.name.trim(),
    description: typeof o.description === "string" && o.description.trim() ? o.description.trim() : undefined,
    durationMinutes: Math.max(1, Math.floor(o.durationMinutes)),
    price: Math.max(0, o.price),
    isActive: o.isActive,
    businessId: typeof o.businessId === "string" ? o.businessId : undefined,
    usesDefaultAvailability:
      typeof o.usesDefaultAvailability === "boolean" ? o.usesDefaultAvailability : true,
  }
}

function dedupeByIdPreserveLast<T extends { id: string }>(list: T[]): T[] {
  const indexById = new Map<string, number>()
  list.forEach((item, idx) => {
    indexById.set(item.id, idx)
  })
  return list.filter((item, idx) => indexById.get(item.id) === idx)
}

function writeLocalServices(all: Service[]): void {
  if (typeof window === "undefined") return
  try {
    const deduped = dedupeByIdPreserveLast(all)
    window.localStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(deduped))
    window.dispatchEvent(new Event("pw-services"))
  } catch {
    // noop
  }
}

function tryMigrateFromLegacyKeys(): Service[] | null {
  if (typeof window === "undefined") return null
  for (const key of LEGACY_SERVICE_KEYS) {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) continue
      const next = parsed.map(normalizeService).filter((x): x is Service => x !== null)
      const deduped = dedupeByIdPreserveLast(next)
      if (deduped.length > 0) {
        window.localStorage.removeItem(key)
        writeLocalServices(deduped)
        return deduped
      }
    } catch {
      // next key
    }
  }
  return null
}

function seedDefaultsToStorage(): Service[] {
  const seed = dedupeByIdPreserveLast([...initialServicesList])
  writeLocalServices(seed)
  return seed
}

/** Lista usług z localStorage (demo, brak Supabase lub brak profilu firmy). */
export function getLocalServices(): Service[] {
  if (typeof window === "undefined") {
    return dedupeByIdPreserveLast([...initialServicesList])
  }
  try {
    const raw = window.localStorage.getItem(SERVICES_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const out = parsed.map(normalizeService).filter((x): x is Service => x !== null)
        const deduped = dedupeByIdPreserveLast(out)
        if (deduped.length > 0) return deduped
      }
    }
    const migrated = tryMigrateFromLegacyKeys()
    if (migrated && migrated.length > 0) return migrated

    return seedDefaultsToStorage()
  } catch {
    return dedupeByIdPreserveLast([...initialServicesList])
  }
}

export function getLocalActiveServices(): Service[] {
  return getLocalServices().filter((s) => s.isActive)
}

function saveLocalServices(services: Service[]): void {
  if (typeof window === "undefined") return
  const normalized = dedupeByIdPreserveLast(
    services.map((s) => normalizeService(s)).filter((x): x is Service => x !== null)
  )
  writeLocalServices(normalized)
}

type ServiceRowMapping = Pick<
  ServiceRow,
  | "id"
  | "business_id"
  | "name"
  | "description"
  | "duration_minutes"
  | "price"
  | "currency"
  | "is_active"
  | "uses_default_availability"
> & {
  break_minutes?: number | null
}

function mapDbRowToService(row: ServiceRowMapping): Service {
  const desc = row.description?.trim()
  const cur = typeof row.currency === "string" && row.currency.trim() ? row.currency.trim() : undefined
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name.trim(),
    description: desc && desc.length > 0 ? desc : undefined,
    durationMinutes: Math.max(0, Math.floor(Number(row.duration_minutes))),
    breakMinutes:
      row.break_minutes != null && Number.isFinite(Number(row.break_minutes))
        ? Math.max(0, Math.floor(Number(row.break_minutes)))
        : null,
    price: Math.max(0, Number(row.price)),
    currency: cur,
    isActive: row.is_active,
    usesDefaultAvailability:
      typeof row.uses_default_availability === "boolean" ? row.uses_default_availability : true,
  }
}

function rpcRowToBookingService(r: PublicActiveServiceRow): Service {
  return mapDbRowToService({
    id: r.id,
    business_id: r.business_id,
    name: r.name,
    description: r.description ?? null,
    duration_minutes: Math.max(1, Math.floor(Number(r.duration_minutes) || 0)),
    break_minutes:
      r.break_minutes != null && Number.isFinite(Number(r.break_minutes))
        ? Math.max(0, Math.floor(Number(r.break_minutes)))
        : null,
    price: Math.max(0, Number(r.price) || 0),
    currency: typeof r.currency === "string" && r.currency.trim() ? r.currency.trim() : "PLN",
    is_active: Boolean(r.is_active),
    uses_default_availability:
      typeof r.uses_default_availability === "boolean" ? r.uses_default_availability : true,
  })
}

/**
 * Publiczny /book/[slug]: odczyt usług bez RPC (fallback gdy brak funkcji w cache / migracji).
 * Nie używa visible_online. Priorytet: filtr `is_active = true` w SQL; jeśli kolumny brak — ostatnia próba bez pola is_active.
 */
async function fetchPublicBookingServicesDirect(
  client: ServicesSupabaseClient,
  businessId: string
): Promise<{ services: Service[]; error?: string }> {
  type Raw = Record<string, unknown>

  const mapRows = (rows: Raw[] | null | undefined): Service[] => {
    if (!rows?.length) return []
    return rows
      .map((raw) =>
        mapDbRowToService({
          id: String(raw.id ?? ""),
          business_id: String(raw.business_id ?? ""),
          name: String(raw.name ?? ""),
          description: typeof raw.description === "string" ? raw.description : "",
          duration_minutes: Math.max(1, Math.floor(Number(raw.duration_minutes) || 0)),
          break_minutes:
            raw.break_minutes != null && Number.isFinite(Number(raw.break_minutes))
              ? Math.max(0, Math.floor(Number(raw.break_minutes)))
              : null,
          price: Math.max(0, Number(raw.price) || 0),
          currency: typeof raw.currency === "string" && raw.currency.trim() ? raw.currency.trim() : "PLN",
          is_active: typeof raw.is_active === "boolean" ? raw.is_active : true,
          uses_default_availability:
            typeof raw.uses_default_availability === "boolean" ? raw.uses_default_availability : true,
        })
      )
      .filter((s) => s.isActive)
  }

  async function exec(
    selectList: string,
    filterActiveInDb: boolean,
    dualOrder: boolean
  ): Promise<{ rows: Raw[] | null; err: string | null }> {
    let q = client.from("services").select(selectList).eq("business_id", businessId)
    if (filterActiveInDb) q = q.eq("is_active", true)
    const res = dualOrder
      ? await q.order("sort_order", { ascending: true }).order("created_at", { ascending: true })
      : await q.order("created_at", { ascending: true })
    if (res.error) return { rows: null, err: res.error.message }
    return { rows: ((res.data ?? []) as unknown) as Raw[], err: null }
  }

  const fullCols =
    "id, business_id, name, description, duration_minutes, break_minutes, price, currency, is_active, sort_order, uses_default_availability, created_at"
  const minActiveCols =
    "id, business_id, name, description, duration_minutes, break_minutes, price, currency, is_active, created_at"

  const attempts = [
    { cols: fullCols, filterActiveInDb: true, dualOrder: true },
    { cols: minActiveCols, filterActiveInDb: true, dualOrder: false },
    { cols: fullCols, filterActiveInDb: false, dualOrder: true },
    { cols: minActiveCols, filterActiveInDb: false, dualOrder: false },
  ] as const

  let lastErr = "services_direct_select_failed"

  for (const att of attempts) {
    const { rows, err } = await exec(att.cols, att.filterActiveInDb, att.dualOrder)
    if (!err && rows !== null) {
      return { services: mapRows(rows) }
    }
    if (err) lastErr = err
  }

  if (lastErr.toLowerCase().includes("is_active")) {
    const minBareCols =
      "id, business_id, name, description, duration_minutes, price, currency, created_at"
    const { rows, err } = await exec(minBareCols, false, false)
    if (!err && rows !== null) {
      return { services: mapRows(rows) }
    }
    if (err) lastErr = err
  }

  return { services: [], error: lastErr }
}

function isSupabaseServicesPath(client: ServicesSupabaseClient | null, businessProfileId: string | null): boolean {
  return Boolean(client && businessProfileId && isSupabaseConfigured())
}

/** Wszystkie usługi firmy (panel) lub lista lokalna w trybie fallback. */
export async function getServices(
  client: ServicesSupabaseClient | null,
  businessProfileId: string | null
): Promise<Service[]> {
  if (!isSupabaseServicesPath(client, businessProfileId)) {
    return getLocalServices()
  }
  const c = client!
  const bid = businessProfileId!
  const { data, error } = await c
    .from("services")
    .select(
      "id, business_id, name, description, duration_minutes, break_minutes, price, currency, is_active, sort_order, uses_default_availability"
    )
    .eq("business_id", bid)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
  if (error) {
    const maybeMissingColumn =
      error.message.includes("uses_default_availability") || error.message.includes("sort_order")
    if (!maybeMissingColumn) throw new Error(error.message)

    const { data: fallbackData, error: fallbackError } = await c
      .from("services")
      .select("id, business_id, name, description, duration_minutes, break_minutes, price, currency, is_active")
      .eq("business_id", bid)
      .order("created_at", { ascending: true })
    if (fallbackError) throw new Error(fallbackError.message)
    if (!fallbackData) return []
    return fallbackData.map((row) =>
      mapDbRowToService({
        ...(row as ServiceRowMapping),
        uses_default_availability: true,
      })
    )
  }
  if (!data) return []
  return data.map(mapDbRowToService)
}

export async function getServicesForBusiness(
  client: ServicesSupabaseClient | null,
  businessId: string | null
): Promise<Service[]> {
  return getServices(client, businessId)
}

export type PublicActiveServicesForSlugResult = {
  services: Service[]
  loadFailed: boolean
  businessFound: boolean
  loadDiagnostics?: string | null
  /** Ślad diagnostyczny — skąd załadowano katalog przy sukcesie. */
  loadSource?: "rpc_slug" | "direct_select"
}

/**
 * Publiczny katalog usług: firma po slug w business_profiles, potem aktywne services.
 * Demo slug studio-potwierdzen: tylko localStorage (bez mieszania z Supabase).
 */
export async function getActiveServicesForBusinessSlug(
  client: ServicesSupabaseClient | null,
  slug: string
): Promise<PublicActiveServicesForSlugResult> {
  const normalized = slug.trim().toLowerCase()
  if (normalized === DEMO_BOOKING_SLUG) {
    return { services: getLocalActiveServices(), loadFailed: false, businessFound: true }
  }
  if (!isSupabaseConfigured() || !client) {
    return { services: [], loadFailed: false, businessFound: false }
  }

  const resolved = await resolvePublicBookingBusinessProfile(client, normalized)
  if (resolved.rpcFailed && !resolved.businessId) {
    return {
      services: [],
      loadFailed: true,
      businessFound: false,
      loadDiagnostics: resolved.message ?? "get_business_profile_by_slug",
    }
  }
  if (!resolved.businessId) {
    return { services: [], loadFailed: false, businessFound: false }
  }

  const { data: rpcRows, error: rpcError } = await client.rpc("get_active_services_by_business_slug", {
    p_slug: normalized,
  })

  if (!rpcError && Array.isArray(rpcRows)) {
    return {
      services: rpcRows.length ? rpcRows.map((r) => rpcRowToBookingService(r as PublicActiveServiceRow)) : [],
      loadFailed: false,
      businessFound: true,
      loadSource: "rpc_slug",
    }
  }

  const fallback = await fetchPublicBookingServicesDirect(client, resolved.businessId)
  if (fallback.error) {
    const rpcMsg = rpcError?.message ?? "rpc_get_active_services_by_business_slug"
    return {
      services: [],
      loadFailed: true,
      businessFound: true,
      loadDiagnostics: `${rpcMsg} · ${fallback.error}`,
    }
  }

  return {
    services: fallback.services,
    loadFailed: false,
    businessFound: true,
    loadSource: "direct_select",
  }
}

export type ServiceInput = {
  name: string
  description?: string
  durationMinutes: number
  breakMinutes?: number | null
  price: number
  isActive: boolean
  currency?: string
  usesDefaultAvailability?: boolean
}

export async function addService(
  client: ServicesSupabaseClient | null,
  businessProfileId: string | null,
  input: ServiceInput
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseServicesPath(client, businessProfileId)) {
    const id = crypto.randomUUID()
    const n: Service = {
      id,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      durationMinutes: Math.max(5, Math.floor(input.durationMinutes)),
      breakMinutes:
        input.breakMinutes != null && Number.isFinite(Number(input.breakMinutes))
          ? Math.max(0, Math.floor(Number(input.breakMinutes)))
          : null,
      price: Math.max(0, input.price),
      currency: "PLN",
      isActive: input.isActive,
      usesDefaultAvailability: input.usesDefaultAvailability ?? true,
    }
    saveLocalServices([n, ...getLocalServices()])
    return { ok: true }
  }
  const c = client!
  const bid = businessProfileId!
  const basePayload: TablesInsert<"services"> = {
    business_id: bid,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    duration_minutes: Math.max(1, Math.floor(input.durationMinutes)),
    break_minutes:
      input.breakMinutes != null && Number.isFinite(Number(input.breakMinutes))
        ? Math.max(0, Math.floor(Number(input.breakMinutes)))
        : null,
    price: Math.max(0, input.price),
    currency: "PLN",
    is_active: input.isActive,
  }

  const attempts: TablesInsert<"services">[] = [
    {
      ...basePayload,
      sort_order: 0,
      uses_default_availability: input.usesDefaultAvailability ?? true,
    },
    {
      ...basePayload,
      sort_order: 0,
    },
    {
      ...basePayload,
      uses_default_availability: input.usesDefaultAvailability ?? true,
    },
    basePayload,
  ]

  let lastError: string | null = null
  for (const payload of attempts) {
    const { error } = await c.from("services").insert(payload)
    if (!error) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("pw-services"))
      }
      return { ok: true }
    }
    lastError = error.message
  }

  return { ok: false, error: lastError ?? "insert_failed" }
}

export async function updateService(
  client: ServicesSupabaseClient | null,
  businessProfileId: string | null,
  serviceId: string,
  updates: Partial<Omit<Service, "id" | "businessId">>
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseServicesPath(client, businessProfileId)) {
    const list = getLocalServices()
    if (!list.some((s) => s.id === serviceId)) return { ok: false, error: "not_found" }
    saveLocalServices(
      list.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              ...updates,
              id: serviceId,
              name: updates.name !== undefined ? updates.name.trim() : s.name,
              description:
                updates.description !== undefined
                  ? updates.description?.trim() || undefined
                  : s.description,
              durationMinutes: updates.durationMinutes !== undefined ? Math.max(1, Math.floor(updates.durationMinutes)) : s.durationMinutes,
              breakMinutes:
                updates.breakMinutes !== undefined
                  ? updates.breakMinutes != null
                    ? Math.max(0, Math.floor(Number(updates.breakMinutes)))
                    : null
                  : s.breakMinutes,
              price: updates.price !== undefined ? Math.max(0, updates.price) : s.price,
              currency: "PLN",
              isActive: updates.isActive !== undefined ? updates.isActive : s.isActive,
              usesDefaultAvailability:
                updates.usesDefaultAvailability !== undefined
                  ? updates.usesDefaultAvailability
                  : s.usesDefaultAvailability,
            }
          : s
      )
    )
    return { ok: true }
  }
  const c = client!
  const patch: TablesUpdate<"services"> = {}
  if (updates.name !== undefined) patch.name = updates.name.trim()
  if (updates.description !== undefined) patch.description = updates.description?.trim() ?? ""
  if (updates.durationMinutes !== undefined) {
    patch.duration_minutes = Math.max(1, Math.floor(updates.durationMinutes))
  }
  if (updates.breakMinutes !== undefined) {
    patch.break_minutes =
      updates.breakMinutes != null && Number.isFinite(Number(updates.breakMinutes))
        ? Math.max(0, Math.floor(Number(updates.breakMinutes)))
        : null
  }
  if (updates.price !== undefined) patch.price = Math.max(0, updates.price)
  patch.currency = "PLN"
  if (updates.isActive !== undefined) patch.is_active = updates.isActive
  if (updates.usesDefaultAvailability !== undefined) {
    patch.uses_default_availability = updates.usesDefaultAvailability
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true }
  }

  const { error } = await c
    .from("services")
    .update(patch)
    .eq("id", serviceId)
    .eq("business_id", businessProfileId!)
  if (error) return { ok: false, error: error.message }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pw-services"))
  }
  return { ok: true }
}

export async function deleteService(
  client: ServicesSupabaseClient | null,
  businessProfileId: string | null,
  serviceId: string
): Promise<{ ok: boolean; error?: string; mode?: "deleted" | "hidden" }> {
  if (!isSupabaseServicesPath(client, businessProfileId)) {
    saveLocalServices(getLocalServices().filter((s) => s.id !== serviceId))
    return { ok: true, mode: "deleted" }
  }
  const c = client!
  const { data: relatedRows, error: relatedErr } = await c
    .from("bookings")
    .select("id")
    .eq("business_id", businessProfileId!)
    .eq("service_id", serviceId)
    .limit(1)
  if (relatedErr) return { ok: false, error: relatedErr.message }

  if ((relatedRows?.length ?? 0) > 0) {
    const { error: hideErr } = await c
      .from("services")
      .update({ is_active: false })
      .eq("id", serviceId)
      .eq("business_id", businessProfileId!)
    if (hideErr) return { ok: false, error: hideErr.message }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("pw-services"))
    }
    return { ok: true, mode: "hidden" }
  }

  const { error } = await c
    .from("services")
    .delete()
    .eq("id", serviceId)
    .eq("business_id", businessProfileId!)
  if (error) return { ok: false, error: error.message }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pw-services"))
  }
  return { ok: true, mode: "deleted" }
}

export async function toggleServiceActive(
  client: ServicesSupabaseClient | null,
  businessProfileId: string | null,
  serviceId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseServicesPath(client, businessProfileId)) {
    const list = getLocalServices()
    const target = list.find((s) => s.id === serviceId)
    if (!target) return { ok: false, error: "not_found" }
    return updateService(client, businessProfileId, serviceId, { isActive: !target.isActive })
  }
  const c = client!
  const { data, error: readErr } = await c
    .from("services")
    .select("is_active")
    .eq("id", serviceId)
    .eq("business_id", businessProfileId!)
    .maybeSingle()
  if (readErr || data === null) return { ok: false, error: readErr?.message ?? "not_found" }
  const { error } = await c
    .from("services")
    .update({ is_active: !data.is_active })
    .eq("id", serviceId)
    .eq("business_id", businessProfileId!)
  if (error) return { ok: false, error: error.message }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pw-services"))
  }
  return { ok: true }
}

/** Odczyt id profilu firmy zalogowanego użytkownika (tylko klient). */
export async function getCurrentBusinessProfileIdForClient(
  client: ServicesSupabaseClient,
  knownBusinessId?: string | null,
): Promise<string | null> {
  const trimmedKnown = knownBusinessId?.trim()
  if (trimmedKnown) {
    setCachedBusinessProfileId(trimmedKnown)
    return trimmedKnown
  }
  const cached = peekCachedBusinessProfileId()
  if (cached !== undefined) return cached

  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user?.id) {
    setCachedBusinessProfileId(null)
    return null
  }
  const { data: owned, error: ownErr } = await client
    .from("business_profiles")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle()
  if (!ownErr && owned?.id) return owned.id
  const { data: memberRows, error: memErr } = await client
    .from("business_members")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)

  if (!memErr && memberRows?.length) {
    const id = memberRows[0].business_id ?? null
    setCachedBusinessProfileId(id)
    return id
  }

  const isMissingIsActive =
    typeof memErr?.message === "string" &&
    memErr.message.toLowerCase().includes("is_active") &&
    memErr.message.toLowerCase().includes("does not exist")

  if (!memErr || isMissingIsActive) {
    const { data: fallbackMembers, error: fallbackErr } = await client
      .from("business_members")
      .select("business_id")
      .eq("user_id", user.id)
      .limit(1)
    if (!fallbackErr && fallbackMembers?.length) {
      const id = fallbackMembers[0].business_id ?? null
      setCachedBusinessProfileId(id)
      return id
    }
  }

  setCachedBusinessProfileId(null)
  return null
}
