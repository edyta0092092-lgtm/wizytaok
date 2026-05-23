import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

import {
  ACCOUNT_TYPE_REGISTERED,
  ACCOUNT_TYPE_UNREGISTERED,
} from "@/lib/billing/account-types"
import { SUBSCRIPTION_STATUSES_BLOCKING_NEW_CHECKOUT } from "@/lib/billing/subscription-status"
import { getServerClient } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Database } from "@/types/database"

export const BLOCKED_SUBSCRIPTION_STATUSES = SUBSCRIPTION_STATUSES_BLOCKING_NEW_CHECKOUT

export {
  ACCOUNT_TYPE_REGISTERED,
  ACCOUNT_TYPE_UNREGISTERED,
} from "@/lib/billing/account-types"

export type BusinessProfileRow = Database["public"]["Tables"]["business_profiles"]["Row"]

export type TrialBlockContext = "own_profile" | "nip_taken" | "phone_taken"

export function normalizeDigits(raw: string | null | undefined): string | null {
  if (!raw) return null
  const normalized = raw.replace(/\D/g, "")
  return normalized.length > 0 ? normalized : null
}

export function hasBlockedSubscriptionStatus(status: string | null | undefined): boolean {
  const normalized = status?.trim().toLowerCase()
  return Boolean(normalized && SUBSCRIPTION_STATUSES_BLOCKING_NEW_CHECKOUT.has(normalized))
}

export function assertBusinessProfileIdentityForCheckout(
  bp: BusinessProfileRow
):
  | { ok: true; accountType: typeof ACCOUNT_TYPE_REGISTERED | typeof ACCOUNT_TYPE_UNREGISTERED }
  | { ok: false; error: string; message: string } {
  const raw = bp.account_type?.trim()
  if (raw !== ACCOUNT_TYPE_REGISTERED && raw !== ACCOUNT_TYPE_UNREGISTERED) {
    return {
      ok: false,
      error: "missing_account_type",
      message:
        "Profil firmy nie ma typu działalności. Uzupełnij dane konta lub skontaktuj się z pomocą.",
    }
  }
  if (raw === ACCOUNT_TYPE_REGISTERED) {
    const d = normalizeDigits(bp.company_tax_id_normalized)
    if (!d || d.length !== 10) {
      return {
        ok: false,
        error: "missing_company_tax_id",
        message:
          "Brak poprawnego NIP w profilu firmy. Zarejestruj konto ponownie lub skontaktuj się z pomocą.",
      }
    }
  } else {
    const d = normalizeDigits(bp.contact_phone_normalized)
    if (!d || d.length < 9) {
      return {
        ok: false,
        error: "missing_contact_phone",
        message:
          "Brak numeru telefonu w profilu firmy. Zarejestruj konto ponownie lub skontaktuj się z pomocą.",
      }
    }
  }
  return { ok: true, accountType: raw }
}

function isSkTestSecret(secret: string): boolean {
  return secret.startsWith("sk_test_")
}

function isSkLiveSecret(secret: string): boolean {
  return secret.startsWith("sk_live_")
}

export function collectStripeCheckoutConfigErrors(): string[] {
  const errs: string[] = []
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!siteUrl) {
    errs.push("Brak NEXT_PUBLIC_SITE_URL (wymagany do success_url / cancel_url w Stripe Checkout).")
  }

  const secret = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secret) {
    errs.push("Brak STRIPE_SECRET_KEY.")
  } else if (!isSkTestSecret(secret) && !isSkLiveSecret(secret)) {
    errs.push("STRIPE_SECRET_KEY musi być kluczem sk_test_... lub sk_live_....")
  }

  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
  if (pk && secret) {
    if (isSkLiveSecret(secret) && pk.startsWith("pk_test_")) {
      errs.push("Przy STRIPE_SECRET_KEY sk_live_ ustaw NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY na pk_live_....")
    }
    if (isSkTestSecret(secret) && pk.startsWith("pk_live_")) {
      errs.push("Przy STRIPE_SECRET_KEY sk_test_ ustaw NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY na pk_test_....")
    }
    if (!pk.startsWith("pk_test_") && !pk.startsWith("pk_live_")) {
      errs.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY musi być pk_test_... lub pk_live_....")
    }
  }

  const priceId = process.env.STRIPE_PRICE_ID?.trim()
  if (!priceId) {
    errs.push("Brak STRIPE_PRICE_ID (musi zaczynać się od price_).")
  } else if (!priceId.startsWith("price_")) {
    errs.push("STRIPE_PRICE_ID musi zaczynać się od price_.")
  }

  return errs
}

export type LoadedBusinessProfile =
  | { ok: true; bp: BusinessProfileRow; resolution: { businessId: string; userId: string; userEmail: string | null } }
  | { ok: false; response: Response }

/**
 * Załaduj profil firmy (preferuj service role) po pozytywnej rozdzielczości admin/business.
 */
