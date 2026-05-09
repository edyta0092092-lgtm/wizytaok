import type { SupabaseClient, User } from "@supabase/supabase-js"

import { resolveRegisteredBusinessNipCollision } from "@/lib/business/registered-nip-collision-server"
import {
  insertBusinessProfileFromPlan,
  planBusinessProfileInsertFromUser,
  type BusinessProfileInsertPlan,
} from "@/lib/supabase/ensure-profile-from-metadata"
import { getServerClient } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Database } from "@/types/database"

const REGISTERED = "registered_business"
const UNREGISTERED = "unregistered_activity"

export type PrepareBusinessProfileError =
  | "unauthorized"
  | "no_server"
  | "missing_account_type"
  | "missing_company_tax_id"
  | "missing_contact_phone"
  | "missing_slug_or_business_name"
  | "missing_service_role_key"
  | "nip_company_already_exists"
  | "business_profile_insert_failed"
  | "business_profile_update_failed"
  | "membership_insert_failed"
  | "missing_required_column"
  | "rls_blocked"

export type PrepareBusinessProfileResult =
  | {
      ok: true
      businessId: string
      subscriptionStatus: string | null
      created: boolean
      updated: boolean
    }
  | {
      ok: false
      error: PrepareBusinessProfileError
      supabaseMessage?: string
    }

function digitsFromUnknown(v: unknown): string {
  if (typeof v !== "string") return ""
  return v.replace(/\D/g, "")
}

function parseAccountType(meta: Record<string, unknown>): typeof REGISTERED | typeof UNREGISTERED | null {
  const raw = meta.account_type
  const s = typeof raw === "string" ? raw.trim() : ""
  if (s === REGISTERED || s === UNREGISTERED) return s
  return null
}

export function classifyBusinessProfileWriteError(
  message: string | undefined,
  code: string | undefined
): PrepareBusinessProfileError {
  const m = (message ?? "").toLowerCase()
  if (code === "42501" || m.includes("row-level security") || m.includes("violates row-level security")) {
    return "rls_blocked"
  }
  if (m.includes("column") && (m.includes("does not exist") || m.includes("schema cache"))) {
    return "missing_required_column"
  }
  return "business_profile_insert_failed"
}

export function logPrepareBusinessProfileError(context: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`[prepare-business-profile] ${context}`, msg)
}

function buildOwnerDisplayForMembership(row: { business_name: string; owner_name: string | null }): string {
  const n = typeof row.owner_name === "string" ? row.owner_name.trim() : ""
  if (n.length > 0) return n
  return row.business_name
}

function ownerDisplayFromSignupMeta(meta: Record<string, unknown>): string {
  const first = typeof meta.owner_name === "string" ? meta.owner_name.trim() : ""
  const last = typeof meta.owner_last_name === "string" ? meta.owner_last_name.trim() : ""
  const combined = [first, last].filter((p) => p.length > 0).join(" ").trim()
  return combined
}

/**
 * Właściciel jako admin w business_members — service role (nie polega na auth.uid() w RPC).
 */
async function upsertOwnerMembershipAdmin(
  admin: SupabaseClient<Database>,
  p: { businessId: string; userId: string; userEmail: string | null; displayName: string }
): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  let { error } = await admin.from("business_members").upsert(
    {
      business_id: p.businessId,
      user_id: p.userId,
      role: "admin",
      display_name: p.displayName,
      email: p.userEmail?.trim() ?? null,
    },
    { onConflict: "business_id,user_id" }
  )
  if (
    error &&
    error.message.toLowerCase().includes("is_active") &&
    (error.message.toLowerCase().includes("null value") ||
      error.message.toLowerCase().includes("not-null") ||
      error.message.toLowerCase().includes("violates not-null constraint"))
  ) {
    const retry = await admin.from("business_members").upsert(
      {
        business_id: p.businessId,
        user_id: p.userId,
        role: "admin",
        display_name: p.displayName,
        email: p.userEmail?.trim() ?? null,
        is_active: true,
      },
      { onConflict: "business_id,user_id" }
    )
    error = retry.error
  }
  if (error) {
    return { ok: false, message: error.message ?? "upsert failed", code: error.code }
  }
  return { ok: true }
}

type CheckoutIdentityRow = {
  id: string
  subscription_status: string | null
  account_type: string | null
  company_tax_id_normalized: string | null
  contact_phone_normalized: string | null
}

function validateRowForCheckout(
  row: CheckoutIdentityRow
): { ok: true } | { ok: false; error: PrepareBusinessProfileError } {
  const at = row.account_type
  if (at !== REGISTERED && at !== UNREGISTERED) {
    return { ok: false, error: "missing_account_type" }
  }
  if (at === REGISTERED) {
    const d = (row.company_tax_id_normalized ?? "").replace(/\D/g, "")
    if (d.length !== 10) return { ok: false, error: "missing_company_tax_id" }
  } else {
    const d = (row.contact_phone_normalized ?? "").replace(/\D/g, "")
    if (d.length < 9) return { ok: false, error: "missing_contact_phone" }
  }
  return { ok: true }
}

