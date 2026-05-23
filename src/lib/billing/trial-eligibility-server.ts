import type { SupabaseClient } from "@supabase/supabase-js"

import {
  ACCOUNT_TYPE_REGISTERED,
  ACCOUNT_TYPE_UNREGISTERED,
} from "@/lib/billing/account-types"
import {
  hasBlockedSubscriptionStatus,
  normalizeDigits,
  trialBlockedByIdentityElsewhere,
  type BusinessProfileRow,
  type TrialBlockContext,
} from "@/lib/billing/stripe-subscription-checkout-server"
import { normalizeEmail } from "@/lib/clients/normalize"
import { TRIAL_ALREADY_USED_USER_MESSAGE_PL } from "@/lib/billing/trial-eligibility-messages"
import type { Database } from "@/types/database"

export { TRIAL_ALREADY_USED_USER_MESSAGE_PL, TRIAL_ALREADY_USED_USER_MESSAGE_EN } from "@/lib/billing/trial-eligibility-messages"

export type TrialEligibilityBlockReason =
  | TrialBlockContext
  | "email_taken"
  | "stripe_customer_taken"
  | "subscription_exists"

export type TrialConsumptionRow = Pick<
  BusinessProfileRow,
  | "trial_used_at"
  | "trial_started_at"
  | "stripe_subscription_id"
  | "subscription_status"
  | "stripe_subscription_status"
>

const TRIAL_GUARD_SELECT =
  "id, owner_id, email, trial_used_at, trial_started_at, stripe_subscription_id, subscription_status, stripe_subscription_status, stripe_customer_id, company_tax_id_normalized, contact_phone_normalized, account_type"

export function profileRowConsumedTrial(row: TrialConsumptionRow): boolean {
  const hasUsedTrial = Boolean(row.trial_used_at?.trim() || row.trial_started_at?.trim())
  const hasAnySubscription = Boolean(row.stripe_subscription_id?.trim())
  return (
    hasUsedTrial ||
    hasAnySubscription ||
    hasBlockedSubscriptionStatus(row.subscription_status) ||
    hasBlockedSubscriptionStatus(row.stripe_subscription_status)
  )
}

function trialBlockMessage(reason: TrialEligibilityBlockReason): string {
  switch (reason) {
    case "phone_taken":
      return "Darmowy okres próbny został już wykorzystany dla tej osoby."
    case "nip_taken":
      return "Darmowy okres próbny został już wykorzystany dla tej firmy."
    case "own_profile":
      return TRIAL_ALREADY_USED_USER_MESSAGE_PL
    case "email_taken":
    case "stripe_customer_taken":
    case "subscription_exists":
      return TRIAL_ALREADY_USED_USER_MESSAGE_PL
    default:
      return TRIAL_ALREADY_USED_USER_MESSAGE_PL
  }
}

function anyProfileConsumedTrial(rows: TrialConsumptionRow[] | null | undefined): boolean {
  return (rows ?? []).some((row) => profileRowConsumedTrial(row))
}

async function findConsumedTrialByEmail(
  admin: SupabaseClient<Database>,
  emailRaw: string,
  excludeBusinessId?: string,
): Promise<boolean> {
  const email = emailRaw.trim()
  if (!email) return false

  let query = admin.from("business_profiles").select(TRIAL_GUARD_SELECT).ilike("email", email)
  if (excludeBusinessId) {
    query = query.neq("id", excludeBusinessId)
  }
  const { data, error } = await query
  if (error) {
    console.error("[trial-eligibility] email lookup", error.message)
    return false
  }
  return anyProfileConsumedTrial(data as TrialConsumptionRow[])
}

async function findConsumedTrialByStripeCustomer(
  admin: SupabaseClient<Database>,
  stripeCustomerId: string,
  excludeBusinessId?: string,
): Promise<boolean> {
  const customerId = stripeCustomerId.trim()
  if (!customerId) return false

  let query = admin
    .from("business_profiles")
    .select(TRIAL_GUARD_SELECT)
    .eq("stripe_customer_id", customerId)
  if (excludeBusinessId) {
    query = query.neq("id", excludeBusinessId)
  }
  const { data, error } = await query
  if (error) {
    console.error("[trial-eligibility] stripe_customer lookup", error.message)
    return false
  }
  return anyProfileConsumedTrial(data as TrialConsumptionRow[])
}

async function findConsumedTrialByOwnerId(
  admin: SupabaseClient<Database>,
  ownerId: string,
  excludeBusinessId?: string,
): Promise<boolean> {
  let query = admin.from("business_profiles").select(TRIAL_GUARD_SELECT).eq("owner_id", ownerId)
  if (excludeBusinessId) {
    query = query.neq("id", excludeBusinessId)
  }
  const { data, error } = await query
  if (error) {
    console.error("[trial-eligibility] owner_id lookup", error.message)
    return false
  }
  return anyProfileConsumedTrial(data as TrialConsumptionRow[])
}

