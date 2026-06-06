import { NextResponse } from "next/server"

import { requireReferralAdmin } from "@/lib/referrals/member-auth"
import { isReferralPersistenceReady } from "@/lib/referrals/persistence-ready"
import { buildReferralSignupUrl } from "@/lib/referrals/referral-code"
import { loadReferralDashboard } from "@/lib/referrals/referral-repository"
import { computeReferralRewardEligibility } from "@/lib/referrals/referral-rewards"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await requireReferralAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const persistenceReady = await isReferralPersistenceReady()
  if (!persistenceReady) {
    return NextResponse.json({
      ok: true,
      persistenceReady: false,
      code: null,
      referralUrl: null,
      stats: { registrations: 0, trialActivated: 0, paying: 0 },
      history: [],
      rewards: [],
    })
  }

  const dashboard = await loadReferralDashboard(auth.ctx.businessId)
  if (!dashboard) {
    return NextResponse.json({ ok: false, error: "load_failed" }, { status: 500 })
  }

  const origin = new URL(request.url).origin
  const referralUrl = dashboard.code ? buildReferralSignupUrl(dashboard.code, origin) : null
  const rewards = computeReferralRewardEligibility(dashboard.stats.paying)

  return NextResponse.json({
    ok: true,
    persistenceReady: true,
    code: dashboard.code,
    referralUrl,
    stats: dashboard.stats,
    history: dashboard.history,
    rewards,
  })
}
