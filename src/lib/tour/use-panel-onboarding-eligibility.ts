"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { hasActiveBusinessAccessFromProfile } from "@/lib/billing/subscription-status"
import { loadBusinessMemberSubscription } from "@/lib/auth/load-business-member-subscription"
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
      const {
        data: { user },
      } = await client.auth.getUser()
      if (!user) {
        if (!cancelled) {
          setSubscriptionActive(false)
          setSubscriptionChecked(true)
        }
        return
      }

      const profile = await loadBusinessMemberSubscription(client, user.id, businessId)

      if (cancelled) return

      if (!profile) {
        setSubscriptionActive(false)
        setSubscriptionChecked(true)
        return
      }

      setSubscriptionActive(
        hasActiveBusinessAccessFromProfile({
          subscriptionStatus: profile.subscription_status,
          stripeSubscriptionStatus: profile.stripe_subscription_status,
          subscriptionTrialEndsAt: profile.subscription_trial_ends_at,
          trialStartedAt: profile.trial_started_at,
          stripeSubscriptionId: profile.stripe_subscription_id,
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
