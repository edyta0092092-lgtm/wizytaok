export type CustomerPortalReturnTo = "activate-access" | "settings"

export type CustomerPortalResult =
  | { ok: true; url: string }
  | { ok: false; reason: string; message: string }

export async function openCustomerPortal(
  returnTo: CustomerPortalReturnTo = "activate-access",
): Promise<CustomerPortalResult> {
  const res = await fetch("/api/billing/customer-portal", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ returnTo }),
  })

  const rawBody = await res.text()
  type PortalJson = {
    ok?: boolean
    url?: string
    error?: string
    message?: string
    reason?: string
  }
  let payload: PortalJson | null = null
  if (rawBody.trim().length > 0) {
    try {
      payload = JSON.parse(rawBody) as PortalJson
    } catch {
      payload = null
    }
  }

  if (res.ok && typeof payload?.url === "string" && payload.url.length > 0) {
    return { ok: true, url: payload.url }
  }

  const reason = payload?.error?.trim() || payload?.reason?.trim() || "portal_failed"
  const message =
    payload?.message?.trim() ||
    (reason === "stripe_customer_missing"
      ? "Brak klienta Stripe dla tej firmy."
      : "Nie udało się otworzyć panelu płatności.")

  return { ok: false, reason, message }
}
