import { NextResponse } from "next/server"
import Stripe from "stripe"

import {
  assertBusinessProfileIdentityForCheckout,
  applyCustomerToSession,
  buildSubscriptionMetadata,
  collectStripeCheckoutConfigErrors,
  hasBlockedSubscriptionStatus,
  loadBusinessProfileForCheckout,
  normalizeDigits,
} from "@/lib/billing/stripe-subscription-checkout-server"
import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import { isTrialStripeCheckoutEnvReady, readTestIntegrationFlags } from "@/lib/config/test-integration-flags"

const PAID_SOURCE = "paid_subscription_after_trial_used"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Stripe Checkout — płatna subskrypcja od razu (bez trial_period_days).
 */
export async function POST() {
  const flags = readTestIntegrationFlags()
  const checkoutAllowed = flags.enableTestBilling || isTrialStripeCheckoutEnvReady()
  if (!checkoutAllowed) {
    return NextResponse.json(
      {
        ok: false,
        reason: "test_billing_disabled",
        error: "test_billing_disabled",
        message:
          "Brak konfiguracji Stripe. Ustaw STRIPE_SECRET_KEY i STRIPE_PRICE_ID albo włącz ENABLE_TEST_BILLING.",
        hint:
          "Brak konfiguracji Stripe. Ustaw STRIPE_SECRET_KEY i STRIPE_PRICE_ID albo włącz ENABLE_TEST_BILLING.",
        debug: {
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

  if (
    hasBlockedSubscriptionStatus(status) ||
    hasBlockedSubscriptionStatus(stripeStatus) ||
    hasStripeSubscriptionId
  ) {
    return NextResponse.json(
      {
        ok: false,
        reason: "subscription_already_active",
        error: "subscription_already_active",
        message: "Subskrypcja jest już aktywna.",
        hint: "Subskrypcja jest już aktywna.",
        debug: {
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

  const stripe = new Stripe(secret)

  const meta = buildSubscriptionMetadata(
    { businessId: res.businessId, userId: res.userId },
    accountType,
    companyTaxIdNormalized,
    contactPhoneNormalized,
    PAID_SOURCE
  )

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: meta,
    },
    success_url: `${base}/settings?stripe_paid=success`,
    cancel_url: `${base}/start-trial?stripe_paid=cancel`,
    client_reference_id: res.businessId,
    metadata: meta,
  }

  applyCustomerToSession(sessionParams, bp, res.userEmail)

  try {
    const session = await stripe.checkout.sessions.create(sessionParams)

    if (!session.url) {
      return NextResponse.json(
        {
          ok: false,
          reason: "checkout_url_missing",
          error: "checkout_url_missing",
          message: "Stripe nie zwrócił adresu płatności.",
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      reason: "checkout_created",
      url: session.url,
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
      },
      { status: 502 }
    )
  }
}
