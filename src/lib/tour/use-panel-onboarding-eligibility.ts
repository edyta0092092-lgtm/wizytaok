"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { useBusinessAccess } from "@/lib/auth/business-access-context"
import {
  hasActiveBusinessAccess,
  resolveEffectiveSubscriptionStatus,
} from "@/lib/billing/subscription-status"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import {
  isPanelWelcomePath,
  isPublicTourBlockedPath,
  isTourNavigationPath,
} from "@/lib/tour/tour-path-guard"

export type PanelOnboardingEligibility = {
  ready: boolean
  /** Zalogowany + firma + trialing/active + dozwolona trasa. */
  eligible: boolean
}

export function usePanelOnboardingEligibility(
  tourActive: boolean,
): PanelOnboardingEligibility {
  const pathname = usePathname()
  const access = useBusinessAccess()
  const [subscriptionActive, setSubscriptionActive] = React.useState(false)
  const [subscriptionChecked, setSubscriptionChecked] = React.useState(false)

  React.useEffect(() => {
    if (isPublicTourBlockedPath(pathname)) {
      setSubscriptionActive(false)
      setSubscriptionChecked(true)
      return
    }

    if (!access.ready) {
      setSubscriptionChecked(false)
      return
    }

    if (!access.userEmail?.trim() || !access.businessId) {
      setSubscriptionActive(false)
      setSubscriptionChecked(true)
      return
    }

    if (!isSupabaseConfigured()) {
      setSubscriptionActive(true)
      setSubscriptionChecked(true)
      return
    }

    const client = getBrowserClient()
    if (!client) {
      setSubscriptionActive(false)
      setSubscriptionChecked(true)
      return
    }

    let cancelled = false
    setSubscriptionChecked(false)

    void (async () => {
      const { data, error } = await client
        .from("business_profiles")
        .select("subscription_status, stripe_subscription_status")
        .eq("id", access.businessId!)
        .maybeSingle()

      if (cancelled) return

      if (error || !data) {
        setSubscriptionActive(false)
        setSubscriptionChecked(true)
        return
      }

      const status = resolveEffectiveSubscriptionStatus(
        data.subscription_status,
        data.stripe_subscription_status,
      )
      setSubscriptionActive(hasActiveBusinessAccess(status))
      setSubscriptionChecked(true)
    })()

    return () => {
      cancelled = true
    }
  }, [pathname, access.ready, access.userEmail, access.businessId])

  const pathAllowed = tourActive
    ? isTourNavigationPath(pathname)
    : isPanelWelcomePath(pathname)

  const eligible =
    subscriptionChecked &&
    access.ready &&
    Boolean(access.userEmail?.trim()) &&
    Boolean(access.businessId) &&
    subscriptionActive &&
    !isPublicTourBlockedPath(pathname) &&
    pathAllowed

  return {
    ready: subscriptionChecked && access.ready,
    eligible,
  }
}
