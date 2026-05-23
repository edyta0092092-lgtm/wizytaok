import { NextResponse } from "next/server"
import Stripe from "stripe"

import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import { loadBusinessProfileForCheckout } from "@/lib/billing/stripe-subscription-checkout-server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type PortalReturnTo = "activate-access" | "settings"

function getStripeServer(): Stripe | NextResponse {
  const secret = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secret || (!secret.startsWith("sk_test_") && !secret.startsWith("sk_live_"))) {
    return NextResponse.json({ error: "stripe_secret_key_invalid" }, { status: 500 })
  }
  return new Stripe(secret)
}

function parseReturnTo(body: unknown): PortalReturnTo {
  if (!body || typeof body !== "object") return "activate-access"
  const raw = (body as { returnTo?: unknown }).returnTo
  return raw === "settings" ? "settings" : "activate-access"
}

export async function POST(request: Request) {
  const stripeRaw = getStripeServer()
  if (stripeRaw instanceof NextResponse) return stripeRaw
  const stripe = stripeRaw

  const siteBaseRaw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!siteBaseRaw) {
    return NextResponse.json(
      {
        ok: false,
        error: "site_url_missing",
        message: "Brak NEXT_PUBLIC_SITE_URL (wymagany do powrotu z Stripe Portal).",
      },
      { status: 500 }
    )
  }

  const resolution = await resolveAdminBusinessForUser()
  if (!resolution.ok) {
    const resolutionMessage =
      resolution.error === "unauthorized"
        ? "Sesja wygasła lub nie jesteś zalogowany. Odśwież stronę i zaloguj się ponownie."
        : resolution.error === "forbidden"
          ? "Brak uprawnień do zarządzania płatnościami tej firmy."
          : resolution.error === "no_business"
            ? "Nie znaleziono profilu firmy powiązanego z kontem."
            : "Nie udało się zweryfikować firmy."
    return NextResponse.json(
      {
        ok: false,
        error: resolution.error,
        message: resolutionMessage,
      },
      { status: resolution.status }
    )
  }

  let returnTo: PortalReturnTo = "activate-access"
  try {
    const body: unknown = await request.json()
    returnTo = parseReturnTo(body)
  } catch {
    returnTo = "activate-access"
  }

  const loaded = await loadBusinessProfileForCheckout(resolution)
  if (!loaded.ok) {
    return loaded.response
  }

  const customerId = loaded.bp.stripe_customer_id?.trim() ?? ""
  if (!customerId) {
    return NextResponse.json(
      {
        ok: false,
        error: "stripe_customer_missing",
        message: "Brak klienta Stripe dla tej firmy. Najpierw uruchom trial lub opłać dostęp.",
      },
      { status: 400 }
    )
  }

  const base = siteBaseRaw.replace(/\/$/, "")
  const returnUrl =
    returnTo === "settings"
      ? `${base}/settings?billing=required&portal=return`
      : `${base}/activate-access?portal=return`

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })

    if (!session.url) {
      return NextResponse.json(
        {
          ok: false,
          error: "portal_url_missing",
          message: "Stripe nie zwrócił adresu panelu płatności.",
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, url: session.url })
  } catch (err) {
    const stripeMsg = err instanceof Stripe.errors.StripeError ? err.message : null
    const message =
      stripeMsg && stripeMsg.trim().length > 0
        ? stripeMsg.trim()
        : "Nie udało się otworzyć panelu płatności Stripe. Spróbuj ponownie za chwilę."
    return NextResponse.json(
      {
        ok: false,
        error: "stripe_portal_failed",
        message,
      },
      { status: 500 }
    )
  }
}
