import type { SupabaseClient } from "@supabase/supabase-js"

import { resolvePublicBookingBusinessProfileId } from "@/lib/business/public-booking-slug"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Database, TablesUpdate } from "@/types/database"
import type { StaffMember } from "@/types/domain"

export type StaffStoreClient = SupabaseClient<Database>

export type StaffAvailabilityRuleInput = {
  weekday: number
  isAvailable: boolean
  startTime: string
  endTime: string
}

type StaffRow = Pick<
  Database["public"]["Tables"]["staff_members"]["Row"],
  "id" | "business_id" | "name" | "role" | "email" | "phone" | "avatar_url" | "is_active"
>

export function normalizeStaffRole(raw: string | null | undefined): "admin" | "staff" {
  const normalized = (raw ?? "").trim().toLowerCase()
  if (normalized === "admin" || normalized === "administrator") return "admin"
  if (normalized === "staff") return "staff"
  if (normalized === "właściciel panelu") return "admin"
  if (normalized === "panel owner") return "admin"
  if (normalized === "obsługa" || normalized === "obsluga") return "staff"
  return "staff"
}

function isMissingColumnError(message: string | undefined, column: string): boolean {
  const text = (message ?? "").toLowerCase()
  return text.includes(`column ${column.toLowerCase()}`) && text.includes("does not exist")
}

function isMissingAnyColumnError(message: string | undefined, columns: string[]): boolean {
  return columns.some((column) => isMissingColumnError(message, column))
}

function toUniqueServiceIds(serviceIds: string[]): string[] {
  return [...new Set(serviceIds.map((id) => id.trim()).filter((id) => id.length > 0))]
}

/** Wiersz staff_services może mieć staff_id (standard) albo staff_member_id (starsze / fallback insert). */
function staffMemberIdFromStaffServiceRow(row: Record<string, unknown>): string | null {
  const a = row.staff_member_id
  const b = row.staff_id
  if (typeof a === "string" && a.trim().length > 0) return a.trim()
  if (typeof b === "string" && b.trim().length > 0) return b.trim()
  return null
}

function uniqueNonEmptyIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))]
}

/** Porównanie service_id z katalogu i z staff_services (UUID z/bez myślników, wielkość liter). */
export function publicBookingServiceIdsMatch(a: string, b: string): boolean {
  const x = a.trim()
  const y = b.trim()
  if (!x || !y) return false
  if (x === y) return true
  const cx = x.replace(/-/g, "").toLowerCase()
  const cy = y.replace(/-/g, "").toLowerCase()
  if (cx.length >= 32 && cy.length >= 32 && cx === cy) return true
  return false
}

function coerceUuidishString(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (value != null && typeof value === "object" && "toString" in value) {
    const s = String((value as { toString: () => string }).toString()).trim()
    return s
  }
  return ""
}

async function fetchStaffMembersByIdsForBusiness(
  client: StaffStoreClient,
  businessId: string,
  staffIds: string[]
): Promise<StaffMember[]> {
  if (staffIds.length === 0) return []
  let res = await client
    .from("staff_members")
    .select("id, business_id, name, role, email, phone, avatar_url, is_active")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .in("id", staffIds)
    .order("name", { ascending: true })
  if (res.error?.message && res.error.message.toLowerCase().includes("is_active")) {
    res = await client
      .from("staff_members")
      .select("id, business_id, name, role, email, phone, avatar_url, is_active")
      .eq("business_id", businessId)
      .in("id", staffIds)
      .order("name", { ascending: true })
  }
  if (res.error || !res.data) return []
  return res.data
    .map(mapStaffRow)
    .filter((m) => m.isActive !== false)
}

async function loadStaffServiceLinksForService(
  client: StaffStoreClient,
  businessId: string,
  serviceId: string
): Promise<{ links: Record<string, unknown>[]; linksError?: string }> {
  const sid = serviceId.trim()
  const bid = businessId.trim()

  const pickMatchingServiceRows = (rows: Record<string, unknown>[]) =>
    rows.filter((r) => publicBookingServiceIdsMatch(coerceUuidishString(r.service_id), sid))

  const primary = await client
    .from("staff_services")
    .select("*")
    .eq("service_id", sid)
    .eq("business_id", bid)

  if (!primary.error && primary.data && primary.data.length > 0) {
    return { links: primary.data as Record<string, unknown>[] }
  }

  const loose = await client.from("staff_services").select("*").eq("service_id", sid)
  if (loose.error) {
    return {
      links: [],
      linksError: loose.error.message,
    }
  }
  const rows = (loose.data ?? []) as Record<string, unknown>[]
  const filtered = rows.filter((r) => String(r.business_id ?? "").trim() === bid)
  if (filtered.length > 0) {
    return { links: filtered }
  }

  const forBusiness = await client.from("staff_services").select("*").eq("business_id", bid)
  if (!forBusiness.error && forBusiness.data?.length) {
    const matched = pickMatchingServiceRows(forBusiness.data as Record<string, unknown>[])
    if (matched.length > 0) {
      return { links: matched }
    }
  }

  if (
    forBusiness.error &&
    forBusiness.error.message.toLowerCase().includes("business_id") &&
    forBusiness.error.message.toLowerCase().includes("does not exist")
  ) {
    const all = await client.from("staff_services").select("*")
    if (!all.error && all.data?.length) {
      const matched = pickMatchingServiceRows(all.data as Record<string, unknown>[]).filter(
        (r) => String(r.business_id ?? "").trim() === bid
      )
      if (matched.length > 0) return { links: matched }
    }
  }

  return { links: [] }
}

