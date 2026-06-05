"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { useBusinessAccess } from "@/lib/auth/business-access-context"
import {
  hasActiveBusinessAccessFromProfile,
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
      const businessId = access.businessId!
      let subscriptionStatus: string | null = null
      let stripeSubscriptionStatus: string | null = null
      let subscriptionTrialEndsAt: string | null = null

      const { data, error } = await client
        .from("business_profiles")
        .select(
          "subscription_status, stripe_subscription_status, subscription_trial_ends_at",
        )
        .eq("id", businessId)
        .maybeSingle()

      if (data) {
        subscriptionStatus = data.subscription_status
        stripeSubscriptionStatus = data.stripe_subscription_status
        subscriptionTrialEndsAt = data.subscription_trial_ends_at
      } else {
        const { data: rpc } = await client.rpc("get_business_member_subscription_access", {
          p_business_id: businessId,
        })
        if (rpc && typeof rpc === "object" && (rpc as { ok?: boolean }).ok === true) {
          const row = rpc as Record<string, unknown>
          subscriptionStatus =
            typeof row.subscription_status === "string" ? row.subscription_status : null
          stripeSubscriptionStatus =
            typeof row.stripe_subscription_status === "string"
              ? row.stripe_subscription_status
              : null
        } else if (error) {
          if (cancelled) return
          setSubscriptionActive(false)
          setSubscriptionChecked(true)
          return
        }
      }

      if (cancelled) return

      if (!subscriptionStatus && !stripeSubscriptionStatus && !subscriptionTrialEndsAt) {
        setSubscriptionActive(false)
        setSubscriptionChecked(true)
        return
      }

      setSubscriptionActive(
        hasActiveBusinessAccessFromProfile({
          subscriptionStatus,
          stripeSubscriptionStatus,
          subscriptionTrialEndsAt,
        }),
      )
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
