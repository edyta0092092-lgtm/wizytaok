"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  signInWithOAuthProvider,
  type OAuthProvider,
} from "@/lib/auth/oauth-sign-in-client"
import { isFacebookOAuthUiEnabled } from "@/lib/config/oauth-ui"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

export type OAuthProviderButtonsProps = {
  next?: string | null
  trialIntent?: boolean
  onBeforeSignIn?: () => void
  onError?: (code: string) => void
  className?: string
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.43Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.89 6.62-2.34l-3.23-2.51c-.9.6-2.04.95-3.39.95-2.6 0-4.8-1.76-5.59-4.12H3.08v2.59A9.99 9.99 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.98A6.01 6.01 0 0 1 6.09 12c0-.69.12-1.36.32-1.98V7.43H3.08A9.99 9.99 0 0 0 2 12c0 1.61.39 3.13 1.08 4.57l3.33-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.9c1.47 0 2.78.5 3.82 1.49l2.87-2.87C16.95 2.9 14.7 2 12 2a9.99 9.99 0 0 0-8.92 5.43l3.33 2.59C7.2 7.66 9.4 5.9 12 5.9Z"
      />
    </svg>
  )
}

export function OAuthProviderButtons({
  next = null,
  trialIntent = false,
  onBeforeSignIn,
  onError,
  className,
}: OAuthProviderButtonsProps) {
  const { t } = useTranslations()
  const [loadingProvider, setLoadingProvider] = React.useState<OAuthProvider | null>(null)
  const showFacebook = isFacebookOAuthUiEnabled()

  const handleOAuth = async (provider: OAuthProvider) => {
    if (!isSupabaseConfigured()) {
      onError?.("oauth_failed")
      return
    }
    const client = getBrowserClient()
    if (!client) {
      onError?.("oauth_failed")
      return
    }
    onBeforeSignIn?.()
    setLoadingProvider(provider)
    try {
      const result = await signInWithOAuthProvider(client, provider, {
        next,
        trialIntent,
      })
      if (!result.ok) {
        onError?.(result.code)
      }
    } finally {
      setLoadingProvider(null)
    }
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wide">
          <span className="bg-card px-2 text-muted-foreground">{t("auth.oauthDivider")}</span>
        </div>
      </div>
      <div className={showFacebook ? "flex w-full flex-col gap-2 sm:flex-row sm:gap-3" : "flex w-full flex-col gap-2"}>
        <Button
          type="button"
          variant="outline"
          className="h-12 min-h-12 w-full min-w-full flex-1 gap-3 rounded-xl border-border/80 bg-background px-6 text-sm font-semibold shadow-sm hover:border-primary/30 hover:bg-muted/40"
          disabled={loadingProvider !== null}
          onClick={() => void handleOAuth("google")}
        >
          {loadingProvider === "google" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <GoogleIcon className="size-5" />
          )}
          <span>{t("auth.continueWithGoogle")}</span>
        </Button>
        {showFacebook ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-xl"
            disabled={loadingProvider !== null}
            onClick={() => void handleOAuth("facebook")}
          >
            {loadingProvider === "facebook" ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : null}
            {t("auth.continueWithFacebook")}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function oauthErrorMessageFromCode(
  code: string,
  t: (key: string) => string,
): string {
  switch (code) {
    case "email_confirmation_session_missing":
      return t("auth.emailConfirmedLogin")
    case "auth_link_invalid_or_expired":
      return t("auth.emailConfirmationLinkInvalid")
    case "auth_callback_failed":
      return t("auth.emailConfirmationFailed")
    case "provider_not_enabled":
      return t("auth.oauthProviderNotEnabled")
    case "cancelled":
      return t("auth.oauthCancelled")
    case "no_email":
      return t("auth.oauthNoEmail")
    default:
      return t("auth.oauthFailed")
  }
}
