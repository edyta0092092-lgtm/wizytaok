import type { SupabaseClient } from "@supabase/supabase-js"

import { resolvePublicBookingBusinessProfileId } from "@/lib/business/public-booking-slug"
import { DEMO_BOOKING_SLUG } from "@/lib/business/slug"
import { getDefaultAvailabilityDays } from "@/data/default-availability-week"
import { isSupabaseConfigured } from "@/lib/supabase/client"
import type {
  AvailabilityExceptionRecord,
  ServiceAvailabilityRuleRecord,
} from "@/lib/booking/effective-availability"
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/types/database"
import type { AvailabilityDay } from "@/types/domain"

export const AVAILABILITY_STORAGE_KEY = "pw-availability-rules-v1"

export type AvailabilityStoreClient = SupabaseClient<Database>

type RuleRow = Tables<"availability_rules">
type ExceptionRow = Tables<"availability_exceptions">
type ServiceRuleRow = Tables<"service_availability_rules">

const UI_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

const LABEL_BY_WEEKDAY: Record<number, AvailabilityDay["label"]> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
}

function formatTimeFromDb(value: string): string {
  const s = String(value).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return "09:00"
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`
}

function toPgTime(hhmm: string): string {
  const parts = hhmm.trim().split(":")
  const h = Math.min(23, Math.max(0, Number(parts[0] ?? 0)))
  const m = Math.min(59, Math.max(0, Number(parts[1] ?? 0)))
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`
}

function dispatchAvailabilityUpdated() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event("pw-availability"))
}

function isSupabaseAvailabilityPath(
  client: AvailabilityStoreClient | null,
  businessProfileId: string | null
): boolean {
  return Boolean(client && businessProfileId && isSupabaseConfigured())
}

function mergeRowsWithTemplate(rows: RuleRow[]): AvailabilityDay[] {
  const byWeekday = new Map(rows.map((r) => [r.weekday, r]))
  return UI_ORDER.map((weekday) => {
    const label = LABEL_BY_WEEKDAY[weekday] ?? "monday"
    const row = byWeekday.get(weekday)
    if (!row) {
      return {
        id: `wd-${weekday}`,
        weekday,
        label,
        isOpen: weekday >= 1 && weekday <= 5,
        startTime: "09:00",
        endTime: "17:00",
      }
    }
    return {
      id: row.id,
      weekday: row.weekday,
      label,
      isOpen: row.is_open,
      startTime: formatTimeFromDb(row.start_time),
      endTime: formatTimeFromDb(row.end_time),
    }
  })
}

/** Odczyt z localStorage (fallback). */
export function getLocalAvailabilityDays(): AvailabilityDay[] {
  if (typeof window === "undefined") return getDefaultAvailabilityDays()
  try {
    const raw = window.localStorage.getItem(AVAILABILITY_STORAGE_KEY)
    if (!raw) return getDefaultAvailabilityDays()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return getDefaultAvailabilityDays()
    const byWeekday = new Map<number, Partial<AvailabilityDay>>()
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue
      const o = item as Record<string, unknown>
      const wd = typeof o.weekday === "number" ? o.weekday : Number(o.weekday)
      if (!Number.isFinite(wd) || wd < 0 || wd > 6) continue
      byWeekday.set(wd, {
        weekday: wd,
        isOpen: Boolean(o.isOpen ?? o.is_open),
        startTime: typeof o.startTime === "string" ? o.startTime : "09:00",
        endTime: typeof o.endTime === "string" ? o.endTime : "17:00",
      })
    }
    return UI_ORDER.map((weekday) => {
      const label = LABEL_BY_WEEKDAY[weekday] ?? "monday"
      const patch = byWeekday.get(weekday)
      if (!patch) {
        return {
          id: `wd-${weekday}`,
          weekday,
          label,
          isOpen: weekday >= 1 && weekday <= 5,
          startTime: "09:00",
          endTime: "17:00",
        }
      }
      return {
        id: `wd-${weekday}`,
        weekday,
        label,
        isOpen: Boolean(patch.isOpen),
        startTime: typeof patch.startTime === "string" ? patch.startTime : "09:00",
        endTime: typeof patch.endTime === "string" ? patch.endTime : "17:00",
      }
    })
  } catch {
    return getDefaultAvailabilityDays()
  }
}

function writeLocalAvailabilityDays(days: AvailabilityDay[]): void {
  if (typeof window === "undefined") return
  try {
    const payload = days.map((d) => ({
      weekday: d.weekday,
      isOpen: d.isOpen,
      startTime: d.startTime,
      endTime: d.endTime,
    }))
    window.localStorage.setItem(AVAILABILITY_STORAGE_KEY, JSON.stringify(payload))
    dispatchAvailabilityUpdated()
  } catch {
    // noop
  }
}