export type PublicBookingServiceStaffResult = {
  staff: StaffMember[]
  businessId: string | null
  rpcStaff: unknown
  rpcError?: string
}

function mapStaffRow(row: StaffRow): StaffMember {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    role: row.role ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    isActive: row.is_active,
  }
}

function mapStaffAnyRow(row: Record<string, unknown>): StaffMember | null {
  const id = typeof row.id === "string" ? row.id : ""
  const businessId = typeof row.business_id === "string" ? row.business_id : ""
  if (!id || !businessId) return null
  const fullName = typeof row.full_name === "string" ? row.full_name.trim() : ""
  const nameRaw = typeof row.name === "string" ? row.name.trim() : ""
  const roleRaw = typeof row.role === "string" ? row.role.trim() : ""
  const emailRaw = typeof row.email === "string" ? row.email.trim() : ""
  const phoneRaw = typeof row.phone === "string" ? row.phone.trim() : ""
  const avatarRaw = typeof row.avatar_url === "string" ? row.avatar_url.trim() : ""
  const isActive = typeof row.is_active === "boolean" ? row.is_active : true
  return {
    id,
    businessId,
    name: fullName || nameRaw || "Bez nazwy",
    role: roleRaw || undefined,
    email: emailRaw || undefined,
    phone: phoneRaw || undefined,
    avatarUrl: avatarRaw || undefined,
    isActive,
  }
}

function isSupabaseStaffPath(client: StaffStoreClient | null, businessId: string | null): boolean {
  return Boolean(client && businessId && isSupabaseConfigured())
}

export async function getStaffMembers(
  client: StaffStoreClient | null,
  businessId: string | null
): Promise<StaffMember[]> {
  if (!isSupabaseStaffPath(client, businessId)) return []
  const { data, error } = await client!
    .from("staff_members")
    .select("*")
    .eq("business_id", businessId!)
    .order("created_at", { ascending: false })
  if (error || !data) return []
  const out: StaffMember[] = []
  for (const row of data as Record<string, unknown>[]) {
    const mapped = mapStaffAnyRow(row)
    if (mapped) out.push(mapped)
  }
  return out
}

/** Alias: wszyscy członkowie zespołu firmy (aktywni i nieaktywni). */
export async function getStaffForBusiness(
  client: StaffStoreClient | null,
  businessId: string | null
): Promise<StaffMember[]> {
  return getStaffMembers(client, businessId)
}

/** Tylko aktywni członkowie zespołu dla `business_id`. */
export async function getActiveStaffForBusiness(
  client: StaffStoreClient | null,
  businessId: string | null
): Promise<StaffMember[]> {
  if (!isSupabaseStaffPath(client, businessId)) return []
  const { data, error } = await client!
    .from("staff_members")
    .select("id, business_id, name, role, email, phone, avatar_url, is_active")
    .eq("business_id", businessId!)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
  if (error || !data) return []
  return data.map(mapStaffRow)
}

/** Zalogowana przeglądarka + bieżący profil firmy z Supabase. */
export async function getStaffForCurrentBusiness(): Promise<StaffMember[]> {
  if (!isSupabaseConfigured()) return []
  const client = getBrowserClient()
  if (!client) return []
  const bid = await getCurrentBusinessProfileIdForClient(client)
  return getStaffForBusiness(client, bid)
}

/** Lista do selecta: aktywni alfabetycznie, potem nieaktywni, którzy mają wizyty z `staff_id`. */
export function buildStaffFilterOptions(
  members: StaffMember[],
  appointmentStaffIds: ReadonlySet<string>
): StaffMember[] {
  const active = members.filter((m) => m.isActive)
  const inactiveNeeded = members.filter((m) => !m.isActive && appointmentStaffIds.has(m.id))
  const byName = (a: StaffMember, b: StaffMember) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  return [...[...active].sort(byName), ...[...inactiveNeeded].sort(byName)]
}

export type AddStaffMemberResult =
  | { ok: true; id: string; servicesLinked: boolean; servicesError?: string }
  | { ok: false; error?: string }

