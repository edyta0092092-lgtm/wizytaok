/**
 * Test integrations are feature-flagged and can be disabled via ENV without removing code.
 *
 * Use only explicit `"true"` to enable; any other value keeps test UI and routes off.
 */
export type TestIntegrationFlags = {
  enableTestNotifications: boolean
  enableTestBilling: boolean
}

export function readTestIntegrationFlags(): TestIntegrationFlags {
  return {
    enableTestNotifications: process.env.ENABLE_TEST_NOTIFICATIONS === "true",
    enableTestBilling: process.env.ENABLE_TEST_BILLING === "true",
  }
}
