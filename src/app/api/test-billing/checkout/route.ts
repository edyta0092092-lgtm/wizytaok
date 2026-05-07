import { NextResponse } from "next/server"
import Stripe from "stripe"

import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import { readTestIntegrationFlags } from "@/lib/config/test-integration-flags"

function appOrigin(): string {
  const explicit = process.env.APP_ORIGIN?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`
  return "http://localhost:3000"
}

/**
 * Tworzy sesję Stripe Checkout wyłącznie w trybie testowym (wymaga sk_test_).
 * Włącz przez ENABLE_TEST_BILLING=true — patrz docs/TEST_INTEGRATIONS_FLAGS.md
 */
export async function POST() {
  const flags = readTestIntegrationFlags()
  if (!flags.enableTestBilling) {
    return NextResponse.json({ ok: false, error: "disabled" }, { status: 404 })
  }

  const secret = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secret || !secret.startsWith("sk_test_")) {
    return NextResponse.json(
      {
        ok: false,
        error: "stripe_test_secret_required",
        hint: "Set STRIPE_SECRET_KEY to a Stripe test secret (sk_test_...).",
      },
      { status: 400 }
    )
  }

  const resolution = await resolveAdminBusinessForUser()
  if (!resolution.ok) {
    return NextResponse.json({ ok: false, error: resolution.error }, { status: resolution.status })
  }

  const stripe = new Stripe(secret)
  const origin = appOrigin()

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "pln",
          product_data: {
            name: "WizytaOK — płatność testowa (1 PLN)",
            description:
              "Sesja testowa Stripe Checkout. Używaj tylko kluczy testowych; bez tego endpoint pozostaje nieaktywny.",
          },
          unit_amount: 100,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/settings?stripe_test=success`,
    cancel_url: `${origin}/settings?stripe_test=cancel`,
    metadata: {
      wizytaok_test_checkout: "true",
      business_id: resolution.businessId,
    },
  })

  if (!session.url) {
    return NextResponse.json({ ok: false, error: "no_checkout_url" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, url: session.url })
}
