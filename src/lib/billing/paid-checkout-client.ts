export type PaidCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: string; message: string }

export async function startPaidStripeCheckout(): Promise<PaidCheckoutResult> {
  const checkoutRes = await fetch("/api/billing/checkout-paid", {
    method: "POST",
    credentials: "same-origin",
  })

  const rawBody = await checkoutRes.text()
  type PaidCheckoutJson = {
    url?: string
    reason?: string
    error?: string
    message?: string
    hint?: string
  }
  let payload: PaidCheckoutJson | null = null
  if (rawBody.trim().length > 0) {
    try {
      payload = JSON.parse(rawBody) as PaidCheckoutJson
    } catch {
      payload = null
    }
  }

  if (checkoutRes.ok && payload?.url) {
    return { ok: true, url: payload.url }
  }

  const reason = payload?.reason?.trim() || payload?.error?.trim() || "checkout_failed"
  const message =
    payload?.message?.trim() ||
    payload?.hint?.trim() ||
    "Nie udało się uruchomić płatności. Spróbuj ponownie."

  return { ok: false, reason, message }
}
