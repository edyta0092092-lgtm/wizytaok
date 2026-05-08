import { NextResponse } from "next/server"
import Stripe from "stripe"

import {
  upsertBusinessStripeFromSubscription,
} from "@/lib/stripe/business-subscription-sync"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type HandlerOutcome =
  | { kind: "ok" }
  | { kind: "skipped"; reason: string }
  | { kind: "failed"; error: string }

function stripeLog(payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      ...payload,
      ts: new Date().toISOString(),
    })
  )
}

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

function customerIdFromStripe(
  ref: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): string | null {
  if (!ref) return null
  if (typeof ref === "string") return ref
  if ("deleted" in ref && ref.deleted) return null
  return ref.id ?? null
}

async function resolveBusinessIdFromSubscription(sub: Stripe.Subscription): Promise<string | null> {
  const fromMeta = sub.metadata?.business_id?.trim()
  if (fromMeta) return fromMeta
  const customerId = customerIdFromStripe(sub.customer)
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
  return resolveBusinessIdFromSubscription(sub)
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<HandlerOutcome> {
  if (session.mode !== "subscription") {
    return { kind: "skipped", reason: "not_subscription_mode" }
  }

  const businessId = session.metadata?.business_id?.trim() ?? null
  const subRef = session.subscription
  const subId = typeof subRef === "string" ? subRef : subRef?.id
  const customerId = customerIdFromStripe(session.customer)

  stripeLog({
    message: "stripe_webhook_received",
    stripe_webhook_event_type: "checkout.session.completed",
    stripe_webhook_business_id: businessId,
    stripe_webhook_subscription_id: subId ?? null,
    stripe_webhook_customer_id: customerId,
  })

  if (!businessId || !subId) {
    stripeLog({
      message: "stripe_webhook_update_error",
      stripe_webhook_event_type: "checkout.session.completed",
      stripe_webhook_business_id: businessId,
      stripe_webhook_subscription_id: subId ?? null,
      stripe_webhook_customer_id: customerId,
      error: "missing_business_id_or_subscription",
    })
    return { kind: "failed", error: "missing_business_id_or_subscription" }
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    stripeLog({
      message: "stripe_webhook_update_error",
      stripe_webhook_event_type: "checkout.session.completed",
      error: "service_role_missing",
    })
    return { kind: "failed", error: "service_role_missing" }
  }

  const sub = await stripe.subscriptions.retrieve(subId)
  const upd = await upsertBusinessStripeFromSubscription(admin, businessId, {
    stripeCustomerId: customerId,
    subscription: sub,
  })

  if (!upd.ok) {
    stripeLog({
      message: "stripe_webhook_update_error",
      stripe_webhook_event_type: "checkout.session.completed",
      stripe_webhook_business_id: businessId,
      stripe_webhook_subscription_id: sub.id,
      stripe_webhook_customer_id: customerId,
      error: upd.error,
    })
    return { kind: "failed", error: upd.error }
  }

  stripeLog({
    message: "stripe_webhook_update_success",
    stripe_webhook_event_type: "checkout.session.completed",
    stripe_webhook_business_id: businessId,
    stripe_webhook_subscription_id: sub.id,
    stripe_webhook_customer_id: customerId,
  })
  return { kind: "ok" }
}

async function handleSubscriptionEvent(sub: Stripe.Subscription, eventType: string): Promise<HandlerOutcome> {
  const customerId = customerIdFromStripe(sub.customer)

  stripeLog({
    message: "stripe_webhook_received",
    stripe_webhook_event_type: eventType,
    stripe_webhook_subscription_id: sub.id,
    stripe_webhook_customer_id: customerId,
  })

  const businessId = await resolveBusinessIdFromSubscription(sub)
  if (!businessId) {
    stripeLog({
      message: "stripe_webhook_update_error",
      stripe_webhook_event_type: eventType,
      stripe_webhook_subscription_id: sub.id,
      stripe_webhook_customer_id: customerId,
      error: "business_unresolved",
    })
    return { kind: "skipped", reason: "business_unresolved" }
  }

  stripeLog({
    message: "stripe_webhook_received",
    stripe_webhook_business_id: businessId,
    stripe_webhook_subscription_id: sub.id,
    stripe_webhook_customer_id: customerId,
  })

  const admin = getServiceRoleClient()
  if (!admin) {
    stripeLog({
      message: "stripe_webhook_update_error",
      stripe_webhook_event_type: eventType,
      error: "service_role_missing",
    })
    return { kind: "failed", error: "service_role_missing" }
  }

  const upd = await upsertBusinessStripeFromSubscription(admin, businessId, {
    stripeCustomerId: customerId,
    subscription: sub,
  })

  if (!upd.ok) {
    stripeLog({
      message: "stripe_webhook_update_error",
      stripe_webhook_event_type: eventType,
      stripe_webhook_business_id: businessId,
      stripe_webhook_subscription_id: sub.id,
      stripe_webhook_customer_id: customerId,
      error: upd.error,
    })
    return { kind: "failed", error: upd.error }
  }

  stripeLog({
    message: "stripe_webhook_update_success",
    stripe_webhook_event_type: eventType,
    stripe_webhook_business_id: businessId,
    stripe_webhook_subscription_id: sub.id,
    stripe_webhook_customer_id: customerId,
  })
  return { kind: "ok" }
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription, eventType: string): Promise<HandlerOutcome> {
  const customerId = customerIdFromStripe(sub.customer)
  const businessId = await resolveBusinessIdFromSubscription(sub)

  stripeLog({
    message: "stripe_webhook_received",
    stripe_webhook_event_type: eventType,
    stripe_webhook_business_id: businessId,
    stripe_webhook_subscription_id: sub.id,
    stripe_webhook_customer_id: customerId,
  })

  if (!businessId) {
    stripeLog({
      message: "stripe_webhook_update_error",
      stripe_webhook_event_type: eventType,
      stripe_webhook_subscription_id: sub.id,
      stripe_webhook_customer_id: customerId,
      error: "business_unresolved",
    })
    return { kind: "skipped", reason: "business_unresolved" }
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return { kind: "failed", error: "service_role_missing" }
  }

  const upd = await upsertBusinessStripeFromSubscription(admin, businessId, {
    stripeCustomerId: customerId,
    subscription: sub,
  })

  if (!upd.ok) {
    stripeLog({
      message: "stripe_webhook_update_error",
      stripe_webhook_event_type: eventType,
      stripe_webhook_business_id: businessId,
      error: upd.error,
    })
    return { kind: "failed", error: upd.error }
  }

  stripeLog({
    message: "stripe_webhook_update_success",
    stripe_webhook_event_type: eventType,
    stripe_webhook_business_id: businessId,
    stripe_webhook_subscription_id: sub.id,
  })
  return { kind: "ok" }
}

async function handleInvoice(
  stripe: Stripe,
  invoice: Stripe.Invoice,
  eventType: string
): Promise<HandlerOutcome> {
  const businessId = await resolveBusinessIdFromInvoice(stripe, invoice)
  const subRef = getInvoiceSubscriptionRef(invoice)
  const subId = typeof subRef === "string" ? subRef : subRef?.id
  const customerId = customerIdFromStripe(invoice.customer)

  stripeLog({
    message: "stripe_webhook_received",
    stripe_webhook_event_type: eventType,
    stripe_webhook_business_id: businessId,
    stripe_webhook_subscription_id: subId ?? null,
    stripe_webhook_customer_id: customerId,
  })

  if (!businessId || !subId) {
    stripeLog({
      message: "stripe_webhook_update_error",
      stripe_webhook_event_type: eventType,
      error: "invoice_business_or_subscription_unresolved",
    })
    return { kind: "skipped", reason: "invoice_unresolved" }
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return { kind: "failed", error: "service_role_missing" }
  }

  const sub = await stripe.subscriptions.retrieve(subId)
  const upd = await upsertBusinessStripeFromSubscription(admin, businessId, {
    stripeCustomerId: customerId,
    subscription: sub,
  })

  if (!upd.ok) {
    stripeLog({
      message: "stripe_webhook_update_error",
      stripe_webhook_event_type: eventType,
      stripe_webhook_business_id: businessId,
      error: upd.error,
    })
    return { kind: "failed", error: upd.error }
  }

  stripeLog({
    message: "stripe_webhook_update_success",
    stripe_webhook_event_type: eventType,
    stripe_webhook_business_id: businessId,
    stripe_webhook_subscription_id: sub.id,
    stripe_webhook_customer_id: customerId,
  })
  return { kind: "ok" }
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

  stripeLog({
    message: "stripe_webhook_received",
    stripe_webhook_event_type: event.type,
  })

  let outcome: HandlerOutcome = { kind: "skipped", reason: "unhandled_event_type" }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        outcome = await handleCheckoutCompleted(stripe, session)
        break
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        outcome = await handleSubscriptionEvent(sub, event.type)
        break
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        outcome = await handleSubscriptionDeleted(sub, event.type)
        break
      }
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        outcome = await handleInvoice(stripe, invoice, event.type)
        break
      }
      default:
        outcome = { kind: "skipped", reason: "unhandled_event_type" }
        break
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "handler_threw"
    stripeLog({
      message: "stripe_webhook_update_error",
      stripe_webhook_event_type: event.type,
      error: msg,
    })
    return NextResponse.json({ received: false, error: "handler_failed" }, { status: 500 })
  }

  if (outcome.kind === "failed") {
    return NextResponse.json(
      { received: false, error: outcome.error },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}
