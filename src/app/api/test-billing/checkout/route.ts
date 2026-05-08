import { NextResponse } from "next/server"
import Stripe from "stripe"

import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import { readTestIntegrationFlags } from "@/lib/config/test-integration-flags"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

function billingSiteBase(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (site) return site.replace(/\/$/, "")
  const explicit = process.env.APP_ORIGIN?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`
  return "http://localhost:3000"
}

function collectConfigErrors(): string[] {
  const errs: string[] = []
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
export async function POST() {
  const flags = readTestIntegrationFlags()
  if (!flags.enableTestBilling) {
    return NextResponse.json({ ok: false, error: "disabled" }, { status: 404 })
  }

  const configErrors = collectConfigErrors()
  if (configErrors.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "stripe_config_invalid",
        hint: configErrors.join(" "),
        details: configErrors,
      },
      { status: 400 }
    )
  }

  const secret = process.env.STRIPE_SECRET_KEY!.trim()
  const priceId = process.env.STRIPE_PRICE_ID!.trim()
  const resolution = await resolveAdminBusinessForUser()
  if (!resolution.ok) {
    return NextResponse.json({ ok: false, error: resolution.error }, { status: resolution.status })
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 500 })
  }

  const { data: bp } = await admin
    .from("business_profiles")
    .select("stripe_customer_id")
    .eq("id", resolution.businessId)
    .maybeSingle()

  const stripe = new Stripe(secret)
  const base = billingSiteBase()

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 30,
      metadata: {
        business_id: resolution.businessId,
        user_id: resolution.userId,
        source: "wizytaok_test_billing",
      },
    },
    success_url: `${base}/settings?stripe_test=success`,
    cancel_url: `${base}/settings?stripe_test=cancel`,
    client_reference_id: resolution.businessId,
    metadata: {
      business_id: resolution.businessId,
      user_id: resolution.userId,
      source: "wizytaok_test_billing",
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
    return NextResponse.json({ ok: false, error: "no_checkout_url" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, url: session.url })
}
