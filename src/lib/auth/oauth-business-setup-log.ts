type SupabaseLikeError = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

export function logOAuthBusinessSetupError(context: string, err: unknown): void {
  if (err && typeof err === "object") {
    const e = err as SupabaseLikeError
    console.error("[oauth.business_setup]", context, {
      code: e.code ?? null,
      message: e.message ?? String(err),
      details: e.details ?? null,
      hint: e.hint ?? null,
    })
    return
  }
  console.error("[oauth.business_setup]", context, String(err))
}