/** Reguły zalogowanej firmy (panel) lub localStorage. */
export async function getAvailabilityRules(
  client: AvailabilityStoreClient | null,
  businessProfileId: string | null
): Promise<AvailabilityDay[]> {
  if (!isSupabaseAvailabilityPath(client, businessProfileId)) {
    return getLocalAvailabilityDays()
  }
  const c = client!
  const bid = businessProfileId!
  const { data, error } = await c
    .from("availability_rules")
    .select("*")
    .eq("business_id", bid)
    .order("weekday", { ascending: true })
  if (error) throw new Error(error.message)
  return mergeRowsWithTemplate(data ?? [])
}

export async function getAvailabilityForBusiness(
  client: AvailabilityStoreClient | null,
  businessId: string | null
): Promise<AvailabilityDay[]> {
  return getAvailabilityRules(client, businessId)
}

export type PublicAvailabilityForSlugResult = {
  days: AvailabilityDay[]
  loadFailed: boolean
  notConfigured: boolean
  strict: boolean
}

/**
 * Dostępność dla publicznego bookingu: po firmie w Supabase tylko reguły z bazy (strict).
 * Demo slug i brak Supabase: localStorage + brak strict (sloty legacy możliwe w kalendarzu).
 */
export async function getAvailabilityForBusinessSlug(
  client: AvailabilityStoreClient | null,
  slug: string
): Promise<PublicAvailabilityForSlugResult> {
  const normalized = slug.trim().toLowerCase()
  if (normalized === DEMO_BOOKING_SLUG) {
    return {
      days: getLocalAvailabilityDays(),
      loadFailed: false,
      notConfigured: false,
      strict: false,
    }
  }
  if (!isSupabaseConfigured() || !client) {
    return {
      days: getLocalAvailabilityDays(),
      loadFailed: false,
      notConfigured: false,
      strict: false,
    }
  }

  const resolved = await resolvePublicBookingBusinessProfileId(client, normalized)
  if (resolved.rpcFailed) {
    return { days: [], loadFailed: true, notConfigured: false, strict: true }
  }
  if (!resolved.businessId) {
    return { days: [], loadFailed: false, notConfigured: false, strict: true }
  }

  const { data: rows, error: rulesError } = await client
    .from("availability_rules")
    .select("id, business_id, weekday, is_open, start_time, end_time, created_at, updated_at")
    .eq("business_id", resolved.businessId)
    .order("weekday", { ascending: true })

  if (rulesError) {
    return { days: [], loadFailed: true, notConfigured: false, strict: true }
  }
  if (!rows?.length) {
    return {
      days: mergeRowsWithTemplate([]),
      loadFailed: false,
      notConfigured: true,
      strict: true,
    }
  }

  return {
    days: mergeRowsWithTemplate(rows as RuleRow[]),
    loadFailed: false,
    notConfigured: false,
    strict: true,
  }
}

export async function saveAvailabilityRules(
  client: AvailabilityStoreClient | null,
  businessProfileId: string | null,
  days: AvailabilityDay[]
): Promise<{ ok: boolean; error?: string }> {
  const byWeekday = new Map(days.map((d) => [d.weekday, d]))
  const merged: AvailabilityDay[] = UI_ORDER.map((weekday) => {
    const hit = byWeekday.get(weekday)
    const label = LABEL_BY_WEEKDAY[weekday] ?? "monday"
    if (hit) return { ...hit, weekday, label }
    const def = getDefaultAvailabilityDays().find((x) => x.weekday === weekday)!
    return def
  })

  if (!isSupabaseAvailabilityPath(client, businessProfileId)) {
    writeLocalAvailabilityDays(merged)
    return { ok: true }
  }

  const c = client!
  const bid = businessProfileId!
  const payload: TablesInsert<"availability_rules">[] = merged.map((d) => ({
    business_id: bid,
    weekday: d.weekday,
    is_open: d.isOpen,
    start_time: toPgTime(d.startTime),
    end_time: toPgTime(d.endTime),
  }))

  const { error } = await c.from("availability_rules").upsert(payload, {
    onConflict: "business_id,weekday",
  })
  if (error) return { ok: false, error: error.message }
  dispatchAvailabilityUpdated()
  return { ok: true }
}

