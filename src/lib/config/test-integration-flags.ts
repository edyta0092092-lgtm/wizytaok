/**
 * Test integrations are feature-flagged and can be disabled via ENV without removing code.
 *
 * Włączone, gdy zmienna jest ustawiona na truthy (trim, bez rozróżniania wielkości liter):
 * `true`, `1`, `yes`, `on` — tak jak często w Vercel / panelach hostów.
 */
export type TestIntegrationFlags = {
  enableTestNotifications: boolean
  enableTestBilling: boolean
}

/** Odczyt pojedynczej flagi z ENV (Next.js / Vercel). */
export function readEnvFlagEnabled(raw: string | undefined): boolean {
  if (raw == null) return false
  const v = raw.trim().toLowerCase()
  return v === "true" || v === "1" || v === "yes" || v === "on"
}

export function readTestIntegrationFlags(): TestIntegrationFlags {
  return {
    enableTestNotifications: readEnvFlagEnabled(process.env.ENABLE_TEST_NOTIFICATIONS),
    enableTestBilling:
      readEnvFlagEnabled(process.env.ENABLE_TEST_BILLING) ||
      readEnvFlagEnabled(process.env.NEXT_PUBLIC_ENABLE_TEST_BILLING),
  }
}
