import { NextResponse } from "next/server"
import Stripe from "stripe"

import {
  ACCOUNT_TYPE_REGISTERED,
  ACCOUNT_TYPE_UNREGISTERED,
  assertBusinessProfileIdentityForCheckout,
  applyCustomerToSession,
  buildSubscriptionMetadata,
  collectStripeCheckoutConfigErrors,
  hasBlockedSubscriptionStatus,
  loadBusinessProfileForCheckout,
  normalizeDigits,
  type TrialBlockContext,
} from "@/lib/billing/stripe-subscription-checkout-server"
import {
  evaluateTrialStartEligibility,
  type TrialEligibilityBlockReason,
} from "@/lib/billing/trial-eligibility-server"
import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import { isTrialStripeCheckoutEnvReady, readTestIntegrationFlags } from "@/lib/config/test-integration-flags"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ALLOWED_SOURCES = new Set([
  "wizytaok_test_billing",
  "landing_trial_signup",
  "landing_trial_existing_user",
])

/** Okres próbny dla nowych subskrypcji Stripe Checkout (nie dotyczy istniejących subskrypcji). */
const TRIAL_PERIOD_DAYS = 14

/**
 * Stripe Checkout — subskrypcja z okresem próbnym (14 dni); klucze sk_test_ lub sk_live_ + price_.
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

  const configErrors = collectStripeCheckoutConfigErrors()
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

  const loaded = await loadBusinessProfileForCheckout(resolution)
  if (!loaded.ok) {
    return loaded.response
  }

  const { bp, resolution: res } = loaded

  const status =
    typeof bp.subscription_status === "string" ? bp.subscription_status.trim().toLowerCase() : null
  const stripeStatus =
    typeof bp.stripe_subscription_status === "string"
      ? bp.stripe_subscription_status.trim().toLowerCase()
      : null
  const hasStripeSubscriptionId =
    typeof bp.stripe_subscription_id === "string" && bp.stripe_subscription_id.trim().length > 0
  const admin = getServiceRoleClient()

  const trialBlockPayload = (
    msg: string,
    context: TrialBlockContext | TrialEligibilityBlockReason,
    bpRow: typeof bp,
  ) => ({
    ok: false,
    reason: "trial_already_used" as const,
    error: "trial_already_used" as const,
    message: msg,
    hint: msg,
    trialBlockContext: context,
    accountType:
      bpRow.account_type?.trim() === ACCOUNT_TYPE_REGISTERED ||
      bpRow.account_type?.trim() === ACCOUNT_TYPE_UNREGISTERED
        ? bpRow.account_type.trim()
        : null,
    debug: {
      enableTestBilling: true,
      hasStripePriceId: true,
      subscriptionStatus: status,
      stripeSubscriptionStatus: stripeStatus,
      hasStripeSubscriptionId,
      businessId: res.businessId,
      trialStartedAt: bpRow?.trial_started_at ?? null,
      trialUsedAt: bpRow?.trial_used_at ?? null,
    },
  })

  if (admin) {
    const trialEligibility = await evaluateTrialStartEligibility(admin, {
      userId: res.userId,
      userEmail: res.userEmail,
      businessProfile: bp,
    })
    if (trialEligibility.blocked) {
      const ctx =
        trialEligibility.reason === "subscription_exists"
          ? "own_profile"
          : trialEligibility.reason
      return NextResponse.json(
        {
          ...trialBlockPayload(trialEligibility.message, ctx, bp),
          reason: "trial_already_used" as const,
          error: "trial_already_used" as const,
        },
        { status: 409 },
      )
    }
  }

  if (
    hasBlockedSubscriptionStatus(status) ||
    hasBlockedSubscriptionStatus(stripeStatus) ||
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
          businessId: res.businessId,
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

  const meta = buildSubscriptionMetadata(
    { businessId: res.businessId, userId: res.userId },
    accountType,
    companyTaxIdNormalized,
    contactPhoneNormalized,
    source
  )

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: TRIAL_PERIOD_DAYS,
      metadata: meta,
    },
    success_url: `${base}/activate-access?stripe_test=success`,
    cancel_url: `${base}/activate-access?stripe_test=cancel`,
    client_reference_id: res.businessId,
    metadata: meta,
  }

  applyCustomerToSession(sessionParams, bp, res.userEmail)

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
            businessId: res.businessId,
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
        businessId: res.businessId,
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
          businessId: res.businessId,
        },
      },
      { status: 502 }
    )
  }
}