export async function updateAvailabilityRule(
  client: AvailabilityStoreClient | null,
  businessProfileId: string | null,
  ruleId: string,
  updates: Partial<Pick<AvailabilityDay, "isOpen" | "startTime" | "endTime">>
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseAvailabilityPath(client, businessProfileId)) {
    const list = getLocalAvailabilityDays()
    const next = list.map((d) =>
      d.id === ruleId
        ? {
            ...d,
            isOpen: updates.isOpen !== undefined ? updates.isOpen : d.isOpen,
            startTime: updates.startTime !== undefined ? updates.startTime : d.startTime,
            endTime: updates.endTime !== undefined ? updates.endTime : d.endTime,
          }
        : d
    )
    writeLocalAvailabilityDays(next)
    return { ok: true }
  }
  const patch: TablesUpdate<"availability_rules"> = {}
  if (updates.isOpen !== undefined) patch.is_open = updates.isOpen
  if (updates.startTime !== undefined) patch.start_time = toPgTime(updates.startTime)
  if (updates.endTime !== undefined) patch.end_time = toPgTime(updates.endTime)
  if (Object.keys(patch).length === 0) return { ok: true }
  const { error } = await client!.from("availability_rules").update(patch).eq("id", ruleId)
  if (error) return { ok: false, error: error.message }
  dispatchAvailabilityUpdated()
  return { ok: true }
}

export type AvailabilityRuleUpsertInput = {
  weekday: number
  isOpen: boolean
  startTime: string
  endTime: string
}

export async function upsertAvailabilityRule(
  client: AvailabilityStoreClient | null,
  businessProfileId: string | null,
  input: AvailabilityRuleUpsertInput
): Promise<{ ok: boolean; error?: string }> {
  const wd = Math.max(0, Math.min(6, Math.floor(input.weekday)))
  const label = LABEL_BY_WEEKDAY[wd] ?? "monday"
  const day: AvailabilityDay = {
    id: `wd-${wd}`,
    weekday: wd,
    label,
    isOpen: input.isOpen,
    startTime: input.startTime,
    endTime: input.endTime,
  }
  const full = getDefaultAvailabilityDays().map((d) => (d.weekday === wd ? day : d))
  return saveAvailabilityRules(client, businessProfileId, full)
}

function mapExceptionRow(r: ExceptionRow): AvailabilityExceptionRecord {
  return {
    id: r.id,
    business_id: r.business_id,
    exception_date: String(r.exception_date).slice(0, 10),
    is_closed: r.is_closed,
    start_time: r.start_time,
    end_time: r.end_time,
    reason: r.reason,
  }
}

function mapServiceRuleRow(r: ServiceRuleRow): ServiceAvailabilityRuleRecord {
  return {
    id: r.id,
    business_id: r.business_id,
    service_id: r.service_id,
    weekday: r.weekday,
    is_available: r.is_available,
    start_time: String(r.start_time),
    end_time: String(r.end_time),
  }
}

export async function getAvailabilityExceptionsForBusiness(
  client: AvailabilityStoreClient | null,
  businessProfileId: string | null,
  dateFrom?: string,
  dateTo?: string
): Promise<AvailabilityExceptionRecord[]> {
  if (!isSupabaseAvailabilityPath(client, businessProfileId)) return []
  const c = client!
  const bid = businessProfileId!
  let q = c
    .from("availability_exceptions")
    .select("*")
    .eq("business_id", bid)
    .order("exception_date", { ascending: true })
  if (dateFrom) q = q.gte("exception_date", dateFrom.trim().slice(0, 10))
  if (dateTo) q = q.lte("exception_date", dateTo.trim().slice(0, 10))
  const { data, error } = await q
  if (error || !data) return []
  return (data as ExceptionRow[]).map(mapExceptionRow)
}

export async function fetchAvailabilityExceptionsForPublicSlug(
  client: AvailabilityStoreClient | null,
  slug: string,
  dateFrom: string,
  dateTo: string
): Promise<{ rows: AvailabilityExceptionRecord[]; loadFailed: boolean }> {
  const normalized = slug.trim().toLowerCase()
  if (!isSupabaseConfigured() || !client || normalized === DEMO_BOOKING_SLUG) {
    return { rows: [], loadFailed: false }
  }
  const resolved = await resolvePublicBookingBusinessProfileId(client, normalized)
  if (resolved.rpcFailed || !resolved.businessId) {
    return { rows: [], loadFailed: resolved.rpcFailed }
  }
  const { data, error } = await client
    .from("availability_exceptions")
    .select("*")
    .eq("business_id", resolved.businessId)
    .gte("exception_date", dateFrom.trim().slice(0, 10))
    .lte("exception_date", dateTo.trim().slice(0, 10))
    .order("exception_date", { ascending: true })
  if (error || !data) return { rows: [], loadFailed: Boolean(error) }
  return { rows: (data as ExceptionRow[]).map(mapExceptionRow), loadFailed: false }
}

