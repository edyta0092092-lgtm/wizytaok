import { NextResponse } from "next/server"
import Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  normalizeStripeBusinessId,
} from "@/lib/stripe/business-subscription-sync"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Database } from "@/types/database"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type HandlerOutcome =
  | { kind: "ok" }
  | { kind: "skipped"; reason: string }

function stripeLog(payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      ...payload,
      ts: new Date().toISOString(),
    })
  )
}

function extractMissingSchemaColumn(message: string): string | null {
  const m = /'([^']+)'\s+column/i.exec(message)
  return m?.[1]?.trim() || null
}

async function updateBusinessProfile(
  admin: SupabaseClient<Database>,
  businessId: string,
  patch: Record<string, unknown>
): Promise<{ data: Array<{ id: string }> | null; error: { message: string } | null }> {
  const mutablePatch: Record<string, unknown> = { ...patch }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await admin
      .from("business_profiles")
      .update(mutablePatch as never)
      .eq("id", businessId)
      .select("id")

    if (!result.error) {
      return {
        data: result.data as Array<{ id: string }> | null,
        error: null,
      }
    }

    const missingCol = extractMissingSchemaColumn(result.error.message)
    if (!missingCol || !(missingCol in mutablePatch)) {
      return {
        data: result.data as Array<{ id: string }> | null,
        error: result.error as { message: string } | null,
      }
    }

    delete mutablePatch[missingCol]
    stripeLog({
      message: "stripe_webhook_update_retry_without_missing_column",
      stripe_webhook_business_id: businessId,
      stripe_webhook_missing_column: missingCol,
    })
  }

  return { data: null, error: { message: "update_retry_limit_exceeded" } }
}

function toIsoFromSeconds(v: number | null | undefined): string | null {
  return typeof v === "number" && v > 0 ? new Date(v * 1000).toISOString() : null
}

function getSubscriptionCurrentPeriodEndIso(sub: Stripe.Subscription): string | null {
  const items = sub.items?.data
  if (!items?.length) return null
  let max: number | null = null
  for (const item of items) {
    const end = item.current_period_end
    if (typeof end === "number" && end > 0 && (max === null || end > max)) {
      max = end
    }
  }
  return max ? new Date(max * 1000).toISOString() : null
}