export async function addStaffMember(
  client: StaffStoreClient | null,
  businessId: string | null,
  input: {
    name: string
    role?: string
    email?: string
    phone?: string
    isActive: boolean
    serviceIds: string[]
  }
): Promise<AddStaffMemberResult> {
  if (!isSupabaseStaffPath(client, businessId)) return { ok: false, error: "no_supabase" }
  const role = normalizeStaffRole(input.role)
  const basePayload = {
    business_id: businessId!,
    role,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    is_active: input.isActive,
  }
  let staffId: string | null = null
  const firstAttempt = await (client!.from("staff_members") as unknown as {
    insert: (payload: Record<string, unknown>) => {
      select: (fields: string) => { single: () => Promise<unknown> }
    }
  })
    .insert({ ...basePayload, name: input.name.trim() })
    .select("id")
    .single()
  const firstData = (firstAttempt as { data?: { id?: string }; error?: { message?: string } }).data
  const firstError = (firstAttempt as { error?: { message?: string } }).error
  if (!firstError && firstData?.id) {
    staffId = firstData.id
  } else if (isMissingColumnError(firstError?.message, "name")) {
    const fallbackAttempt = await (client!.from("staff_members") as unknown as {
      insert: (payload: Record<string, unknown>) => {
        select: (fields: string) => { single: () => Promise<unknown> }
      }
    })
      .insert({ ...basePayload, full_name: input.name.trim() })
      .select("id")
      .single()
    const fallbackData = (fallbackAttempt as { data?: { id?: string }; error?: { message?: string } }).data
    const fallbackError = (fallbackAttempt as { error?: { message?: string } }).error
    if (!fallbackError && fallbackData?.id) {
      staffId = fallbackData.id
    } else {
      return { ok: false, error: fallbackError?.message ?? "insert_failed" }
    }
  } else {
    return { ok: false, error: firstError?.message ?? "insert_failed" }
  }
  if (!staffId) return { ok: false, error: "insert_failed" }
  const uniqueServiceIds = toUniqueServiceIds(input.serviceIds)
  if (uniqueServiceIds.length === 0) {
    window.dispatchEvent(new Event("pw-staff"))
    return { ok: true, id: staffId, servicesLinked: true }
  }
  const rows = uniqueServiceIds.map((serviceId) => ({
    business_id: businessId!,
    staff_id: staffId,
    service_id: serviceId,
  }))
  const { error: linkError } = await client!.from("staff_services").insert(rows)
  if (linkError) {
    const fallbackRows = uniqueServiceIds.map((serviceId) => ({
      business_id: businessId!,
      staff_member_id: staffId,
      service_id: serviceId,
    }))
    const fallback = await (client!.from("staff_services") as unknown as {
      insert: (payload: Record<string, unknown>[]) => Promise<unknown>
    }).insert(fallbackRows)
    const fallbackError = (fallback as { error?: { message?: string } }).error
    if (fallbackError) {
      const fallbackRowsNoBusiness = uniqueServiceIds.map((serviceId) => ({
        staff_member_id: staffId,
        service_id: serviceId,
      }))
      const fallbackNoBusiness = await (client!.from("staff_services") as unknown as {
        insert: (payload: Record<string, unknown>[]) => Promise<unknown>
      }).insert(fallbackRowsNoBusiness)
      const fallbackNoBusinessError = (fallbackNoBusiness as { error?: { message?: string } }).error
      if (fallbackNoBusinessError) {
        window.dispatchEvent(new Event("pw-staff"))
        return { ok: true, id: staffId, servicesLinked: false, servicesError: fallbackNoBusinessError.message }
      }
    }
  }
  window.dispatchEvent(new Event("pw-staff"))
  return { ok: true, id: staffId, servicesLinked: true }
}

export type UpdateStaffMemberResult =
  | { ok: true; servicesLinked: boolean; servicesError?: string }
  | { ok: false; error?: string }

export async function updateStaffMember(
  client: StaffStoreClient | null,
  businessId: string | null,
  staffId: string,
  updates: {
    name?: string
    role?: string | null
    email?: string
    phone?: string
    isActive?: boolean
    serviceIds?: string[]
  }
): Promise<UpdateStaffMemberResult> {
  if (!isSupabaseStaffPath(client, businessId)) return { ok: false, error: "no_supabase" }
  const patch: TablesUpdate<"staff_members"> = {}
  if (updates.name !== undefined) patch.name = updates.name.trim()
  if (updates.role !== undefined) patch.role = normalizeStaffRole(updates.role)
  if (updates.email !== undefined) patch.email = updates.email?.trim() || null
  if (updates.phone !== undefined) patch.phone = updates.phone?.trim() || null
  if (updates.isActive !== undefined) patch.is_active = updates.isActive
  if (Object.keys(patch).length > 0) {
    const { error } = await client!.from("staff_members").update(patch).eq("id", staffId)
    if (error) {
      if (updates.name !== undefined && isMissingColumnError(error.message, "name")) {
        const fallbackPatch: Record<string, unknown> = {
          full_name: updates.name.trim(),
        }
        if (updates.role !== undefined) fallbackPatch.role = normalizeStaffRole(updates.role)
        if (updates.email !== undefined) fallbackPatch.email = updates.email?.trim() || null
        if (updates.phone !== undefined) fallbackPatch.phone = updates.phone?.trim() || null
        if (updates.isActive !== undefined) fallbackPatch.is_active = updates.isActive
        const fallback = await (client!.from("staff_members") as unknown as {
          update: (payload: Record<string, unknown>) => {
            eq: (column: string, value: string) => Promise<unknown>
          }
        })
          .update(fallbackPatch)
          .eq("id", staffId)
        const fallbackError = (fallback as { error?: { message?: string } }).error
        if (fallbackError) return { ok: false, error: fallbackError.message }
      } else {
        return { ok: false, error: error.message }
      }
    }
  }
  if (updates.serviceIds !== undefined) {
    const newIds = toUniqueServiceIds(updates.serviceIds)
    const delWithBusinessAndStaff = await client!
      .from("staff_services")
      .delete()
      .eq("business_id", businessId!)
      .eq("staff_id", staffId)
    const delErrPrimary = delWithBusinessAndStaff.error
    if (delErrPrimary) {
      const delWithBusinessAndMember = await (client!.from("staff_services") as unknown as {
        delete: () => { eq: (column: string, value: string) => { eq: (column2: string, value2: string) => Promise<unknown> } }
      })
        .delete()
        .eq("business_id", businessId!)
        .eq("staff_member_id", staffId)
      const delErrMember = (delWithBusinessAndMember as { error?: { message?: string } }).error
      if (delErrMember) {
        const delWithoutBusiness = await (client!.from("staff_services") as unknown as {
          delete: () => { eq: (column: string, value: string) => Promise<unknown> }
        })
          .delete()
          .eq("staff_member_id", staffId)
        const delErrNoBusiness = (delWithoutBusiness as { error?: { message?: string } }).error
        if (delErrNoBusiness) {
          window.dispatchEvent(new Event("pw-staff"))
          return { ok: true, servicesLinked: false, servicesError: delErrNoBusiness.message }
        }
      }
    }

    if (newIds.length > 0) {
      const rows = newIds.map((serviceId) => ({
        business_id: businessId!,
        staff_id: staffId,
        service_id: serviceId,
      }))
      const { error: insertErr } = await client!.from("staff_services").insert(rows)
      if (insertErr) {
        const fallbackRows = newIds.map((serviceId) => ({
          business_id: businessId!,
          staff_member_id: staffId,
          service_id: serviceId,
        }))
        const fallback = await (client!.from("staff_services") as unknown as {
          insert: (payload: Record<string, unknown>[]) => Promise<unknown>
        }).insert(fallbackRows)
        const fallbackError = (fallback as { error?: { message?: string } }).error
        if (fallbackError) {
          const fallbackRowsNoBusiness = newIds.map((serviceId) => ({
            staff_member_id: staffId,
            service_id: serviceId,
          }))
          const fallbackNoBusiness = await (client!.from("staff_services") as unknown as {
            insert: (payload: Record<string, unknown>[]) => Promise<unknown>
          }).insert(fallbackRowsNoBusiness)
          const fallbackNoBusinessError = (fallbackNoBusiness as { error?: { message?: string } }).error
          if (fallbackNoBusinessError) {
            window.dispatchEvent(new Event("pw-staff"))
            return { ok: true, servicesLinked: false, servicesError: fallbackNoBusinessError.message }
          }
        }
      }
    }
  }
  window.dispatchEvent(new Event("pw-staff"))
  return { ok: true, servicesLinked: true }
}