export async function fetchServiceAvailabilityRulesForPublicSlug(
  client: AvailabilityStoreClient | null,
  slug: string,
  serviceId: string
): Promise<{ rows: ServiceAvailabilityRuleRecord[]; loadFailed: boolean }> {
  const normalized = slug.trim().toLowerCase()
  if (!isSupabaseConfigured() || !client || normalized === DEMO_BOOKING_SLUG) {
    return { rows: [], loadFailed: false }
  }
  const resolved = await resolvePublicBookingBusinessProfileId(client, normalized)
  if (resolved.rpcFailed || !resolved.businessId) {
    return { rows: [], loadFailed: resolved.rpcFailed }
  }
  const { data, error } = await client
    .from("service_availability_rules")
    .select("*")
    .eq("business_id", resolved.businessId)
    .eq("service_id", serviceId)
    .order("weekday", { ascending: true })
  if (error || !data) return { rows: [], loadFailed: Boolean(error) }
  return { rows: (data as ServiceRuleRow[]).map(mapServiceRuleRow), loadFailed: false }
}

export async function getServiceAvailabilityForBusinessSlug(
  client: AvailabilityStoreClient | null,
  slug: string,
  serviceId: string | null,
  dateFrom: string,
  dateTo: string
): Promise<{
  exceptions: AvailabilityExceptionRecord[]
  serviceRules: ServiceAvailabilityRuleRecord[]
  usesDefaultAvailability: boolean
  loadFailed: boolean
}> {
  const ex = await fetchAvailabilityExceptionsForPublicSlug(client, slug, dateFrom, dateTo)
  if (!serviceId) {
    return {
      exceptions: ex.rows,
      serviceRules: [],
      usesDefaultAvailability: true,
      loadFailed: ex.loadFailed,
    }
  }
  if (!isSupabaseConfigured() || !client) {
    return { exceptions: [], serviceRules: [], usesDefaultAvailability: true, loadFailed: false }
  }
  const normalized = slug.trim().toLowerCase()
  if (normalized === DEMO_BOOKING_SLUG) {
    return { exceptions: [], serviceRules: [], usesDefaultAvailability: true, loadFailed: false }
  }
  const { data: svc, error: svcErr } = await client
    .from("services")
    .select("uses_default_availability")
    .eq("id", serviceId)
    .maybeSingle()
  if (svcErr) {
    return { exceptions: ex.rows, serviceRules: [], usesDefaultAvailability: true, loadFailed: true }
  }
  const usesDefault =
    svc?.uses_default_availability === undefined || svc?.uses_default_availability === null
      ? true
      : Boolean(svc.uses_default_availability)
  if (usesDefault) {
    return {
      exceptions: ex.rows,
      serviceRules: [],
      usesDefaultAvailability: true,
      loadFailed: ex.loadFailed,
    }
  }
  const rulesRes = await fetchServiceAvailabilityRulesForPublicSlug(client, slug, serviceId)
  return {
    exceptions: ex.rows,
    serviceRules: rulesRes.rows,
    usesDefaultAvailability: false,
    loadFailed: ex.loadFailed || rulesRes.loadFailed,
  }
}

export type SaveAvailabilityExceptionInput = {
  exceptionDate: string
  isClosed: boolean
  startTime?: string | null
  endTime?: string | null
  reason?: string | null
}

export async function saveAvailabilityException(
  client: AvailabilityStoreClient | null,
  businessProfileId: string | null,
  input: SaveAvailabilityExceptionInput
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!isSupabaseAvailabilityPath(client, businessProfileId)) {
    return { ok: false, error: "no_supabase" }
  }
  const c = client!
  const bid = businessProfileId!
  const date = input.exceptionDate.trim().slice(0, 10)
  const row: TablesInsert<"availability_exceptions"> = {
    business_id: bid,
    exception_date: date,
    is_closed: input.isClosed,
    start_time: input.isClosed ? null : input.startTime ? toPgTime(input.startTime) : null,
    end_time: input.isClosed ? null : input.endTime ? toPgTime(input.endTime) : null,
    reason: input.reason?.trim() ? input.reason.trim() : null,
  }
  const { data, error } = await c
    .from("availability_exceptions")
    .upsert(row, { onConflict: "business_id,exception_date" })
    .select("id")
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  dispatchAvailabilityUpdated()
  return { ok: true, id: data?.id }
}

