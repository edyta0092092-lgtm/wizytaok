import { NextResponse } from "next/server"

import { readTestIntegrationFlags } from "@/lib/config/test-integration-flags"

export const dynamic = "force-dynamic"

/**
 * Public read-only shape for client UI (booleans only). Does not expose secrets.
 * testBillingEnabled / testNotificationsEnabled — kanoniczne klucze dla frontu.
 */
export async function GET() {
  const flags = readTestIntegrationFlags()
  return NextResponse.json(
    {
      testBillingEnabled: flags.enableTestBilling,
      testNotificationsEnabled: flags.enableTestNotifications,
      enableTestBilling: flags.enableTestBilling,
      enableTestNotifications: flags.enableTestNotifications,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  )
}
