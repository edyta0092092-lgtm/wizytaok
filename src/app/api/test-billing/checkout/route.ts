import { NextResponse } from "next/server"
import Stripe from "stripe"

import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import { readTestIntegrationFlags } from "@/lib/config/test-integration-flags"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ALLOWED_SOURCES = new Set([
  "wizytaok_test_billing",
  "landing_trial_signup",
  "landing_trial_existing_user",
])

function collectConfigErrors(): string[] {
  const errs: string[] = []
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!siteUrl) {
    errs.push("Brak NEXT_PUBLIC_SITE_URL (wymagany do success_url / cancel_url w Stripe Checkout).")
  }

  const secret = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secret) {
    errs.push("Brak STRIPE_SECRET_KEY.")
  } else if (secret.startsWith("sk_live_")) {
    errs.push("STRIPE_SECRET_KEY nie może być kluczem produkcyjnym (sk_live_).")
  } else if (!secret.startsWith("sk_test_")) {
    errs.push("STRIPE_SECRET_KEY musi być kluczem testowym (sk_test_...).")
  }

  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
  if (pk) {
    if (pk.startsWith("pk_live_")) {
      errs.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY nie może być pk_live_.")
    } else if (!pk.startsWith("pk_test_")) {
      errs.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY musi zaczynać się od pk_test_.")
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
 * Stripe Checkout — subskrypcja testowa (trial 30 dni), wyłącznie sk_test_ / price_.
 */
export async function POST(request: Request) {
  const flags = readTestIntegrationFlags()
  if (!flags.enableTestBilling) {
    return NextResponse.json(
      {
        ok: false,
        reason: "test_billing_disabled",
        error: "test_billing_disabled",
        hint: "Testowy billing jest wyłączony (ENABLE_TEST_BILLING / NEXT_PUBLIC_ENABLE_TEST_BILLING).",
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
    return NextResponse.json(
      {
        ok: false,
        reason: "stripe_config_invalid",
        error: "stripe_config_invalid",
        hint: configErrors.join(" "),
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
    return NextResponse.json(
      {
        ok: false,
        reason: "stripe_config_invalid",
        error: "stripe_config_invalid",
        hint: "Niepełna konfiguracja Stripe lub NEXT_PUBLIC_SITE_URL.",
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
    return NextResponse.json(
      {
        ok: false,
        reason: "business_resolution_failed",
        error: resolution.error,
        debug: {
          enableTestBilling: true,
          hasStripePriceId: Boolean(priceId),
        },
      },
      { status: resolution.status }
    )
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
        reason: "service_role_missing",
        error: "service_role_missing",
        debug: {
          enableTestBilling: true,
          hasStripePriceId: Boolean(priceId),
        },
      },
      { status: 500 }
    )
  }

  const { data: bp } = await admin
    .from("business_profiles")
    .select("stripe_customer_id, subscription_status")
    .eq("id", resolution.businessId)
    .maybeSingle()

  const status = bp?.subscription_status?.trim().toLowerCase()
  if (status === "trialing" || status === "active") {
    return NextResponse.json(
      {
        ok: false,
        reason: "subscription_already_active",
        error: "subscription_already_active",
        hint: "Dla tej firmy trial/subskrypcja jest juz aktywna.",
        debug: {
          enableTestBilling: true,
          hasStripePriceId: true,
          subscriptionStatus: status,
          businessId: resolution.businessId,
        },
      },
      { status: 409 }
    )
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
        source,
      },
    },
    success_url: `${base}/settings?stripe_test=success`,
    cancel_url: `${base}/settings?stripe_test=cancel`,
    client_reference_id: resolution.businessId,
    metadata: {
      business_id: resolution.businessId,
      user_id: resolution.userId,
      source,
    },
  }

  const existingCustomer = bp?.stripe_customer_id?.trim()
  if (existingCustomer) {
    sessionParams.customer = existingCustomer
  } else if (resolution.userEmail?.trim()) {
    sessionParams.customer_email = resolution.userEmail.trim()
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  if (!session.url) {
    return NextResponse.json(
      {
        ok: false,
        reason: "checkout_url_missing",
        error: "checkout_url_missing",
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
}
