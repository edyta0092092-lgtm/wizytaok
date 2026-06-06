import { NextResponse } from "next/server"

import { canManageMessageTemplates, canViewMessageSendHistory } from "@/lib/auth/permissions"
import { resolveActiveBusinessMemberForUser } from "@/lib/auth/resolve-active-business-member-server"
import { getSmsBusinessStatus } from "@/lib/notifications/sms-business-status"
import {
  getSmsMonthlyIncludedLimit,
  getSmsQuotaStatus,
} from "@/lib/notifications/sms-monthly-limit"
import { resolveSmsQuotaWarningLevel } from "@/lib/notifications/sms-quota-guard"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"

export async function GET() {
  const resolution = await resolveActiveBusinessMemberForUser()
  if (!resolution.ok) {
    return NextResponse.json({ ok: false, error: resolution.error }, { status: resolution.status })
  }

  const canRead =
    canManageMessageTemplates(resolution.effectiveRole) ||
    canViewMessageSendHistory(resolution.effectiveRole)
  if (!canRead) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_unconfigured" }, { status: 503 })
  }

  const [quota, status] = await Promise.all([
    getSmsQuotaStatus(admin, resolution.businessId),
    getSmsBusinessStatus(admin, resolution.businessId),
  ])

  const remaining = quota.countFailed ? null : quota.remaining

  return NextResponse.json({
    ok: true,
    quota: {
      used: quota.used,
      limit: quota.limit,
      includedLimit: quota.includedLimit,
      bonusLimit: quota.bonusLimit,
      remaining,
      allowed: quota.allowed,
      countFailed: quota.countFailed,
      warningLevel: resolveSmsQuotaWarningLevel(remaining),
    },
    status,
    monthlyLimit: getSmsMonthlyIncludedLimit(),
  })
}
