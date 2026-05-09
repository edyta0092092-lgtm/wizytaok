import { NextResponse } from "next/server"
import Stripe from "stripe"

import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import { isTrialStripeCheckoutEnvReady, readTestIntegrationFlags } from "@/lib/config/test-integration-flags"
import { getServerClient } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Database } from "@/types/database"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ALLOWED_SOURCES = new Set([
  "wizytaok_test_billing",
  "landing_trial_signup",
  "landing_trial_existing_user",
])
const BLOCKED_SUBSCRIPTION_STATUSES = new Set(["trialing", "active", "past_due", "unpaid", "incomplete"])
const ACCOUNT_TYPE_REGISTERED = "registered_business"
const ACCOUNT_TYPE_UNREGISTERED = "unregistered_activity"

type BusinessProfileRow = Database["public"]["Tables"]["business_profiles"]["Row"]

function assertBusinessProfileIdentityForCheckout(
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

function normalizeDigits(raw: string | null | undefined): string | null {
  if (!raw) return null
  const normalized = raw.replace(/\D/g, "")
  return normalized.length > 0 ? normalized : null
}

function hasBlockedStatus(status: string | null | undefined): boolean {
  const normalized = status?.trim().toLowerCase()
  return Boolean(normalized && BLOCKED_SUBSCRIPTION_STATUSES.has(normalized))
}

function isSkTestSecret(secret: string): boolean {
  return secret.startsWith("sk_test_")
}

function isSkLiveSecret(secret: string): boolean {
  return secret.startsWith("sk_live_")
}

function collectConfigErrors(): string[] {
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

/**
 * Stripe Checkout — subskrypcja z okresem próbnym (30 dni); klucze sk_test_ lub sk_live_ + price_.
 */
export async function POST(request: Request) {
  const flags = readTestIntegrationFlags()
  const checkoutAllowed = flags.enableTestBilling || isTrialStripeCheckoutEnvReady()
  if (!checkoutAllowed) {
    return NextResponse.json(
      {
        ok: false,
        reason: "test_billing_disabled",
        error: "test_billing_disabled",
        hint:
          "Brak konfiguracji Stripe dla okresu próbnego. Ustaw STRIPE_SECRET_KEY i STRIPE_PRICE_ID albo włącz ENABLE_TEST_BILLING.",
        message:
          "Brak konfiguracji Stripe dla okresu próbnego. Ustaw STRIPE_SECRET_KEY i STRIPE_PRICE_ID albo włącz ENABLE_TEST_BILLING.",
        debug: {
          enableTestBilling: false,
          hasStripePriceId: Boolean(process.env.STRIPE_PRICE_ID?.trim()),
        },
      },
      { status: 403 }
    )
  }

  const configErrors = collectConfigErrors()
  if (configErrors.length > 0) {
    const configHint = configErrors.join(" ")
    return NextResponse.json(
      {
        ok: false,
        reason: "stripe_config_invalid",
        error: "stripe_config_invalid",
        message: configHint,
        hint: configHint,
        details: configErrors,
        debug: {
          enableTestBilling: true,
          hasStripePriceId: Boolean(process.env.STRIPE_PRICE_ID?.trim()),
        },
      },
      { status: 400 }
    )
  }

  const siteBaseRaw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const secret = process.env.STRIPE_SECRET_KEY?.trim()
  const priceId = process.env.STRIPE_PRICE_ID?.trim()
  if (!siteBaseRaw || !secret || !priceId) {
    const hint = "Niepełna konfiguracja Stripe lub NEXT_PUBLIC_SITE_URL."
    return NextResponse.json(
      {
        ok: false,
        reason: "stripe_config_invalid",
        error: "stripe_config_invalid",
        message: hint,
        hint,
        debug: {
          enableTestBilling: true,
          hasStripePriceId: Boolean(priceId),
        },
      },
      { status: 500 }
    )
  }
  const base = siteBaseRaw.replace(/\/$/, "")
  const resolution = await resolveAdminBusinessForUser()
  if (!resolution.ok) {
    const resolutionMessage =
      resolution.error === "unauthorized"
        ? "Sesja wygasła lub nie jesteś zalogowany. Odśwież stronę i zaloguj się ponownie."
        : resolution.error === "no_business"
          ? "Nie znaleziono profilu firmy powiązanego z kontem."
          : resolution.error === "forbidden"
            ? "Brak uprawnień do włączenia subskrypcji dla tej firmy."
            : "Nie udało się zweryfikować firmy."
    return NextResponse.json(
      {
        ok: false,
        reason: "business_resolution_failed",
        error: resolution.error,
        message: resolutionMessage,
        hint: resolutionMessage,
        debug: {
          enableTestBilling: true,
          hasStripePriceId: Boolean(priceId),
        },
      },
      { status: resolution.status }
    )
  }

  const admin = getServiceRoleClient()
  const userSb = await getServerClient()

  let bp: BusinessProfileRow | null = null

  if (admin) {
    const { data } = await admin.from("business_profiles").select("*").eq("id", resolution.businessId).maybeSingle()
    bp = data ?? null
  } else if (userSb) {
    const { data } = await userSb
      .from("business_profiles")
      .select("*")
      .eq("id", resolution.businessId)
      .maybeSingle()
    bp = data ?? null
  } else {
    return NextResponse.json(
      {
        ok: false,
        reason: "supabase_server_missing",
        error: "supabase_server_missing",
        message: "Brak konfiguracji Supabase po stronie serwera.",
        hint: "Brak konfiguracji Supabase po stronie serwera.",
        debug: {
          enableTestBilling: true,
          hasStripePriceId: Boolean(priceId),
        },
      },
      { status: 500 }
    )
  }

  if (!bp?.id) {
    const hint =
      admin == null
        ? "Nie znaleziono profilu firmy (być może konto członkowskie). Dodaj SUPABASE_SERVICE_ROLE_KEY w Vercel albo zaloguj się na konto właściciela."
        : "Nie znaleziono profilu firmy."
    return NextResponse.json(
      {
        ok: false,
        reason: "business_profile_missing",
        error: "business_profile_missing",
        message: hint,
        hint,
      },
      { status: 404 }
    )
  }

  const status =
    typeof bp.subscription_status === "string" ? bp.subscription_status.trim().toLowerCase() : null
  const stripeStatus =
    typeof bp.stripe_subscription_status === "string"
      ? bp.stripe_subscription_status.trim().toLowerCase()
      : null
  const hasStripeSubscriptionId =
    typeof bp.stripe_subscription_id === "string" && bp.stripe_subscription_id.trim().length > 0
  const trialAlreadyUsed = Boolean(bp.trial_used_at) || Boolean(bp.trial_started_at)

  if (trialAlreadyUsed) {
    return NextResponse.json(
      {
        ok: false,
        reason: "trial_already_used",
        error: "trial_already_used",
        message: "Darmowy okres próbny został już wykorzystany dla tej firmy.",
        hint: "Darmowy okres próbny został już wykorzystany dla tej firmy.",
        debug: {
          enableTestBilling: true,
          hasStripePriceId: true,
          subscriptionStatus: status,
          stripeSubscriptionStatus: stripeStatus,
          hasStripeSubscriptionId,
          businessId: resolution.businessId,
          trialStartedAt: bp?.trial_started_at ?? null,
          trialUsedAt: bp?.trial_used_at ?? null,
        },
      },
      { status: 409 }
    )
  }

  if (
    hasBlockedStatus(status) ||
    hasBlockedStatus(stripeStatus) ||
    hasStripeSubscriptionId
  ) {
    return NextResponse.json(
      {
        ok: false,
        reason: "subscription_already_exists",
        error: "subscription_already_exists",
        message: "Ta firma ma już aktywną lub istniejącą subskrypcję.",
        hint: "Ta firma ma już aktywną lub istniejącą subskrypcję.",
        debug: {
          enableTestBilling: true,
          hasStripePriceId: true,
          subscriptionStatus: status,
          stripeSubscriptionStatus: stripeStatus,
          hasStripeSubscriptionId,
          businessId: resolution.businessId,
        },
      },
      { status: 409 }
    )
  }

  const identity = assertBusinessProfileIdentityForCheckout(bp)
  if (!identity.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: "business_profile_incomplete",
        error: identity.error,
        message: identity.message,
        hint: identity.message,
      },
      { status: 422 }
    )
  }

  const accountType = identity.accountType
  const companyTaxIdNormalized = normalizeDigits(
    typeof bp.company_tax_id_normalized === "string" ? bp.company_tax_id_normalized : null
  )
  const contactPhoneNormalized = normalizeDigits(
    typeof bp.contact_phone_normalized === "string" ? bp.contact_phone_normalized : null
  )

  if (admin) {
    if (accountType === ACCOUNT_TYPE_REGISTERED && companyTaxIdNormalized) {
      const { data: sameTaxProfiles } = await admin
        .from("business_profiles")
        .select(
          "id, trial_used_at, trial_started_at, stripe_subscription_id, subscription_status, stripe_subscription_status"
        )
        .eq("company_tax_id_normalized", companyTaxIdNormalized)
        .neq("id", bp.id)

      const blockedByTax = (sameTaxProfiles ?? []).some((row) => {
        const hasUsedTrial = Boolean(row.trial_used_at) || Boolean(row.trial_started_at)
        const hasAnySubscription = Boolean(row.stripe_subscription_id?.trim())
        return (
          hasUsedTrial ||
          hasAnySubscription ||
          hasBlockedStatus(row.subscription_status) ||
          hasBlockedStatus(row.stripe_subscription_status)
        )
      })
      if (blockedByTax) {
        return NextResponse.json(
          {
            ok: false,
            reason: "trial_already_used",
            error: "trial_already_used",
            message: "Darmowy okres próbny został już wykorzystany dla tej firmy lub osoby.",
          },
          { status: 409 }
        )
      }
    }

    if (accountType === ACCOUNT_TYPE_UNREGISTERED && contactPhoneNormalized) {
      const { data: samePhoneProfiles } = await admin
        .from("business_profiles")
        .select(
          "id, trial_used_at, trial_started_at, stripe_subscription_id, subscription_status, stripe_subscription_status"
        )
        .eq("contact_phone_normalized", contactPhoneNormalized)
        .neq("id", bp.id)

      const blockedByPhone = (samePhoneProfiles ?? []).some((row) => {
        const hasUsedTrial = Boolean(row.trial_used_at) || Boolean(row.trial_started_at)
        const hasAnySubscription = Boolean(row.stripe_subscription_id?.trim())
        return (
          hasUsedTrial ||
          hasAnySubscription ||
          hasBlockedStatus(row.subscription_status) ||
          hasBlockedStatus(row.stripe_subscription_status)
        )
      })
      if (blockedByPhone) {
        return NextResponse.json(
          {
            ok: false,
            reason: "trial_already_used",
            error: "trial_already_used",
            message: "Darmowy okres próbny został już wykorzystany dla tej firmy lub osoby.",
          },
          { status: 409 }
        )
      }
    }
  }

  let source = "wizytaok_test_billing"
  try {
    const payload = (await request.json()) as { source?: unknown } | undefined
    const candidate = typeof payload?.source === "string" ? payload.source.trim() : ""
    if (candidate && ALLOWED_SOURCES.has(candidate)) {
      source = candidate
    }
  } catch {
    // body is optional
  }

  const stripe = new Stripe(secret)

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 30,
      metadata: {
        business_id: resolution.businessId,
        user_id: resolution.userId,
        account_type: accountType ?? "",
        company_tax_id_normalized: companyTaxIdNormalized ?? "",
        contact_phone_normalized: contactPhoneNormalized ?? "",
        source,
      },
    },
    success_url: `${base}/settings?stripe_test=success`,
    cancel_url: `${base}/settings?stripe_test=cancel`,
    client_reference_id: resolution.businessId,
    metadata: {
      business_id: resolution.businessId,
      user_id: resolution.userId,
      account_type: accountType ?? "",
      company_tax_id_normalized: companyTaxIdNormalized ?? "",
      contact_phone_normalized: contactPhoneNormalized ?? "",
      source,
    },
  }

  const existingCustomer = bp?.stripe_customer_id?.trim()
  if (existingCustomer) {
    sessionParams.customer = existingCustomer
  } else if (resolution.userEmail?.trim()) {
    sessionParams.customer_email = resolution.userEmail.trim()
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams)

    if (!session.url) {
      const msg = "Stripe nie zwrócił adresu płatności."
      return NextResponse.json(
        {
          ok: false,
          reason: "checkout_url_missing",
          error: "checkout_url_missing",
          message: msg,
          hint: msg,
          debug: {
            enableTestBilling: true,
            hasStripePriceId: true,
            businessId: resolution.businessId,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      reason: "checkout_created",
      url: session.url,
      debug: {
        enableTestBilling: true,
        hasStripePriceId: true,
        businessId: resolution.businessId,
      },
    })
  } catch (err) {
    const stripeMsg = err instanceof Stripe.errors.StripeError ? err.message : null
    const msg =
      stripeMsg && stripeMsg.trim().length > 0
        ? stripeMsg.trim()
        : "Nie udało się utworzyć sesji płatności Stripe. Sprawdź STRIPE_PRICE_ID i tryb kluczy (test/live)."
    return NextResponse.json(
      {
        ok: false,
        reason: "stripe_checkout_failed",
        error: "stripe_checkout_failed",
        message: msg,
        hint: msg,
        debug: {
          enableTestBilling: true,
          hasStripePriceId: true,
          businessId: resolution.businessId,
        },
      },
      { status: 502 }
    )
  }
}