export async function loadBusinessProfileForCheckout(
  resolution: { businessId: string; userId: string; userEmail: string | null }
): Promise<LoadedBusinessProfile> {
  const admin = getServiceRoleClient()
  const userSb = await getServerClient()
  const priceId = Boolean(process.env.STRIPE_PRICE_ID?.trim())

  if (admin) {
    const { data } = await admin.from("business_profiles").select("*").eq("id", resolution.businessId).maybeSingle()
    const bp = data ?? null
    if (!bp?.id) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            ok: false,
            reason: "business_profile_missing",
            error: "business_profile_missing",
            message: "Nie znaleziono profilu firmy.",
            hint: "Nie znaleziono profilu firmy.",
            debug: { hasStripePriceId: priceId },
          },
          { status: 404 }
        ),
      }
    }
    return {
      ok: true,
      bp,
      resolution: {
        businessId: resolution.businessId,
        userId: resolution.userId,
        userEmail: resolution.userEmail,
      },
    }
  }

  if (userSb) {
    const { data } = await userSb.from("business_profiles").select("*").eq("id", resolution.businessId).maybeSingle()
    const bp = data ?? null
    if (!bp?.id) {
      const hint =
        "Nie znaleziono profilu firmy (być może konto członkowskie). Dodaj SUPABASE_SERVICE_ROLE_KEY w Vercel albo zaloguj się na konto właściciela."
      return {
        ok: false,
        response: NextResponse.json(
          {
            ok: false,
            reason: "business_profile_missing",
            error: "business_profile_missing",
            message: hint,
            hint,
            debug: { hasStripePriceId: priceId },
          },
          { status: 404 }
        ),
      }
    }
    return {
      ok: true,
      bp,
      resolution: {
        businessId: resolution.businessId,
        userId: resolution.userId,
        userEmail: resolution.userEmail,
      },
    }
  }

  return {
    ok: false,
    response: NextResponse.json(
      {
        ok: false,
        reason: "supabase_server_missing",
        error: "supabase_server_missing",
        message: "Brak konfiguracji Supabase po stronie serwera.",
        hint: "Brak konfiguracji Supabase po stronie serwera.",
        debug: { hasStripePriceId: priceId },
      },
      { status: 500 }
    ),
  }
}

export type SubscriptionMetadata = {
  business_id: string
  user_id: string
  account_type: string
  company_tax_id_normalized: string
  contact_phone_normalized: string
  source: string
}

export function buildSubscriptionMetadata(
  resolution: { businessId: string; userId: string },
  accountType: string,
  companyTaxIdNormalized: string | null,
  contactPhoneNormalized: string | null,
  source: string
): SubscriptionMetadata {
  return {
    business_id: resolution.businessId,
    user_id: resolution.userId,
    account_type: accountType ?? "",
    company_tax_id_normalized: companyTaxIdNormalized ?? "",
    contact_phone_normalized: contactPhoneNormalized ?? "",
    source,
  }
}

export function applyCustomerToSession(
  sessionParams: Stripe.Checkout.SessionCreateParams,
  bp: BusinessProfileRow,
  userEmail: string | null
): void {
  const existingCustomer = bp?.stripe_customer_id?.trim()
  if (existingCustomer) {
    sessionParams.customer = existingCustomer
  } else if (userEmail?.trim()) {
    sessionParams.customer_email = userEmail.trim()
  }
}

type OtherProfileRow = Pick<
  BusinessProfileRow,
  | "trial_used_at"
  | "trial_started_at"
  | "stripe_subscription_id"
  | "subscription_status"
  | "stripe_subscription_status"
>

function rowBlocksTrialConsumption(row: OtherProfileRow): boolean {
  const hasUsedTrial = Boolean(row.trial_used_at) || Boolean(row.trial_started_at)
  const hasAnySubscription = Boolean(row.stripe_subscription_id?.trim())
  return (
    hasUsedTrial ||
    hasAnySubscription ||
    hasBlockedSubscriptionStatus(row.subscription_status) ||
    hasBlockedSubscriptionStatus(row.stripe_subscription_status)
  )
}

/**
 * Blokada drugiego triala: ten sam NIP lub telefon na innym profilu (service role).
 */
export async function trialBlockedByIdentityElsewhere(
  admin: SupabaseClient<Database>,
  bp: BusinessProfileRow,
  businessId: string,
  accountType: typeof ACCOUNT_TYPE_REGISTERED | typeof ACCOUNT_TYPE_UNREGISTERED
): Promise<false | TrialBlockContext> {
  const companyTaxIdNormalized = normalizeDigits(
    typeof bp.company_tax_id_normalized === "string" ? bp.company_tax_id_normalized : null
  )
  const contactPhoneNormalized = normalizeDigits(
    typeof bp.contact_phone_normalized === "string" ? bp.contact_phone_normalized : null
  )

  if (accountType === ACCOUNT_TYPE_REGISTERED && companyTaxIdNormalized) {
    const { data: sameTaxProfiles } = await admin
      .from("business_profiles")
      .select(
        "id, trial_used_at, trial_started_at, stripe_subscription_id, subscription_status, stripe_subscription_status"
      )
      .eq("company_tax_id_normalized", companyTaxIdNormalized)
      .neq("id", businessId)

    const blockedByTax = (sameTaxProfiles ?? []).some((row) => rowBlocksTrialConsumption(row))
    if (blockedByTax) return "nip_taken"
  }

  if (accountType === ACCOUNT_TYPE_UNREGISTERED && contactPhoneNormalized) {
    const { data: samePhoneProfiles } = await admin
      .from("business_profiles")
      .select(
        "id, trial_used_at, trial_started_at, stripe_subscription_id, subscription_status, stripe_subscription_status"
      )
      .eq("contact_phone_normalized", contactPhoneNormalized)
      .neq("id", businessId)

    const blockedByPhone = (samePhoneProfiles ?? []).some((row) => rowBlocksTrialConsumption(row))
    if (blockedByPhone) return "phone_taken"
  }

  return false
}
