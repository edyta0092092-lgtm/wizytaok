type AuthErrorLike = {
  code?: string
  message?: string
  name?: string
  status?: number
}

export function isEmailNotConfirmedAuthError(error: AuthErrorLike | null | undefined): boolean {
  if (!error) return false
  const code = error.code?.toLowerCase() ?? ""
  const message = error.message?.toLowerCase() ?? ""
  return code === "email_not_confirmed" || message.includes("email not confirmed")
}

export function buildSignupConfirmationRedirectUrl(nextPath: string, origin: string): string {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const siteBase = (configuredSiteUrl && configuredSiteUrl.length > 0 ? configuredSiteUrl : origin).replace(/\/$/, "")
  return `${siteBase}/auth/confirm?next=${encodeURIComponent(nextPath)}`
}

type RequestSignupConfirmationEmailResult =
  | { ok: true }
  | { ok: false; error?: string }

export async function requestSignupConfirmationEmail(
  email: string,
  nextPath: string,
): Promise<RequestSignupConfirmationEmailResult> {
  try {
    const res = await fetch("/api/auth/resend-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next: nextPath }),
    })
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null
    if (!res.ok || json?.ok !== true) {
      return { ok: false, error: json?.error }
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "request_failed",
    }
  }
}
