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
  return `${siteBase}/auth/callback?next=${encodeURIComponent(nextPath)}`
}
