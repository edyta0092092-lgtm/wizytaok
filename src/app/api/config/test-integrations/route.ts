import { NextResponse } from "next/server"

import { readTestIntegrationFlags } from "@/lib/config/test-integration-flags"

/**
 * Public read-only shape for client UI (booleans only). Does not expose secrets.
 */
export async function GET() {
  const flags = readTestIntegrationFlags()
  return NextResponse.json({
    enableTestNotifications: flags.enableTestNotifications,
    enableTestBilling: flags.enableTestBilling,
  })
}
