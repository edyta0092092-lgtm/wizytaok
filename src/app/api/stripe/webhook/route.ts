import { NextResponse } from "next/server"
import Stripe from "stripe"

import {
  upsertBusinessStripeFromSubscription,
} from "@/lib/stripe/business-subscription-sync"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getStripeForWebhook(): Stripe | NextResponse {
  const secret = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secret || !secret.startsWith("sk_test_")) {
    return NextResponse.json({ error: "stripe_test_secret_required" }, { status: 500 })
  }
  return new Stripe(secret)
}

function getWebhookSecret(): string | NextResponse {
  const wh = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!wh || !wh.startsWith("whsec_")) {
    return NextResponse.json({ error: "stripe_webhook_secret_missing" }, { status: 500 })
  }
  return wh
}

/** Subscription reference on invoices (Stripe API 2025+ / SDK v20: under `parent.subscription_details`). */
function getInvoiceSubscriptionRef(
  invoice: Stripe.Invoice
): string | Stripe.Subscription | null {
  const parent = invoice.parent
  if (parent?.type === "subscription_details") {
    const sub = parent.subscription_details?.subscription
    if (sub) return sub
  }
  return null
}

async function resolveBusinessIdFromSubscription(
  stripe: Stripe,
  sub: Stripe.Subscription
): Promise<string | null> {
  const fromMeta = sub.metadata?.business_id?.trim()
  if (fromMeta) return fromMeta
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id
  if (!customerId) return null
  const admin = getServiceRoleClient()
  if (!admin) return null
  const { data } = await admin
    .from("business_profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()
  return data?.id?.trim() ?? null
}

async function resolveBusinessIdFromInvoice(stripe: Stripe, invoice: Stripe.Invoice): Promise<string | null> {
  const subRef = getInvoiceSubscriptionRef(invoice)
  const subId = typeof subRef === "string" ? subRef : subRef?.id
  if (!subId) return null
  const sub = await stripe.subscriptions.retrieve(subId)
  return resolveBusinessIdFromSubscription(stripe, sub)
}

async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return
  const businessId = session.metadata?.business_id?.trim()
  const subRef = session.subscription
  const subId = typeof subRef === "string" ? subRef : subRef?.id
  const customerRef = session.customer
  const customerId = typeof customerRef === "string" ? customerRef : customerRef?.id
  if (!businessId || !subId) return
  const sub = await stripe.subscriptions.retrieve(subId)
  const admin = getServiceRoleClient()
  if (!admin) return
  await upsertBusinessStripeFromSubscription(admin, businessId, {
    stripeCustomerId: customerId ?? null,
    subscription: sub,
  })
}

async function handleSubscriptionEvent(stripe: Stripe, sub: Stripe.Subscription) {
  const businessId = await resolveBusinessIdFromSubscription(stripe, sub)
  if (!businessId) return
  const customerRef = sub.customer
  const customerId = typeof customerRef === "string" ? customerRef : customerRef?.id
  const admin = getServiceRoleClient()
  if (!admin) return
  await upsertBusinessStripeFromSubscription(admin, businessId, {
    stripeCustomerId: customerId ?? null,
    subscription: sub,
  })
}

async function handleSubscriptionDeleted(stripe: Stripe, sub: Stripe.Subscription) {
  const businessId = await resolveBusinessIdFromSubscription(stripe, sub)
  if (!businessId) return
  const customerRef = sub.customer
  const customerId = typeof customerRef === "string" ? customerRef : customerRef?.id
  const admin = getServiceRoleClient()
  if (!admin) return
  await upsertBusinessStripeFromSubscription(admin, businessId, {
    stripeCustomerId: customerId ?? null,
    subscription: sub,
  })
}

async function handleInvoice(stripe: Stripe, invoice: Stripe.Invoice) {
  const businessId = await resolveBusinessIdFromInvoice(stripe, invoice)
  if (!businessId) return
  const subRef = getInvoiceSubscriptionRef(invoice)
  const subId = typeof subRef === "string" ? subRef : subRef?.id
  if (!subId) return
  const sub = await stripe.subscriptions.retrieve(subId)
  const customerRef = sub.customer
  const customerId = typeof customerRef === "string" ? customerRef : customerRef?.id
  const admin = getServiceRoleClient()
  if (!admin) return
  await upsertBusinessStripeFromSubscription(admin, businessId, {
    stripeCustomerId: customerId ?? null,
    subscription: sub,
  })
}

export async function POST(req: Request) {
  const whSecretRaw = getWebhookSecret()
  if (whSecretRaw instanceof NextResponse) return whSecretRaw

  const stripeRaw = getStripeForWebhook()
  if (stripeRaw instanceof NextResponse) return stripeRaw
  const stripe = stripeRaw

  const sig = req.headers.get("stripe-signature")
  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const rawBody = await req.text()
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecretRaw)
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(stripe, session)
        break
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionEvent(stripe, sub)
        break
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(stripe, sub)
        break
      }
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoice(stripe, invoice)
        break
      }
      default:
        break
    }
  } catch {
    return NextResponse.json({ received: true, error: "handler_failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
