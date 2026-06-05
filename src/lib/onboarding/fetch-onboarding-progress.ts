import type { SupabaseClient } from "@supabase/supabase-js"

import { buildOnboardingScope } from "@/lib/onboarding/onboarding-scope"
import {
  emptyOnboardingProgress,
  getOnboardingStepIds,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps"
import {
  loadPanelOnboardingState,
  recordToFlags,
  type PanelOnboardingState,
} from "@/lib/onboarding/persist-member-onboarding"
import {
  emptyMemberOnboardingRecord,
  type MemberOnboardingRecord,
} from "@/lib/onboarding/member-onboarding-db"

export type OnboardingProgress = Record<OnboardingStepId, boolean>

export type OnboardingProgressSnapshot = {
  progress: OnboardingProgress
  slug: string | null
  bookingPath: string | null
  userFlags: ReturnType<typeof recordToFlags>
  record: MemberOnboardingRecord
}

function buildProgress(
  isAdmin: boolean,
  steps: Partial<Record<OnboardingStepId, boolean>>,
): OnboardingProgress {
  const base = emptyOnboardingProgress(isAdmin) as OnboardingProgress
  for (const id of getOnboardingStepIds(isAdmin)) {
    base[id] = Boolean(steps[id])
  }
  return base
}

export function panelStateToSnapshot(
  panel: PanelOnboardingState,
  isAdmin: boolean,
): OnboardingProgressSnapshot {
  return {
    progress: buildProgress(isAdmin, panel.record.steps),
    slug: panel.slug,
    bookingPath: panel.bookingPath,
    userFlags: recordToFlags(panel.record),
    record: panel.record,
  }
}

/** Lekki odczyt — tylko panel_onboarding_state + slug (bez skanowania całej firmy). */
export async function fetchOnboardingProgress(
  client: SupabaseClient,
  businessId: string,
  options: {
    isAdmin: boolean
    userId: string
  },
): Promise<OnboardingProgressSnapshot> {
  const bid = businessId.trim()
  const scope = buildOnboardingScope(options.userId, bid, options.isAdmin)

  if (!bid || !scope) {
    const empty = emptyOnboardingProgress(options.isAdmin) as OnboardingProgress
    return {
      progress: empty,
      slug: null,
      bookingPath: null,
      userFlags: {
        welcomeDismissed: false,
        completed: false,
        restartPending: false,
      },
      record: emptyMemberOnboardingRecord(),
    }
  }

  const panel = await loadPanelOnboardingState(client, scope, bid)
  return panelStateToSnapshot(panel, options.isAdmin)
}

export { detectAdminBusinessStepReady } from "@/lib/onboarding/detect-admin-step-ready"