export async function deleteAvailabilityExceptionByDate(
  client: AvailabilityStoreClient | null,
  businessProfileId: string | null,
  exceptionDate: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseAvailabilityPath(client, businessProfileId)) {
    return { ok: false, error: "no_supabase" }
  }
  const date = exceptionDate.trim().slice(0, 10)
  const { error } = await client!
    .from("availability_exceptions")
    .delete()
    .eq("business_id", businessProfileId!)
    .eq("exception_date", date)
  if (error) return { ok: false, error: error.message }
  dispatchAvailabilityUpdated()
  return { ok: true }
}

export async function updateAvailabilityException(
  client: AvailabilityStoreClient | null,
  businessProfileId: string | null,
  id: string,
  updates: Partial<
    Pick<SaveAvailabilityExceptionInput, "isClosed" | "startTime" | "endTime" | "reason">
  >
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseAvailabilityPath(client, businessProfileId)) {
    return { ok: false, error: "no_supabase" }
  }
  const patch: TablesUpdate<"availability_exceptions"> = {}
  if (updates.isClosed !== undefined) {
    patch.is_closed = updates.isClosed
    if (updates.isClosed) {
      patch.start_time = null
      patch.end_time = null
    }
  }
  if (updates.startTime !== undefined) {
    patch.start_time = updates.startTime ? toPgTime(updates.startTime) : null
  }
  if (updates.endTime !== undefined) {
    patch.end_time = updates.endTime ? toPgTime(updates.endTime) : null
  }
  if (updates.reason !== undefined) {
    patch.reason = updates.reason?.trim() ? updates.reason.trim() : null
  }
  if (Object.keys(patch).length === 0) return { ok: true }
  const { error } = await client!.from("availability_exceptions").update(patch).eq("id", id)
  if (error) return { ok: false, error: error.message }
  dispatchAvailabilityUpdated()
  return { ok: true }
}

export async function deleteAvailabilityException(
  client: AvailabilityStoreClient | null,
  businessProfileId: string | null,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseAvailabilityPath(client, businessProfileId)) {
    return { ok: false, error: "no_supabase" }
  }
  const { error } = await client!.from("availability_exceptions").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  dispatchAvailabilityUpdated()
  return { ok: true }
}

export type ServiceAvailabilityRuleInput = {
  weekday: number
  isAvailable: boolean
  startTime: string
  endTime: string
}

export async function getServiceAvailabilityRules(
  client: AvailabilityStoreClient | null,
  businessProfileId: string | null,
  serviceId: string
): Promise<ServiceAvailabilityRuleRecord[]> {
  if (!isSupabaseAvailabilityPath(client, businessProfileId)) return []
  const { data, error } = await client!
    .from("service_availability_rules")
    .select("*")
    .eq("business_id", businessProfileId!)
    .eq("service_id", serviceId)
    .order("weekday", { ascending: true })
  if (error || !data) return []
  return (data as ServiceRuleRow[]).map(mapServiceRuleRow)
}

export async function saveServiceAvailabilityRules(
  client: AvailabilityStoreClient | null,
  businessProfileId: string | null,
  serviceId: string,
  rules: ServiceAvailabilityRuleInput[]
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseAvailabilityPath(client, businessProfileId)) {
    return { ok: false, error: "no_supabase" }
  }
  const c = client!
  const bid = businessProfileId!
  for (const r of rules) {
    const sm = timeToMinutesStore(r.startTime)
    const em = timeToMinutesStore(r.endTime)
    if (em <= sm) return { ok: false, error: "invalid_time_range" }
  }
  const { error: delErr } = await c
    .from("service_availability_rules")
    .delete()
    .eq("business_id", bid)
    .eq("service_id", serviceId)
  if (delErr) return { ok: false, error: delErr.message }
  if (rules.length === 0) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("pw-services"))
    }
    return { ok: true }
  }
  const payload: TablesInsert<"service_availability_rules">[] = rules.map((r) => ({
    business_id: bid,
    service_id: serviceId,
    weekday: Math.max(0, Math.min(6, Math.floor(r.weekday))),
    is_available: r.isAvailable,
    start_time: toPgTime(r.startTime),
    end_time: toPgTime(r.endTime),
  }))
  const { error: insErr } = await c.from("service_availability_rules").insert(payload)
  if (insErr) return { ok: false, error: insErr.message }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pw-services"))
  }
  return { ok: true }
}

function timeToMinutesStore(t: string): number {
  const [h, m = "0"] = t.split(":").map((x) => String(x).trim())
  return Number(h) * 60 + Number(m)
}
