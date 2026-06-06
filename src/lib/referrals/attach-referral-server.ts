import { cookies } from "next/headers"
import type { User } from "@supabase/supabase-js"

import { normalizeReferralCode, REFERRAL_COOKIE_NAME } from "@/lib/referrals/referral-code"
import { attachReferralForNewBusiness } from "@/lib/referrals/referral-repository"

function referralCodeFromUserMetadata(user: User): string | null {
  const meta = user.user_metadata ?? {}
  const fromMeta =
    typeof meta.referral_code === "string"
      ? meta.referral_code
      : typeof meta.referral_ref === "string"
        ? meta.referral_ref
        : null
  return normalizeReferralCode(fromMeta)
}

async function referralCodeFromCookies(): Promise<string | null> {
  try {
    const store = await cookies()
    const raw = store.get(REFERRAL_COOKIE_NAME)?.value
    if (!raw) return null
    return normalizeReferralCode(decodeURIComponent(raw))
  } catch {
    return null
  }
}

export async function resolveReferralCodeForUser(user: User): Promise<string | null> {
  return referralCodeFromUserMetadata(user) ?? (await referralCodeFromCookies())
}

export async function tryAttachReferralForNewBusiness(input: {
  user: User
  referredBusinessId: string
}): Promise<void> {
  const referralCode = await resolveReferralCodeForUser(input.user)
  if (!referralCode) return

  const result = await attachReferralForNewBusiness({
    referredBusinessId: input.referredBusinessId,
    referredUserId: input.user.id,
    referralCode,
  })

  if (!result.ok && result.reason !== "already_attributed") {
    console.info("[referrals] attach skipped", result.reason)
  }
}
