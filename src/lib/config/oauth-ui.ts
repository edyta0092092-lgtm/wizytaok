/** Facebook OAuth w UI — domyślnie wyłączone, włącz przez NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLED=true */
export function isFacebookOAuthUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLED?.trim().toLowerCase() === "true"
}
