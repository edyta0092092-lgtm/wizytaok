import type { User } from "@supabase/supabase-js"

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

    const ownerFirst =
      typeof meta.owner_name === "string" ? meta.owner_name.trim() : existing.owner_name ?? ""
    const ownerLast =
      typeof meta.owner_last_name === "string"
        ? meta.owner_last_name.trim()
        : existing.owner_last_name ?? ""
    if (ownerFirst && existing.owner_name !== ownerFirst) {
      patch.owner_name = ownerFirst
    }
    if (ownerLast && existing.owner_last_name !== ownerLast) {
      patch.owner_last_name = ownerLast
    }

    if (Object.keys(patch).length > 0) {
      const { error: upErr } = await admin.from("business_profiles").update(patch).eq("id", existing.id)
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

    const { error: rpcErr } = await userSb.rpc("ensure_owner_membership")
    if (rpcErr) {
      logPrepareBusinessProfileError("ensure_owner_membership", rpcErr)
      return { ok: false, error: "membership_insert_failed", supabaseMessage: rpcErr.message }
    }

    const { data: finalRow, error: frErr } = await admin
      .from("business_profiles")
      .select("id, subscription_status, account_type, company_tax_id_normalized, contact_phone_normalized")
      .eq("id", existing.id)
      .maybeSingle()

    if (frErr || !finalRow?.id) {
      logPrepareBusinessProfileError("select business_profiles after update", frErr)
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

  const { error: rpcErr } = await userSb.rpc("ensure_owner_membership")
  if (rpcErr) {
    logPrepareBusinessProfileError("ensure_owner_membership", rpcErr)
    return { ok: false, error: "membership_insert_failed", supabaseMessage: rpcErr.message }
  }

  const { data: insertedRow, error: insSelErr } = await admin
    .from("business_profiles")
    .select("id, subscription_status, account_type, company_tax_id_normalized, contact_phone_normalized")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (insSelErr || !insertedRow?.id) {
    logPrepareBusinessProfileError("select business_profiles after insert", insSelErr)
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