export async function deleteStaffMember(
  client: StaffStoreClient | null,
  businessId: string | null,
  staffId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseStaffPath(client, businessId)) return { ok: false, error: "no_supabase" }
  const { error } = await client!.from("staff_members").delete().eq("id", staffId)
  if (error) return { ok: false, error: error.message }
  window.dispatchEvent(new Event("pw-staff"))
  return { ok: true }
}

/** Źródło listy osób dla /book: wyłącznie RPC `get_public_staff_for_service` (staff_member_id po stronie DB). */
export async function getServiceStaffForPublicSlug(
  client: StaffStoreClient | null,
  slug: string,
  serviceId: string | null
): Promise<PublicBookingServiceStaffResult> {
  if (!client || !isSupabaseConfigured() || !serviceId?.trim()) {
    return { staff: [], businessId: null, rpcStaff: null }
  }
  const normalized = slug.trim().toLowerCase()
  const resolved = await resolvePublicBookingBusinessProfileId(client, normalized)
  if (resolved.rpcFailed || !resolved.businessId) {
    return { staff: [], businessId: null, rpcStaff: null }
  }

  const bid = resolved.businessId
  const sid = serviceId.trim()

  const { data, error } = await client.rpc("get_public_staff_for_service", {
    p_business_id: bid,
    p_service_id: sid,
  })

  if (error) {
    return { staff: [], businessId: bid, rpcStaff: data ?? null, rpcError: error.message }
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>
  const staff: StaffMember[] = rows.map((r) => {
    const rawName =
      (typeof r.name === "string" ? r.name : "") ||
      (typeof r.full_name === "string" ? r.full_name : "")
    const normalizedName = rawName.trim().replace(/\s+/g, " ")
    return {
      id: String(r.id ?? ""),
      businessId: bid,
      name: normalizedName || "Bez nazwy",
      role: undefined,
      email: undefined,
      phone: undefined,
      avatarUrl: undefined,
      isActive: true,
    }
  }).filter((m) => m.id.length > 0)

  return { staff, businessId: bid, rpcStaff: data }
}

/** Alias: aktywni pracownicy z `staff_services` dla danej usługi. */
export async function getStaffForService(
  client: StaffStoreClient | null,
  businessId: string | null,
  serviceId: string
): Promise<StaffMember[]> {
  return getStaffMembersForService(client, businessId, serviceId)
}

/** Pracownicy przypisani do usługi w obrębie firmy (RLS). */
export async function getStaffMembersForService(
  client: StaffStoreClient | null,
  businessId: string | null,
  serviceId: string
): Promise<StaffMember[]> {
  if (!isSupabaseStaffPath(client, businessId) || !serviceId.trim()) return []
  const { links } = await loadStaffServiceLinksForService(client!, businessId!, serviceId.trim())
  const staffIds = uniqueNonEmptyIds(links.map((row) => staffMemberIdFromStaffServiceRow(row) ?? ""))
  if (staffIds.length === 0) return []
  return fetchStaffMembersByIdsForBusiness(client!, businessId!, staffIds)
}

export async function getStaffServiceIds(
  client: StaffStoreClient | null,
  businessId: string | null,
  staffId: string
): Promise<string[]> {
  if (!isSupabaseStaffPath(client, businessId)) return []
  const { data, error } = await client!
    .from("staff_services")
    .select("service_id")
    .eq("business_id", businessId!)
    .eq("staff_id", staffId)
  if (!error && data) return data.map((x) => x.service_id)
  const fallback = await (client!.from("staff_services") as unknown as {
    select: (fields: string) => {
      eq: (column: string, value: string) => {
        eq: (column2: string, value2: string) => Promise<unknown>
      }
    }
  })
    .select("service_id")
    .eq("business_id", businessId!)
    .eq("staff_member_id", staffId)
  const fallbackData = (fallback as { data?: Array<{ service_id: string }>; error?: { message?: string } }).data
  if (fallbackData) return fallbackData.map((x) => x.service_id)
  const fallbackNoBusiness = await (client!.from("staff_services") as unknown as {
    select: (fields: string) => { eq: (column: string, value: string) => Promise<unknown> }
  })
    .select("service_id")
    .eq("staff_member_id", staffId)
  const fallbackNoBusinessData = (fallbackNoBusiness as {
    data?: Array<{ service_id: string }>
    error?: { message?: string }
  }).data
  if (fallbackNoBusinessData) return fallbackNoBusinessData.map((x) => x.service_id)
  return []
}

export async function getStaffAvailabilityRules(
  client: StaffStoreClient | null,
  businessId: string | null,
  staffId: string
): Promise<StaffAvailabilityRuleInput[]> {
  if (!isSupabaseStaffPath(client, businessId)) return []
  const { data, error } = await client!
    .from("staff_availability_rules")
    .select("weekday, is_available, start_time, end_time")
    .eq("business_id", businessId!)
    .eq("staff_id", staffId)
  if (!error && data) {
    return data.map((row) => ({
      weekday: row.weekday,
      isAvailable: row.is_available,
      startTime: String(row.start_time).slice(0, 5),
      endTime: String(row.end_time).slice(0, 5),
    }))
  }
  if (
    !error ||
    !isMissingAnyColumnError(error.message, [
      "staff_availability_rules.staff_id",
      "staff_availability_rules.weekday",
      "staff_availability_rules.is_available",
      "staff_availability_rules.business_id",
    ])
  ) {
    return []
  }
  const fallback = await (client!.from("staff_availability_rules") as unknown as {
    select: (fields: string) => {
      eq: (column: string, value: string) => {
        eq: (column2: string, value2: string) => Promise<unknown>
      }
    }
  })
    .select("day_of_week, is_open, start_time, end_time")
    .eq("business_id", businessId!)
    .eq("staff_member_id", staffId)
  const fallbackData = (fallback as {
    data?: Array<{ day_of_week: number; is_open: boolean; start_time: string; end_time: string }>
    error?: { message?: string }
  }).data
  const fallbackError = (fallback as { error?: { message?: string } }).error
  if (fallbackData) {
    return fallbackData.map((row) => ({
      weekday: row.day_of_week,
      isAvailable: row.is_open,
      startTime: String(row.start_time).slice(0, 5),
      endTime: String(row.end_time).slice(0, 5),
    }))
  }
  if (fallbackError) {
    const fallbackNoBusiness = await (client!.from("staff_availability_rules") as unknown as {
      select: (fields: string) => { eq: (column: string, value: string) => Promise<unknown> }
    })
      .select("day_of_week, is_open, start_time, end_time")
      .eq("staff_member_id", staffId)
    const fallbackNoBusinessData = (fallbackNoBusiness as {
      data?: Array<{ day_of_week: number; is_open: boolean; start_time: string; end_time: string }>
    }).data
    if (fallbackNoBusinessData) {
      return fallbackNoBusinessData.map((row) => ({
        weekday: row.day_of_week,
        isAvailable: row.is_open,
        startTime: String(row.start_time).slice(0, 5),
        endTime: String(row.end_time).slice(0, 5),
      }))
    }
  }
  return []
}

export type StaffAvailabilityExceptionRecord = {
  exceptionDate: string
  isUnavailable: boolean
  startTime: string | null
  endTime: string | null
  reason: string | null
}

export type StaffAvailabilityExceptionInput = {
  exceptionDate: string
  exceptionEndDate?: string
  isClosed: boolean
  startTime: string
  endTime: string
  reason?: string
}

/** Reguły i wyjątki grafiku osoby dla zalogowanej firmy (panel). */
export async function getStaffAvailabilityContextForBusiness(
  client: StaffStoreClient | null,
  businessId: string | null,
  staffId: string | null
): Promise<{
  rules: StaffAvailabilityRuleInput[]
  exceptions: StaffAvailabilityExceptionRecord[]
}> {
  if (!isSupabaseStaffPath(client, businessId) || !staffId?.trim()) {
    return { rules: [], exceptions: [] }
  }
  const bid = businessId!
  const sid = staffId.trim()
  const [rules, exceptions] = await Promise.all([
    getStaffAvailabilityRules(client, bid, sid),
    client!
      .from("staff_availability_exceptions")
      .select("exception_date, is_unavailable, start_time, end_time, reason")
      .eq("business_id", bid)
      .eq("staff_id", sid),
  ])
  let exceptionData = exceptions.data ?? null
  if (exceptions.error) {
    if (
      isMissingAnyColumnError(exceptions.error.message, [
        "staff_availability_exceptions.business_id",
        "staff_availability_exceptions.staff_id",
      ])
    ) {
      const fallback = await (client!.from("staff_availability_exceptions") as unknown as {
        select: (fields: string) => { eq: (column: string, value: string) => Promise<unknown> }
      })
        .select("exception_date, is_unavailable, start_time, end_time, reason")
        .eq("staff_member_id", sid)
      const fallbackError = (fallback as { error?: { message?: string } }).error
      if (
        fallbackError &&
        isMissingColumnError(
          fallbackError.message,
          "staff_availability_exceptions.is_unavailable",
        )
      ) {
        const fallbackStatus = await (client!.from("staff_availability_exceptions") as unknown as {
          select: (fields: string) => {
            eq: (column: string, value: string) => {
              eq: (column2: string, value2: string) => Promise<unknown>
            }
          }
        })
          .select("exception_date, is_closed, start_time, end_time, reason")
          .eq("staff_member_id", sid)
        const fallbackStatusData =
          (fallbackStatus as {
            data?: Array<{
              exception_date: string
              is_closed: boolean
              start_time: string | null
              end_time: string | null
              reason: string | null
            }>
          }).data ?? null
        exceptionData = fallbackStatusData
          ? fallbackStatusData.map((row) => ({
              exception_date: row.exception_date,
              is_unavailable: Boolean(row.is_closed),
              start_time: row.start_time,
              end_time: row.end_time,
              reason: row.reason,
            }))
          : null
      } else {
        exceptionData = (fallback as { data?: typeof exceptions.data }).data ?? null
      }
    } else if (
      isMissingColumnError(exceptions.error.message, "staff_availability_exceptions.is_unavailable")
    ) {
      const fallbackStatus = await (client!.from("staff_availability_exceptions") as unknown as {
        select: (fields: string) => {
          eq: (column: string, value: string) => {
            eq: (column2: string, value2: string) => Promise<unknown>
          }
        }
      })
        .select("exception_date, is_closed, start_time, end_time, reason")
        .eq("business_id", bid)
        .eq("staff_id", sid)
      const fallbackStatusData =
        (fallbackStatus as {
          data?: Array<{
            exception_date: string
            is_closed: boolean
            start_time: string | null
            end_time: string | null
            reason: string | null
          }>
        }).data ?? null
      exceptionData = fallbackStatusData
        ? fallbackStatusData.map((row) => ({
            exception_date: row.exception_date,
            is_unavailable: Boolean(row.is_closed),
            start_time: row.start_time,
            end_time: row.end_time,
            reason: row.reason,
          }))
        : null
    }
  }
  const exRows =
    exceptionData
      ? exceptionData.map((row) => ({
          exceptionDate: String(row.exception_date).slice(0, 10),
          isUnavailable: row.is_unavailable,
          startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
          endTime: row.end_time ? String(row.end_time).slice(0, 5) : null,
          reason: row.reason?.trim() || null,
        }))
      : []
  exRows.sort((a, b) => a.exceptionDate.localeCompare(b.exceptionDate))
  return { rules, exceptions: exRows }
}

export async function getStaffAvailabilityForPublicSlug(
  client: StaffStoreClient | null,
  slug: string,
  staffId: string | null
): Promise<{
  rules: StaffAvailabilityRuleInput[]
  exceptions: StaffAvailabilityExceptionRecord[]
}> {
  if (!client || !isSupabaseConfigured() || !staffId) return { rules: [], exceptions: [] }
  const normalized = slug.trim().toLowerCase()
  const resolved = await resolvePublicBookingBusinessProfileId(client, normalized)
  if (resolved.rpcFailed || !resolved.businessId) return { rules: [], exceptions: [] }
  return getStaffAvailabilityContextForBusiness(client, resolved.businessId, staffId)
}

export async function saveStaffAvailabilityRules(
  client: StaffStoreClient | null,
  businessId: string | null,
  staffId: string,
  rules: StaffAvailabilityRuleInput[]
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseStaffPath(client, businessId)) return { ok: false, error: "no_supabase" }
  const isDev = process.env.NODE_ENV === "development"
  const bid = businessId!
  const sid = staffId.trim()
  if (!sid) return { ok: false, error: "missing_staff_id" }

  if (isDev) {
    console.debug("[team.schedule.save] input", {
      staffId: sid,
      businessId: bid,
      useBusinessHours: rules.length === 0,
      scheduleRulesBeforeSave: rules,
    })
  }

  const deleteByStaffMemberWithBusiness = async () =>
    await (client!.from("staff_availability_rules") as unknown as {
      delete: () => { eq: (column: string, value: string) => { eq: (column2: string, value2: string) => Promise<unknown> } }
    })
      .delete()
      .eq("business_id", bid)
      .eq("staff_member_id", sid)

  const deleteByStaffIdWithBusiness = async () =>
    await (client!.from("staff_availability_rules") as unknown as {
      delete: () => { eq: (column: string, value: string) => { eq: (column2: string, value2: string) => Promise<unknown> } }
    })
      .delete()
      .eq("business_id", bid)
      .eq("staff_id", sid)

  const deleteByStaffMemberOnly = async () =>
    await (client!.from("staff_availability_rules") as unknown as {
      delete: () => { eq: (column: string, value: string) => Promise<unknown> }
    })
      .delete()
      .eq("staff_member_id", sid)

  const deleteByStaffIdOnly = async () =>
    await (client!.from("staff_availability_rules") as unknown as {
      delete: () => { eq: (column: string, value: string) => Promise<unknown> }
    })
      .delete()
      .eq("staff_id", sid)

  const deleteAttempts = [
    await deleteByStaffMemberWithBusiness(),
    await deleteByStaffIdWithBusiness(),
    await deleteByStaffMemberOnly(),
    await deleteByStaffIdOnly(),
  ]

  const blockingDeleteError = deleteAttempts
    .map((x) => (x as { error?: { message?: string } }).error?.message ?? "")
    .find((msg) => msg && !isMissingAnyColumnError(msg, ["staff_availability_rules.staff_member_id", "staff_availability_rules.staff_id", "staff_availability_rules.business_id"]))

  if (isDev) {
    console.debug("[team.schedule.save] delete attempts", {
      results: deleteAttempts.map((x) => (x as { error?: { message?: string } }).error?.message ?? null),
    })
  }

  if (blockingDeleteError) {
    if (isDev) console.error("[team.schedule.save] delete failed", blockingDeleteError)
    return { ok: false, error: blockingDeleteError }
  }

  if (rules.length === 0) {
    const persistedAfterDelete = await getStaffAvailabilityRules(client, bid, sid)
    if (persistedAfterDelete.length > 0) {
      return { ok: false, error: "schedule_rules_not_deleted" }
    }
    window.dispatchEvent(new Event("pw-staff"))
    return { ok: true }
  }

  const byWeekday = new Map<number, StaffAvailabilityRuleInput>()
  for (const r of rules) byWeekday.set(r.weekday, r)
  const uniqueRules = [...byWeekday.values()]
  if (uniqueRules.length === 0) return { ok: false, error: "schedule_empty_payload" }

  const primaryPayload = uniqueRules.map((r) => ({
    business_id: bid,
    staff_id: sid,
    weekday: r.weekday,
    is_available: r.isAvailable,
    start_time: r.isAvailable ? r.startTime : null,
    end_time: r.isAvailable ? r.endTime : null,
  }))

  const fallbackPayload = uniqueRules.map((r) => ({
    business_id: bid,
    staff_member_id: sid,
    staff_id: sid,
    day_of_week: r.weekday,
    is_open: r.isAvailable,
    start_time: r.isAvailable ? r.startTime : null,
    end_time: r.isAvailable ? r.endTime : null,
  }))

  if (isDev) {
    console.info("[team.schedule.save] insert payload (primary)", primaryPayload)
  }

  const primaryInsert = await (client!.from("staff_availability_rules") as unknown as {
    insert: (rows: Record<string, unknown>[]) => Promise<unknown>
  }).insert(primaryPayload as Record<string, unknown>[])
  const primaryInsertError = (primaryInsert as { error?: { message?: string } }).error
  if (primaryInsertError) {
    if (isDev) {
      console.warn("[team.schedule.save] primary insert failed, trying fallback", primaryInsertError.message)
      console.info("[team.schedule.save] insert payload (fallback)", fallbackPayload)
    }
    const fallbackInsert = await (client!.from("staff_availability_rules") as unknown as {
      insert: (rows: Record<string, unknown>[]) => Promise<unknown>
    }).insert(fallbackPayload as Record<string, unknown>[])
    const fallbackInsertError = (fallbackInsert as { error?: { message?: string } }).error
    if (fallbackInsertError) {
      if (isDev) console.error("[team.schedule.save] fallback insert failed", fallbackInsertError.message)
      return { ok: false, error: fallbackInsertError.message }
    }
  }

  const persistedAfterSave = await getStaffAvailabilityRules(client, bid, sid)
  if (isDev) {
    console.debug("[team.schedule.save] verify after insert", {
      count: persistedAfterSave.length,
      rules: persistedAfterSave,
    })
  }
  if (persistedAfterSave.length === 0) {
    return { ok: false, error: "schedule_not_persisted_in_db" }
  }

  window.dispatchEvent(new Event("pw-staff"))
  return { ok: true }
}