function buildEnrichedPlan(
  user: User,
  accountType: typeof REGISTERED | typeof UNREGISTERED,
  taxNorm: string,
  phoneNorm: string,
  meta: Record<string, unknown>
): BusinessProfileInsertPlan | null {
  const base = planBusinessProfileInsertFromUser(user, true)
  if (!base) return null

  const fullInsert: Database["public"]["Tables"]["business_profiles"]["Insert"] = {
    ...base.fullInsert,
    account_type: accountType,
  }

  if (accountType === REGISTERED) {
    const rawTax =
      typeof meta.company_tax_id === "string" && meta.company_tax_id.trim().length > 0
        ? meta.company_tax_id.trim()
        : taxNorm
    fullInsert.company_tax_id = rawTax
    fullInsert.company_tax_id_normalized = taxNorm
    fullInsert.contact_phone =
      typeof meta.contact_phone === "string" ? meta.contact_phone.trim() : base.fullInsert.contact_phone
    fullInsert.contact_phone_normalized =
      phoneNorm.length > 0 ? phoneNorm : base.fullInsert.contact_phone_normalized
  } else {
    fullInsert.company_tax_id = null
    fullInsert.company_tax_id_normalized = null
    fullInsert.contact_phone =
      typeof meta.contact_phone === "string" ? meta.contact_phone.trim() : base.fullInsert.contact_phone
    fullInsert.contact_phone_normalized = phoneNorm
  }

  return {
    fullInsert,
    ownerNameLegacyFallback: base.ownerNameLegacyFallback,
    companyTaxIdRaw: base.companyTaxIdRaw,
  }
}

/**
 * Zapis NIP/telefon/typ działalności — osobno po głównym update, żeby nie zgubić account_type przy stripowaniu kolumn.
 */
async function syncBusinessProfileIdentityForTrial(
  admin: SupabaseClient<Database>,
  businessId: string,
  plan: BusinessProfileInsertPlan
): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  const row = plan.fullInsert
  const payload: Database["public"]["Tables"]["business_profiles"]["Update"] = {
    account_type: row.account_type ?? null,
    company_tax_id: row.company_tax_id ?? null,
    company_tax_id_normalized: row.company_tax_id_normalized ?? null,
    contact_phone: row.contact_phone ?? null,
    contact_phone_normalized: row.contact_phone_normalized ?? null,
  }
  const { error } = await admin.from("business_profiles").update(payload).eq("id", businessId)
  if (error) {
    return { ok: false, message: error.message ?? "identity sync failed", code: error.code }
  }
  return { ok: true }
}

/**
 * Tworzy / uzupełnia business_profiles z user_metadata (sesja cookie) — wyłącznie backend + service role.
 */
