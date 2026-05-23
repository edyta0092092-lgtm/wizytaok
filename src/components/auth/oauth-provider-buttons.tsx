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

export type OAuthProviderButtonsProps = {
  next?: string | null
  trialIntent?: boolean
  onBeforeSignIn?: () => void
  onError?: (code: string) => void
  className?: string
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
    <div className={className}>
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wide">
          <span className="bg-card px-2 text-muted-foreground">{t("auth.oauthDivider")}</span>
        </div>
      </div>
      <div className={showFacebook ? "flex flex-col gap-2 sm:flex-row sm:gap-3" : "flex flex-col gap-2"}>
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1 rounded-xl"
          disabled={loadingProvider !== null}
          onClick={() => void handleOAuth("google")}
        >
          {loadingProvider === "google" ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : null}
          {t("auth.continueWithGoogle")}
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