function buildSubscriptionPatch(input: {
  customerId: string | null
  subscriptionId: string
  status: string
  trialEndSec: number | null | undefined
  currentPeriodEndIso: string | null
  cancelAtPeriodEnd: boolean | null | undefined
}): Record<string, unknown> {
  const nowIso = new Date().toISOString()
  const trialEndsAtIso = toIsoFromSeconds(input.trialEndSec)
  const cancelAtPeriodEnd = input.cancelAtPeriodEnd ?? false

  return {
    stripe_customer_id: input.customerId,
    stripe_subscription_id: input.subscriptionId,

    subscription_status: input.status,
    stripe_subscription_status: input.status,

    subscription_trial_ends_at: trialEndsAtIso,
    stripe_subscription_trial_ends_at: trialEndsAtIso,

    subscription_current_period_end: input.currentPeriodEndIso,
    stripe_subscription_current_period_end: input.currentPeriodEndIso,

    subscription_cancel_at_period_end: cancelAtPeriodEnd,
    stripe_subscription_cancel_at_period_end: cancelAtPeriodEnd,

    subscription_updated_at: nowIso,
    stripe_subscription_updated_at: nowIso,
    stripe_subscription_synced_at: nowIso,
    updated_at: nowIso,
  }
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
  const fromMeta = normalizeStripeBusinessId(sub.metadata?.business_id)
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

async function resolveBusinessIdByCustomerId(
  admin: SupabaseClient<Database>,
  customerId: string | null
): Promise<string | null> {
  if (!customerId) return null
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
  const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data"] })
  return resolveBusinessIdFromSubscription(sub)
}

async function handleCheckoutCompleted(
  admin: SupabaseClient<Database>,
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<HandlerOutcome> {
  if (session.mode !== "subscription") return { kind: "skipped", reason: "not_subscription_mode" }

  const businessId = normalizeStripeBusinessId(session.metadata?.business_id)
  const customerId = customerIdFromStripe(session.customer)
  const subRef = session.subscription
  const subId = (typeof subRef === "string" ? subRef : subRef?.id) ?? null

  stripeLog({
    message: "stripe_webhook_received",
    stripe_webhook_event_type: "checkout.session.completed",
    stripe_webhook_business_id: businessId,
    stripe_webhook_subscription_id: subId ?? null,
    stripe_webhook_customer_id: customerId,
  })

  if (!businessId) {
    const fallbackByCustomer = await resolveBusinessIdByCustomerId(admin, customerId)
    if (!fallbackByCustomer) {
      stripeLog({
        message: "stripe_webhook_business_not_found",
        stripe_webhook_event_type: "checkout.session.completed",
        stripe_webhook_subscription_id: subId ?? null,
        stripe_webhook_customer_id: customerId,
      })
      stripeLog({
        message: "stripe_webhook_subscription_sync_skipped",
        stripe_webhook_event_type: "checkout.session.completed",
        reason: "missing_business_id",
      })
      return { kind: "skipped", reason: "missing_business_id" }
    }
    const synced = await syncCheckoutByBusiness(admin, stripe, fallbackByCustomer, customerId, subId)
    return synced
  }

  return syncCheckoutByBusiness(admin, stripe, businessId, customerId, subId)
}

async function syncCheckoutByBusiness(
  admin: SupabaseClient<Database>,
  stripe: Stripe,
  businessId: string,
  customerId: string | null,
  subId: string | null
): Promise<HandlerOutcome> {
  if (!subId) {
    stripeLog({
      message: "stripe_webhook_subscription_sync_skipped",
      stripe_webhook_event_type: "checkout.session.completed",
      stripe_webhook_business_id: businessId,
      stripe_webhook_subscription_id: subId ?? null,
      stripe_webhook_customer_id: customerId,
      reason: "missing_subscription_id",
    })
    return { kind: "skipped", reason: "missing_subscription_id" }
  }

  let subscription: Stripe.Subscription
  try {
    subscription = await stripe.subscriptions.retrieve(subId, { expand: ["items.data"] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "subscription_retrieve_failed"
    stripeLog({
      message: "stripe_webhook_subscription_sync_error",
      stripe_webhook_event_type: "checkout.session.completed",
      stripe_webhook_business_id: businessId,
      stripe_webhook_subscription_id: subId,
      stripe_webhook_customer_id: customerId,
      error: msg,
    })
    return { kind: "skipped", reason: "subscription_retrieve_failed" }
  }

  const patch = buildSubscriptionPatch({
    customerId,
    subscriptionId: subscription.id,
    status: subscription.status,
    trialEndSec: subscription.trial_end,
    currentPeriodEndIso: getSubscriptionCurrentPeriodEndIso(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  })
  const { data, error } = await updateBusinessProfile(admin, businessId, patch)

  if (error) {
    stripeLog({
      message: "stripe_webhook_subscription_sync_error",
      stripe_webhook_event_type: "checkout.session.completed",
      stripe_webhook_business_id: businessId,
      stripe_webhook_subscription_id: subscription.id,
      stripe_webhook_customer_id: customerId,
      error: error.message,
    })
    return { kind: "skipped", reason: "db_update_failed" }
  }

  if (!data?.length) {
    stripeLog({
      message: "stripe_webhook_business_not_found",
      stripe_webhook_event_type: "checkout.session.completed",
      stripe_webhook_business_id: businessId,
      stripe_webhook_subscription_id: subscription.id,
      stripe_webhook_customer_id: customerId,
    })
    stripeLog({
      message: "stripe_webhook_subscription_sync_skipped",
      stripe_webhook_event_type: "checkout.session.completed",
      reason: "no_row_updated",
    })
    return { kind: "skipped", reason: "no_row_updated" }
  }

  stripeLog({
    message: "stripe_webhook_subscription_sync_success",
    stripe_webhook_event_type: "checkout.session.completed",
    stripe_webhook_business_id: businessId,
    stripe_webhook_subscription_id: subscription.id,
    stripe_webhook_customer_id: customerId,
  })
  return { kind: "ok" }
}

async function handleSubscriptionEvent(
  admin: SupabaseClient<Database>,
  sub: Stripe.Subscription,
  eventType: string
): Promise<HandlerOutcome> {
  const customerId = customerIdFromStripe(sub.customer)

  stripeLog({
    message: "stripe_webhook_received",
    stripe_webhook_event_type: eventType,
    stripe_webhook_subscription_id: sub.id,
    stripe_webhook_customer_id: customerId,
  })

  const businessId = (await resolveBusinessIdFromSubscription(sub)) ?? (await resolveBusinessIdByCustomerId(admin, customerId))

  if (!businessId || !customerId) {
    stripeLog({
      message: "stripe_webhook_business_not_found",
      stripe_webhook_event_type: eventType,
      stripe_webhook_business_id: businessId ?? null,
      stripe_webhook_subscription_id: sub.id,
      stripe_webhook_customer_id: customerId ?? null,
    })
    stripeLog({
      message: "stripe_webhook_subscription_sync_skipped",
      stripe_webhook_event_type: eventType,
      reason: "business_unresolved_or_missing_customer",
    })
    return { kind: "skipped", reason: "business_unresolved_or_missing_customer" }
  }

  const patch = buildSubscriptionPatch({
    customerId,
    subscriptionId: sub.id,
    status: sub.status,
    trialEndSec: sub.trial_end,
    currentPeriodEndIso: getSubscriptionCurrentPeriodEndIso(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  })

  const { data, error } = await updateBusinessProfile(admin, businessId, patch)

  if (error) {
    stripeLog({
      message: "stripe_webhook_subscription_sync_error",
      stripe_webhook_event_type: eventType,
      stripe_webhook_business_id: businessId,
      stripe_webhook_subscription_id: sub.id,
      stripe_webhook_customer_id: customerId,
      error: error.message,
    })
    return { kind: "skipped", reason: "db_update_failed" }
  }

  if (!data?.length) {
    stripeLog({
      message: "stripe_webhook_business_not_found",
      stripe_webhook_event_type: eventType,
      stripe_webhook_business_id: businessId,
      stripe_webhook_subscription_id: sub.id,
      stripe_webhook_customer_id: customerId,
    })
    stripeLog({
      message: "stripe_webhook_subscription_sync_skipped",
      stripe_webhook_event_type: eventType,
      reason: "no_row_updated",
    })
    return { kind: "skipped", reason: "no_row_updated" }
  }

  stripeLog({
    message: "stripe_webhook_subscription_sync_success",
    stripe_webhook_event_type: eventType,
    stripe_webhook_business_id: businessId,
    stripe_webhook_subscription_id: sub.id,
    stripe_webhook_customer_id: customerId,
  })
  return { kind: "ok" }
}

async function handleSubscriptionDeleted(
  admin: SupabaseClient<Database>,
  sub: Stripe.Subscription,
  eventType: string
): Promise<HandlerOutcome> {
  return handleSubscriptionEvent(admin, sub, eventType)
}

async function handleInvoice(
  admin: SupabaseClient<Database>,
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
      message: "stripe_webhook_business_not_found",
      stripe_webhook_event_type: eventType,
      stripe_webhook_subscription_id: subId ?? null,
      stripe_webhook_customer_id: customerId,
    })
    stripeLog({
      message: "stripe_webhook_subscription_sync_skipped",
      stripe_webhook_event_type: eventType,
      reason: "invoice_business_or_subscription_unresolved",
    })
    return { kind: "skipped", reason: "invoice_unresolved" }
  }

  const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data"] })
  const patch = buildSubscriptionPatch({
    customerId,
    subscriptionId: sub.id,
    status: sub.status,
    trialEndSec: sub.trial_end,
    currentPeriodEndIso: getSubscriptionCurrentPeriodEndIso(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  })
  const upd = await updateBusinessProfile(admin, businessId, patch)

  if (upd.error) {
    stripeLog({
      message: "stripe_webhook_subscription_sync_error",
      stripe_webhook_event_type: eventType,
      stripe_webhook_business_id: businessId,
      error: upd.error.message,
    })
    return { kind: "skipped", reason: "db_update_failed" }
  }

  if (!upd.data?.length) {
    stripeLog({
      message: "stripe_webhook_business_not_found",
      stripe_webhook_event_type: eventType,
      stripe_webhook_business_id: businessId,
      stripe_webhook_subscription_id: sub.id,
      stripe_webhook_customer_id: customerId,
    })
    stripeLog({
      message: "stripe_webhook_subscription_sync_skipped",
      stripe_webhook_event_type: eventType,
      reason: "no_row_updated",
    })
    return { kind: "skipped", reason: "no_row_updated" }
  }

  stripeLog({
    message: "stripe_webhook_subscription_sync_success",
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

  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ error: "service_role_missing" }, { status: 500 })
  }

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
        outcome = await handleCheckoutCompleted(admin, stripe, session)
        break
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        outcome = await handleSubscriptionEvent(admin, sub, event.type)
        break
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        outcome = await handleSubscriptionDeleted(admin, sub, event.type)
        break
      }
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        outcome = await handleInvoice(admin, stripe, invoice, event.type)
        break
      }
      default:
        outcome = { kind: "skipped", reason: "unhandled_event_type" }
        break
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "handler_threw"
    stripeLog({
      message: "stripe_webhook_subscription_sync_error",
      stripe_webhook_event_type: event.type,
      error: msg,
    })
    return NextResponse.json({ received: true, skipped: true, reason: "handler_threw" })
  }

  return NextResponse.json({ received: true, outcome })
}