export async function prepareBusinessProfileForStartTrial(): Promise<PrepareBusinessProfileResult> {
  const userSb = await getServerClient()
  if (!userSb) {
    return { ok: false, error: "no_server" }
  }

  const {
    data: { user },
  } = await userSb.auth.getUser()
  if (!user) {
    return { ok: false, error: "unauthorized" }
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const accountType = parseAccountType(meta)
  if (!accountType) {
    return { ok: false, error: "missing_account_type" }
  }

  const taxNorm =
    digitsFromUnknown(meta.company_tax_id_normalized) || digitsFromUnknown(meta.company_tax_id)
  const phoneNorm =
    digitsFromUnknown(meta.contact_phone_normalized) || digitsFromUnknown(meta.contact_phone)

  if (accountType === REGISTERED) {
    if (taxNorm.length !== 10) {
      return { ok: false, error: "missing_company_tax_id" }
    }
  } else if (phoneNorm.length < 9) {
    return { ok: false, error: "missing_contact_phone" }
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    console.error("[prepare-business-profile] missing SUPABASE_SERVICE_ROLE_KEY (server env)")
    return { ok: false, error: "missing_service_role_key" }
  }

  const enrichedPlan = buildEnrichedPlan(user, accountType, taxNorm, phoneNorm, meta)
  if (!enrichedPlan) {
    return { ok: false, error: "missing_slug_or_business_name" }
  }

  const { data: existing, error: exErr } = await admin
    .from("business_profiles")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (exErr) {
    logPrepareBusinessProfileError("select business_profiles by owner_id", exErr)
    return {
      ok: false,
      error: classifyBusinessProfileWriteError(exErr.message, exErr.code),
      supabaseMessage: exErr.message,
    }
  }

  let created = false
  let updated = false

  if (existing?.id) {
    const patch: Database["public"]["Tables"]["business_profiles"]["Update"] = {}
    if (existing.account_type !== accountType) {
      patch.account_type = accountType
    }
    if (accountType === REGISTERED) {
      const rawTax =
        typeof meta.company_tax_id === "string" && meta.company_tax_id.trim().length > 0
          ? meta.company_tax_id.trim()
          : taxNorm
      if (
        (existing.company_tax_id_normalized ?? "").replace(/\D/g, "") !== taxNorm ||
        (existing.company_tax_id ?? "") !== rawTax
      ) {
        patch.company_tax_id = rawTax
        patch.company_tax_id_normalized = taxNorm
      }
    } else {
      if ((existing.company_tax_id ?? null) != null || existing.company_tax_id_normalized != null) {
        patch.company_tax_id = null
        patch.company_tax_id_normalized = null
      }
    }

    const phoneDisplay =
      typeof meta.contact_phone === "string" ? meta.contact_phone.trim() : existing.contact_phone
    if (accountType === UNREGISTERED || phoneNorm.length > 0) {
      if ((existing.contact_phone_normalized ?? "").replace(/\D/g, "") !== phoneNorm) {
        patch.contact_phone = phoneDisplay ?? enrichedPlan.fullInsert.contact_phone
        patch.contact_phone_normalized = phoneNorm
      }
    }

    if (user.email && existing.email !== user.email) {
      patch.email = user.email
    }

    const combinedOwner = ownerDisplayFromSignupMeta(meta)
    if (combinedOwner.length > 0 && (existing.owner_name ?? "").trim() !== combinedOwner) {
      patch.owner_name = combinedOwner
    }

    if (Object.keys(patch).length > 0) {
      let upErr = (await admin.from("business_profiles").update(patch).eq("id", existing.id)).error
      if (upErr && classifyBusinessProfileWriteError(upErr.message, upErr.code) === "missing_required_column") {
        const minimal: Database["public"]["Tables"]["business_profiles"]["Update"] = {}
        if (patch.owner_name != null) minimal.owner_name = patch.owner_name
        if (patch.email != null) minimal.email = patch.email
        if (Object.keys(minimal).length > 0) {
          upErr = (await admin.from("business_profiles").update(minimal).eq("id", existing.id)).error
        }
      }
      if (upErr) {
        logPrepareBusinessProfileError("update business_profiles", upErr)
        const kind = classifyBusinessProfileWriteError(upErr.message, upErr.code)
        return {
          ok: false,
          error: kind === "missing_required_column" || kind === "rls_blocked" ? kind : "business_profile_update_failed",
          supabaseMessage: upErr.message,
        }
      }
      updated = true
    }

    const { data: bpForMember, error: bmLoadErr } = await admin
      .from("business_profiles")
      .select("id, owner_name, business_name, email")
      .eq("id", existing.id)
      .maybeSingle()
    if (bmLoadErr || !bpForMember?.id) {
      logPrepareBusinessProfileError("load business_profiles for membership", bmLoadErr)
      return {
        ok: false,
        error: "membership_insert_failed",
        supabaseMessage: bmLoadErr?.message ?? "business profile row missing",
      }
    }
    const memRes = await upsertOwnerMembershipAdmin(admin, {
      businessId: bpForMember.id,
      userId: user.id,
      userEmail: user.email ?? bpForMember.email,
      displayName: buildOwnerDisplayForMembership(bpForMember),
    })
    if (!memRes.ok) {
      logPrepareBusinessProfileError("upsert business_members (owner)", memRes.message)
      return { ok: false, error: "membership_insert_failed", supabaseMessage: memRes.message }
    }

    const idSync = await syncBusinessProfileIdentityForTrial(admin, existing.id, enrichedPlan)
    if (!idSync.ok) {
      logPrepareBusinessProfileError("sync business_profiles identity (existing)", idSync.message)
      const kind = classifyBusinessProfileWriteError(idSync.message, idSync.code)
      return {
        ok: false,
        error: kind === "missing_required_column" || kind === "rls_blocked" ? kind : "business_profile_update_failed",
        supabaseMessage: idSync.message,
      }
    }
    updated = true

    const { data: finalRow, error: frErr } = await admin
      .from("business_profiles")
      .select("id, subscription_status, account_type, company_tax_id_normalized, contact_phone_normalized")
      .eq("id", existing.id)
      .maybeSingle()

    if (frErr) {
      logPrepareBusinessProfileError("select business_profiles after update", frErr)
      const kind = classifyBusinessProfileWriteError(frErr.message, frErr.code)
      if (kind === "missing_required_column") {
        return { ok: false, error: "missing_required_column", supabaseMessage: frErr.message }
      }
      return { ok: false, error: "business_profile_insert_failed", supabaseMessage: frErr.message }
    }
    if (!finalRow?.id) {
      return { ok: false, error: "business_profile_insert_failed" }
    }

    const v = validateRowForCheckout(finalRow)
    if (!v.ok) {
      return { ok: false, error: v.error }
    }

    return {
      ok: true,
      businessId: finalRow.id,
      subscriptionStatus: finalRow.subscription_status ?? null,
      created: false,
      updated,
    }
  }

  if (accountType === REGISTERED && taxNorm.length === 10) {
    const nipCollision = await resolveRegisteredBusinessNipCollision(admin, user.id, taxNorm)
    if (nipCollision.outcome === "blocked_foreign_nip") {
      return { ok: false, error: "nip_company_already_exists" }
    }
    if (nipCollision.outcome === "member_of_existing_company") {
      const { data: reusedRow, error: reuseSelErr } = await admin
        .from("business_profiles")
        .select("id, subscription_status, account_type, company_tax_id_normalized, contact_phone_normalized")
        .eq("id", nipCollision.businessId)
        .maybeSingle()
      if (reuseSelErr) {
        logPrepareBusinessProfileError("select business_profiles nip member reuse", reuseSelErr)
        return {
          ok: false,
          error: classifyBusinessProfileWriteError(reuseSelErr.message, reuseSelErr.code),
          supabaseMessage: reuseSelErr.message,
        }
      }
      if (!reusedRow?.id) {
        return { ok: false, error: "business_profile_insert_failed" }
      }
      const vReuse = validateRowForCheckout(reusedRow)
      if (!vReuse.ok) {
        return { ok: false, error: vReuse.error }
      }
      return {
        ok: true,
        businessId: reusedRow.id,
        subscriptionStatus: reusedRow.subscription_status ?? null,
        created: false,
        updated: false,
      }
    }
  }

  const insertRes = await insertBusinessProfileFromPlan(admin, user.id, enrichedPlan, true)
  if (!insertRes.ok) {
    logPrepareBusinessProfileError("insert business_profiles", insertRes.message)
    return {
      ok: false,
      error: classifyBusinessProfileWriteError(insertRes.message, insertRes.code),
      supabaseMessage: insertRes.message,
    }
  }
  created = true

  const { data: bpForMember, error: bmLoadErr } = await admin
    .from("business_profiles")
    .select("id, owner_name, business_name, email")
    .eq("owner_id", user.id)
    .maybeSingle()
  if (bmLoadErr || !bpForMember?.id) {
    logPrepareBusinessProfileError("load business_profiles after insert for membership", bmLoadErr)
    return {
      ok: false,
      error: "membership_insert_failed",
      supabaseMessage: bmLoadErr?.message ?? "business profile row missing",
    }
  }
  const memRes = await upsertOwnerMembershipAdmin(admin, {
    businessId: bpForMember.id,
    userId: user.id,
    userEmail: user.email ?? bpForMember.email,
    displayName: buildOwnerDisplayForMembership(bpForMember),
  })
  if (!memRes.ok) {
    logPrepareBusinessProfileError("upsert business_members (owner) after insert", memRes.message)
    return { ok: false, error: "membership_insert_failed", supabaseMessage: memRes.message }
  }

  const idSync = await syncBusinessProfileIdentityForTrial(admin, bpForMember.id, enrichedPlan)
  if (!idSync.ok) {
    logPrepareBusinessProfileError("sync business_profiles identity (after insert)", idSync.message)
    const kind = classifyBusinessProfileWriteError(idSync.message, idSync.code)
    return {
      ok: false,
      error: kind === "missing_required_column" || kind === "rls_blocked" ? kind : "business_profile_update_failed",
      supabaseMessage: idSync.message,
    }
  }

  const { data: insertedRow, error: insSelErr } = await admin
    .from("business_profiles")
    .select("id, subscription_status, account_type, company_tax_id_normalized, contact_phone_normalized")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (insSelErr) {
    logPrepareBusinessProfileError("select business_profiles after insert", insSelErr)
    const kind = classifyBusinessProfileWriteError(insSelErr.message, insSelErr.code)
    if (kind === "missing_required_column") {
      return { ok: false, error: "missing_required_column", supabaseMessage: insSelErr.message }
    }
    return { ok: false, error: "business_profile_insert_failed", supabaseMessage: insSelErr.message }
  }
  if (!insertedRow?.id) {
    return { ok: false, error: "business_profile_insert_failed" }
  }

  const v = validateRowForCheckout(insertedRow)
  if (!v.ok) {
    return { ok: false, error: v.error }
  }

  return {
    ok: true,
    businessId: insertedRow.id,
    subscriptionStatus: insertedRow.subscription_status ?? null,
    created,
    updated: false,
  }
}