export type EvaluateTrialStartEligibilityInput = {
  userId: string
  userEmail: string | null | undefined
  businessProfile: BusinessProfileRow | null
}

export type EvaluateTrialStartEligibilityResult =
  | { blocked: false }
  | { blocked: true; reason: TrialEligibilityBlockReason; message: string }

/**
 * Czy użytkownik może rozpocząć nowy trial (niezależnie od providera logowania).
 * Wymaga service role — sprawdza też inne profile (ten sam e-mail / NIP / telefon / Stripe customer).
 */
export async function evaluateTrialStartEligibility(
  admin: SupabaseClient<Database>,
  input: EvaluateTrialStartEligibilityInput,
): Promise<EvaluateTrialStartEligibilityResult> {
  const userId = input.userId.trim()
  const businessId = input.businessProfile?.id
  const bp = input.businessProfile

  if (bp) {
    if (profileRowConsumedTrial(bp)) {
      return {
        blocked: true,
        reason: "own_profile",
        message: trialBlockMessage("own_profile"),
      }
    }

    const status = bp.subscription_status?.trim().toLowerCase() ?? null
    const stripeStatus = bp.stripe_subscription_status?.trim().toLowerCase() ?? null
    const hasStripeSubscriptionId = Boolean(bp.stripe_subscription_id?.trim())
    if (
      hasBlockedSubscriptionStatus(status) ||
      hasBlockedSubscriptionStatus(stripeStatus) ||
      hasStripeSubscriptionId
    ) {
      return {
        blocked: true,
        reason: "subscription_exists",
        message: trialBlockMessage("subscription_exists"),
      }
    }

    const accountTypeRaw = bp.account_type?.trim()
    if (
      accountTypeRaw === ACCOUNT_TYPE_REGISTERED ||
      accountTypeRaw === ACCOUNT_TYPE_UNREGISTERED
    ) {
      const identityBlock = await trialBlockedByIdentityElsewhere(
        admin,
        bp,
        bp.id,
        accountTypeRaw,
      )
      if (identityBlock) {
        return {
          blocked: true,
          reason: identityBlock,
          message: trialBlockMessage(identityBlock),
        }
      }
    }

    const customerId = bp.stripe_customer_id?.trim()
    if (customerId) {
      const taken = await findConsumedTrialByStripeCustomer(admin, customerId, bp.id)
      if (taken) {
        return {
          blocked: true,
          reason: "stripe_customer_taken",
          message: trialBlockMessage("stripe_customer_taken"),
        }
      }
    }
  }

  if (userId) {
    const ownerConsumed = await findConsumedTrialByOwnerId(admin, userId, businessId)
    if (ownerConsumed) {
      return {
        blocked: true,
        reason: "own_profile",
        message: trialBlockMessage("own_profile"),
      }
    }
  }

  const authEmail = normalizeEmail(input.userEmail) ?? input.userEmail?.trim().toLowerCase()
  if (authEmail) {
    const emailTaken = await findConsumedTrialByEmail(admin, authEmail, businessId)
    if (emailTaken) {
      return {
        blocked: true,
        reason: "email_taken",
        message: trialBlockMessage("email_taken"),
      }
    }
  }

  const profileEmail = normalizeEmail(bp?.email ?? null)
  if (profileEmail && profileEmail !== authEmail) {
    const profileEmailTaken = await findConsumedTrialByEmail(admin, profileEmail, businessId)
    if (profileEmailTaken) {
      return {
        blocked: true,
        reason: "email_taken",
        message: trialBlockMessage("email_taken"),
      }
    }
  }

  if (bp) {
    const accountType = bp.account_type?.trim()
    const taxNorm = normalizeDigits(bp.company_tax_id_normalized)
    const phoneNorm = normalizeDigits(bp.contact_phone_normalized)

    if (accountType === ACCOUNT_TYPE_REGISTERED && taxNorm) {
      const { data: sameTax } = await admin
        .from("business_profiles")
        .select(TRIAL_GUARD_SELECT)
        .eq("company_tax_id_normalized", taxNorm)
        .neq("id", bp.id)
      if (anyProfileConsumedTrial(sameTax as TrialConsumptionRow[])) {
        return {
          blocked: true,
          reason: "nip_taken",
          message: trialBlockMessage("nip_taken"),
        }
      }
    }

    if (accountType === ACCOUNT_TYPE_UNREGISTERED && phoneNorm) {
      const { data: samePhone } = await admin
        .from("business_profiles")
        .select(TRIAL_GUARD_SELECT)
        .eq("contact_phone_normalized", phoneNorm)
        .neq("id", bp.id)
      if (anyProfileConsumedTrial(samePhone as TrialConsumptionRow[])) {
        return {
          blocked: true,
          reason: "phone_taken",
          message: trialBlockMessage("phone_taken"),
        }
      }
    }
  }

  return { blocked: false }
}