export async function saveStaffAvailabilityExceptions(
  client: StaffStoreClient | null,
  businessId: string | null,
  staffId: string,
  exceptions: StaffAvailabilityExceptionInput[]
): Promise<{ ok: boolean; error?: string; persisted?: StaffAvailabilityExceptionRecord[] }> {
  if (!isSupabaseStaffPath(client, businessId)) return { ok: false, error: "no_supabase" }
  const bid = businessId!
  const sid = staffId.trim()
  if (!sid) return { ok: false, error: "missing_staff_id" }

  const byDate = new Map<string, StaffAvailabilityExceptionInput>()
  const expandDateRange = (start: string, end: string): string[] => {
    const out: string[] = []
    const [sy, sm, sd] = start.split("-").map(Number)
    const [ey, em, ed] = end.split("-").map(Number)
    const startDate = new Date(sy, sm - 1, sd)
    const endDate = new Date(ey, em - 1, ed)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return out
    if (endDate < startDate) return out
    const d = new Date(startDate)
    while (d <= endDate) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      out.push(`${y}-${m}-${day}`)
      d.setDate(d.getDate() + 1)
    }
    return out
  }
  for (const ex of exceptions) {
    const startDate = ex.exceptionDate.trim().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) continue
    const endDateRaw = ex.exceptionEndDate?.trim().slice(0, 10) || ""
    const endDate = /^\d{4}-\d{2}-\d{2}$/.test(endDateRaw) ? endDateRaw : startDate
    const dates = expandDateRange(startDate, endDate)
    if (dates.length === 0) continue
    for (const date of dates) {
      byDate.set(date, { ...ex, exceptionDate: date, exceptionEndDate: date })
    }
  }
  const normalized = [...byDate.values()]

  const deleteByStaffWithBusiness = await (client!.from("staff_availability_exceptions") as unknown as {
    delete: () => { eq: (column: string, value: string) => { eq: (column2: string, value2: string) => Promise<unknown> } }
  })
    .delete()
    .eq("business_id", bid)
    .eq("staff_id", sid)
  const deleteByStaffMemberWithBusiness = await (client!.from("staff_availability_exceptions") as unknown as {
    delete: () => { eq: (column: string, value: string) => { eq: (column2: string, value2: string) => Promise<unknown> } }
  })
    .delete()
    .eq("business_id", bid)
    .eq("staff_member_id", sid)
  const deleteByStaffOnly = await (client!.from("staff_availability_exceptions") as unknown as {
    delete: () => { eq: (column: string, value: string) => Promise<unknown> }
  })
    .delete()
    .eq("staff_id", sid)
  const deleteByStaffMemberOnly = await (client!.from("staff_availability_exceptions") as unknown as {
    delete: () => { eq: (column: string, value: string) => Promise<unknown> }
  })
    .delete()
    .eq("staff_member_id", sid)

  const blockingDeleteError = [
    (deleteByStaffWithBusiness as { error?: { message?: string } }).error?.message ?? "",
    (deleteByStaffMemberWithBusiness as { error?: { message?: string } }).error?.message ?? "",
    (deleteByStaffOnly as { error?: { message?: string } }).error?.message ?? "",
    (deleteByStaffMemberOnly as { error?: { message?: string } }).error?.message ?? "",
  ].find(
    (msg) =>
      msg &&
      !isMissingAnyColumnError(msg, [
        "staff_availability_exceptions.business_id",
        "staff_availability_exceptions.staff_id",
        "staff_availability_exceptions.staff_member_id",
      ]),
  )
  if (blockingDeleteError) return { ok: false, error: blockingDeleteError }

  if (normalized.length > 0) {
    const rowsClosed = normalized.map((ex) => {
      const isClosed = Boolean(ex.isClosed)
      const start = isClosed ? null : ex.startTime.trim()
      const end = isClosed ? null : ex.endTime.trim()
      return {
        business_id: bid,
        staff_member_id: sid,
        staff_id: sid,
        exception_date: ex.exceptionDate,
        is_closed: isClosed,
        start_time: start && start.length > 0 ? start : null,
        end_time: end && end.length > 0 ? end : null,
        reason: ex.reason?.trim() || null,
      }
    })
    const insertClosed = await (client!.from("staff_availability_exceptions") as unknown as {
      insert: (payload: Record<string, unknown>[]) => Promise<unknown>
    }).insert(rowsClosed as Record<string, unknown>[])
    const insertClosedError = (insertClosed as { error?: { message?: string } }).error
    if (insertClosedError) {
      if (
        !isMissingAnyColumnError(insertClosedError.message, [
          "staff_availability_exceptions.staff_member_id",
          "staff_availability_exceptions.business_id",
          "staff_availability_exceptions.is_closed",
        ])
      ) {
        return { ok: false, error: insertClosedError.message }
      }
      const rowsUnavailable = normalized.map((ex) => {
        const isClosed = Boolean(ex.isClosed)
        const start = isClosed ? null : ex.startTime.trim()
        const end = isClosed ? null : ex.endTime.trim()
        return {
          business_id: bid,
          staff_member_id: sid,
          staff_id: sid,
          exception_date: ex.exceptionDate,
          is_unavailable: isClosed,
          start_time: start && start.length > 0 ? start : null,
          end_time: end && end.length > 0 ? end : null,
          reason: ex.reason?.trim() || null,
        }
      })
      const insertUnavailable = await (client!.from("staff_availability_exceptions") as unknown as {
        insert: (payload: Record<string, unknown>[]) => Promise<unknown>
      }).insert(rowsUnavailable as Record<string, unknown>[])
      const insertUnavailableError = (insertUnavailable as { error?: { message?: string } }).error
      if (insertUnavailableError) return { ok: false, error: insertUnavailableError.message }
    }
  }

  const persisted = (await getStaffAvailabilityContextForBusiness(client, bid, sid)).exceptions
    .slice()
    .sort((a, b) => a.exceptionDate.localeCompare(b.exceptionDate))
  if (normalized.length > 0 && persisted.length === 0) {
    return { ok: false, error: "schedule_exceptions_not_persisted_in_db" }
  }

  if (typeof window !== "undefined") window.dispatchEvent(new Event("pw-staff"))
  return { ok: true, persisted }
}

