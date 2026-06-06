/** Czy operator skonfigurował dostawcę SMS po stronie serwera (bez ujawniania sekretów w UI). */
export function isSmsProviderConfigured(): boolean {
  return Boolean(process.env.SMSAPI_TOKEN?.trim() || process.env.SZYBKISMS_TOKEN?.trim())
}
