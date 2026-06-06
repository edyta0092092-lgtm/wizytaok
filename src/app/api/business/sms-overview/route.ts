import { NextResponse } from "next/server"

import { canManageMessageTemplates, canViewMessageSendHistory } from "@/lib/auth/permissions"
import { resolveActiveBusinessMemberForUser } from "@/lib/auth/resolve-active-business-member-server"
import { getSmsBusinessStatus } from "@/lib/notifications/sms-business-status"
import { getSmsMonthlyLimit, getSmsQuotaStatus } from "@/lib/notifications/sms-monthly-limit"
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

  const limit = quota.limit
  const used = quota.used
  const remaining = quota.countFailed ? null : Math.max(0, limit - used)

  return NextResponse.json({
    ok: true,
    quota: {
      used,
      limit,
      remaining,
      allowed: quota.allowed,
      countFailed: quota.countFailed,
    },
    status,
    monthlyLimit: getSmsMonthlyLimit(),
  })
}
